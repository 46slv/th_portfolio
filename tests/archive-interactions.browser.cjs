// Local /archive-rebuild/ only. Real Chromium input; no dispatchEvent or fake audio.
// CHROME_PATH, PLAYWRIGHT_CORE, TH_PREVIEW_URL; optional TH_BROWSER_EVIDENCE_DIR.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const url = new URL(process.env.TH_PREVIEW_URL || 'http://127.0.0.1:4298/archive-rebuild/');
assert(['localhost','127.0.0.1'].includes(url.hostname) && url.pathname === '/archive-rebuild/', 'private rebuild only');
const evidence = path.resolve(process.env.TH_BROWSER_EVIDENCE_DIR || '.local/ws-browser/interactions');
assert(evidence.startsWith(path.resolve('.local') + path.sep), 'local evidence only');
const runs = [], artifacts = [];
const pointSelector = '#map-target [data-point-float]';
const workSelector = '#map-target [data-work]';
const itemSelector = '[data-wheel-work]';
const byId = (selector,id) => `${selector}[data-work-id=${JSON.stringify(id)}]`;
const selected = page => page.evaluate(()=>document.querySelector('[data-wheel-work].is-selected')?.dataset.workId ?? null);
const activate = (run,locator) => run.touch ? locator.tap() : locator.click();
const closeDrawer = async run => {
  if (run.touch) {
    const drawer = run.page.locator('.trial-drawer:not([hidden])');
    const close = drawer.getByRole('button',{name:/Close/});
    if (await close.count()) await close.tap();
    else throw new Error('Visible drawer has no Close target');
  } else await run.page.keyboard.press('Escape');
};

// Observe the existing native pipeline, retaining native return values and data.
// No oscillator, replacement analyser, alternate engine, or application test hook.
function observeBrowser() {
  window.browserInputs = [];
  for (const type of ['click','input','pointerdown','pointerup','pointercancel','wheel']) {
    document.addEventListener(type, event => window.browserInputs.push({
      at:performance.now(),type, trusted:event.isTrusted, pointer:event.pointerType, value:event.target.value,
      target:event.target.outerHTML?.slice(0,220),
      expanded:document.querySelector('[data-wheel-toggle]')?.getAttribute('aria-expanded'),
    }));
  }
  const Native = window.AudioContext;
  window.nativeAudio = [];
  window.AudioContext = new Proxy(Native,{construct(Target,args) {
    const context = new Target(...args);
    const record = {context,sources:[],gains:[],delays:[],convolvers:[],shapers:[],analysers:[],starts:[]};
    window.nativeAudio.push(record);
    for (const [method,key] of Object.entries({createBufferSource:'sources',createGain:'gains',
      createDelay:'delays',createConvolver:'convolvers',createWaveShaper:'shapers',createAnalyser:'analysers'})) {
      const original = context[method].bind(context);
      context[method] = (...args) => {
        const node = original(...args); record[key].push(node);
        if (method === 'createBufferSource') {
          const start = node.start.bind(node);
          node.start = (...args) => {record.starts.push({gain:record.gains[0]?.gain.value}); return start(...args);};
        }
        return node;
      };
    }
    return context;
  }});
  window.readScope = () => {
    const canvas = document.querySelector('#waveform-scope');
    const {width,height} = canvas;
    const pixels = canvas.getContext('2d').getImageData(0,0,width,height).data;
    let offCentre = 0, hash = 0;
    for (let i=0;i<pixels.length;i+=4) {
      const y = Math.floor(i/4/width);
      if (pixels[i+3] > 80 && Math.abs(y-height/2)>3) offCentre++;
      hash = (Math.imul(hash,31) + pixels[i+3]) | 0;
    }
    return {width,height,offCentre,hash};
  };
}

async function newRun(browser,width,touch,motion,failure=false) {
  const context = await browser.newContext({viewport:{width,height:900},isMobile:touch,hasTouch:touch,
    reducedMotion:motion,serviceWorkers:'block'});
  const run = {name:`${width}-${touch?'touch':'mouse'}-${motion}${failure?'-failure':''}`,width,touch,motion,
    requests:[],blocked:[],sockets:[],navigations:[],errors:[],consoleErrors:[],checks:[]};
  runs.push(run);
  // Do not let in-checkout TEMP/profile file changes reload a page mid-gesture.
  // No server or user settings change. All sockets (including external) stay local.
  await context.routeWebSocket('**/*', socket => {run.sockets.push(socket.url());});
  let release;
  const gate = new Promise(resolve=>{release=resolve;});
  run.release = release;
  await context.route('**/*', async route => {
    const request = route.request(), target = new URL(request.url());
    if (target.origin !== url.origin) {
      run.blocked.push({url:target.href,type:request.resourceType()});
      // A local document response lets us verify the real link's popup URL.
      if (request.resourceType() === 'document') return route.fulfill({status:200,contentType:'text/html',body:'External navigation intercepted locally.'});
      return route.abort();
    }
    if (target.pathname.endsWith('/SITE_th.mp3')) {
      run.requests.push(target.href);
      if (failure && run.requests.length === 1) return route.fulfill({status:503,body:'Scoped browser failure fixture'});
      if (!failure) await gate;
    }
    return route.continue();
  });
  await context.addInitScript(observeBrowser);
  const page = await context.newPage(); run.page = page; run.context = context;
  page.on('pageerror', e=>run.errors.push(e.message));
  page.on('console', message=>{if(message.type()==='error') run.consoleErrors.push(message.text());});
  page.on('framenavigated', frame=>{if(frame===page.mainFrame()) run.navigations.push(frame.url());});
  const response = await page.goto(url.href);
  assert.equal(response.status(),200);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(180);
  assert.equal(run.requests.length,0,'no audio request before entrance gesture');
  assert.equal(await page.evaluate(()=>window.nativeAudio.length),0,'no audio context before gesture');
  await activate(run,page.locator('#start-overlay'));
  await page.waitForFunction(()=>!document.body.classList.contains('is-blurred'));
  await page.waitForFunction(()=>['starting','retry'].includes(document.body.dataset.archiveAudio));
  return run;
}

async function screenshot(run,label) {
  artifacts.push([`${run.name}-${label}.png`,await run.page.screenshot()]);
}
async function waveform(run,nonflat) {
  await run.page.waitForFunction(nonflat => window.readScope().offCentre > 10 === nonflat,nonflat,{timeout:5000});
  return run.page.evaluate(()=>window.readScope());
}
async function rangeAt(run,id,fraction) {
  const range = run.page.locator('#'+id);
  await range.scrollIntoViewIfNeeded();
  const box = await range.boundingBox();
  const position = {x:box.width*fraction,y:box.height/2};
  if (run.touch) await range.tap({position}); else await range.click({position});
  return Number(await range.inputValue());
}
async function audio(run,failure) {
  const {page} = run;
  await activate(run,page.locator('[data-trial-panel="audio"]'));
  await page.locator('#trial-audio').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-trial-panel="audio"]').getAttribute('aria-expanded'),'true');
  if (failure) {
    await page.waitForFunction(()=>document.body.dataset.archiveAudio==='retry');
    assert.equal(await page.evaluate(()=>window.nativeAudio[0].context.state),'closed');
    assert.equal(await page.evaluate(()=>window.nativeAudio[0].starts.length),0);
    await page.waitForTimeout(200);
    assert.equal(run.requests.length,1,'failure never silently retries');
    await screenshot(run,'retry');
    await activate(run,page.locator('#play-pause-btn'));
  } else {
    assert.equal(await page.locator('#play-pause-btn').isDisabled(),true);
    // Native keyboard input while fetch is deliberately held; no range.fill().
    await page.locator('#vol-fader').focus();
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#vol-fader').inputValue(),'0');
    run.release();
  }
  await page.waitForFunction(()=>document.body.dataset.archiveAudio==='playing',null,{timeout:15000});
  const record = await page.evaluate(()=>window.nativeAudio.map(a=>({state:a.context.state,starts:a.starts,sourceCount:a.sources.length})));
  assert.equal(record.at(-1).sourceCount,1);
  assert.equal(record.at(-1).starts.length,1);
  assert.equal(record.length,failure?2:1);
  if (!failure) {
    assert.equal(record[0].starts[0].gain,0,'delayed start honors real zero gain before source.start');
    run.mutedScope = await waveform(run,false);
    const gain = await rangeAt(run,'vol-fader',.65);
    await page.waitForFunction(value=>Math.abs(window.nativeAudio.at(-1).gains[0].gain.value-value)<.002,gain);
    run.playingScope = await waveform(run,true);
    // The real decoded MP3 and native analyser, not a synthetic signal.
    run.signal = await page.evaluate(()=>{
      const a=window.nativeAudio.at(-1),data=new Float32Array(a.analysers[0].fftSize);
      a.analysers[0].getFloatTimeDomainData(data);
      return {peak:Math.max(...data.map(Math.abs)),channels:a.sources[0].buffer.numberOfChannels,duration:a.sources[0].buffer.duration};
    });
    assert(run.signal.peak>.005 && run.signal.duration>1);
    run.controlValues = {};
    for (const [id,fraction] of [['speed-fader',.75],['dist-fader',.25],['delay-fader',.4],['reverb-fader',.3]]) {
      const value = await rangeAt(run,id,fraction); run.controlValues[id]=value;
      assert(value>0);
      await page.waitForFunction(({id,value})=>{
        const a=window.nativeAudio.at(-1);
        if(id==='speed-fader') return Math.abs(a.sources[0].playbackRate.value-value)<.002;
        if(id==='dist-fader') return a.shapers[0].curve!==null && a.shapers[0].oversample==='4x';
        if(id==='delay-fader') return Math.abs(a.gains[1].gain.value-value)<.002;
        return a.convolvers[0].buffer!==null && Math.abs(a.gains[2].gain.value-value)<.002;
      },{id,value});
    }
    await screenshot(run,'audio-playing');
  } else run.playingScope=await waveform(run,true);
  await activate(run,page.locator('#play-pause-btn'));
  await page.waitForFunction(()=>document.body.dataset.archiveAudio==='paused');
  assert.equal(await page.evaluate(()=>window.nativeAudio.at(-1).context.state),'suspended');
  run.pausedScope = await waveform(run,false);
  await activate(run,page.locator('#play-pause-btn'));
  await page.waitForFunction(()=>document.body.dataset.archiveAudio==='playing');
  await waveform(run,true);
  assert.equal(await page.evaluate(()=>window.nativeAudio.reduce((n,a)=>n+a.starts.length,0)),1,'retry/resume/FX use one source start');
  await activate(run,page.getByRole('button',{name:'Close audio controls'}));
  assert.equal(await page.locator('[data-trial-panel="audio"]').evaluate(el=>el===document.activeElement),true);
  run.checks.push(failure?'audio failure, closed context, explicit retry, native waveform, pause/resume':'delayed audio, zero gain, actual MP3 waveform, all native faders, pause/resume');
}

async function usablePoint(page) {
  const id = await page.locator(pointSelector).evaluateAll(points=>points.find(point=>{
    const b=point.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
    return point.href.startsWith('https://') && point.contains(document.elementFromPoint(x,y)) &&
      x>innerWidth*.2 && x<innerWidth*.58 && y>innerHeight*.3 && y<innerHeight*.7;
  })?.closest('[data-work]').dataset.workId);
  assert(id,'a genuinely hit-testable Point with a real work link');
  return page.locator(byId(workSelector,id)+' [data-point-float]');
}
async function pointAndCard(run) {
  const {page} = run;
  const point = await usablePoint(page);
  const data = await point.evaluate(p=>({id:p.closest('[data-work]').dataset.workId,title:p.closest('[data-work]').dataset.tooltipTitle,href:p.href}));
  run.point = data;
  const previous = await selected(page);
  const hit = await point.evaluate(p=>{
    const b=p.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
    return {x,y,targetable:p.contains(document.elementFromPoint(x,y))};
  });
  assert(hit.targetable,'Point still owns the sampled hit position');
  if (run.touch) {
    await page.touchscreen.tap(hit.x,hit.y);
    await page.locator('#trial-detail').waitFor({state:'visible'});
    assert.equal(await page.locator('#trial-detail').getAttribute('data-work-id'),data.id);
    assert.equal(await page.locator('#trial-detail-link').getAttribute('href'),data.href);
    await screenshot(run,'point-detail');
    await page.locator('#trial-detail-close').tap();
    run.checks.push('native touch Point tap opens matching work detail');
  } else {
    // Hover itself pauses the floating marker; locator.hover() would wait for
    // that animation to stop before delivering the pointer that stops it.
    await page.mouse.move(hit.x,hit.y);
    await page.locator('#point-preview').waitFor({state:'visible'});
    assert.equal(await page.locator('#point-preview-title').textContent(),data.title);
    assert.equal(await selected(page),previous,'hover never moves persistent Wheel station');
    // Allow image failure/layout and hover transforms to finish before measuring.
    await page.waitForTimeout(300);
    const a=await point.boundingBox(),b=await page.locator('#point-preview').boundingBox();
    const cx=a.x+a.width/2,cy=a.y+a.height/2;
    let gap,edge;
    if (b.x>=a.x+a.width) {gap={x:(a.x+a.width+b.x)/2,y:cy+5};edge={x:b.x+4,y:cy+5};}
    else if (b.x+b.width<=a.x) {gap={x:(b.x+b.width+a.x)/2,y:cy+5};edge={x:b.x+b.width-4,y:cy+5};}
    else if (b.y+b.height<=a.y) {gap={x:cx+5,y:(b.y+b.height+a.y)/2};edge={x:cx+5,y:b.y+b.height-4};}
    else {gap={x:cx+5,y:(a.y+a.height+b.y)/2};edge={x:cx+5,y:b.y+4};}
    await page.mouse.move(gap.x,gap.y,{steps:12});
    await page.waitForTimeout(650); // Well beyond the 160ms dismiss timer.
    assert(await page.locator('#point-preview').isVisible(),'slow diagonal gap crossing retains card');
    await page.mouse.move(edge.x,edge.y,{steps:12});
    await page.waitForTimeout(200);
    assert.deepEqual(await page.locator('#point-preview').boundingBox(),b,'hovered card remains stationary');
    const link = page.locator('[data-preview-link]');
    assert.equal(await link.getAttribute('href'),data.href);
    await link.hover();
    await page.waitForTimeout(200);
    await screenshot(run,'point-card');
    const popupPromise=page.waitForEvent('popup');
    await link.click();
    const popup=await popupPromise; await popup.waitForLoadState('domcontentloaded');
    assert.equal(popup.url(),data.href);
    await popup.close(); await page.bringToFront();
    await page.mouse.move(3,3); await page.keyboard.press('Escape');
    await page.locator('[data-trial-panel="tag"]').focus();
    await point.focus();
    await page.locator('#point-preview').waitFor({state:'visible'});
    await page.keyboard.press('Tab');
    assert(await link.evaluate(el=>el===document.activeElement),'Tab reaches actual work link');
    await page.keyboard.press('Escape');
    assert(await point.evaluate(el=>el===document.activeElement),'Escape restores Point focus');
    await page.locator('[data-wheel-toggle]').focus();
    run.checks.push('hit-tested Point hover, slow diagonal gap, stationary interactive card, intercepted real link, Tab/Escape');
  }
}

async function trackPosition(page) {
  const position = await page.evaluate(()=>{
    const track=document.querySelector('[data-trial-track]');
    for (let i=15;i<85;i++) {
      const p=track.getPointAtLength(track.getTotalLength()*i/100).matrixTransform(track.getScreenCTM());
      if(p.x>12 && p.x<innerWidth-12 && p.y>120 && document.elementFromPoint(p.x,p.y)===track) return {x:p.x,y:p.y};
    }
  });
  assert(position,'real, exposed Wheel track'); return position;
}
async function wheel(run) {
  const {page} = run, toggle=page.locator('[data-wheel-toggle]');
  if(await toggle.getAttribute('aria-expanded')==='false') await activate(run,toggle);
  await page.waitForTimeout(400);
  await page.locator('#archive-wheel').focus();
  await page.keyboard.press('ArrowDown');
  const before=await selected(page);
  const ids=await page.locator(itemSelector).evaluateAll(nodes=>nodes.map(n=>n.dataset.workId));
  const index=ids.indexOf(before);
  const portrait=await page.evaluate(()=>matchMedia('(max-width:600px) and (orientation:portrait)').matches);
  const center=await page.locator('[data-wheel-work].is-selected').boundingBox();
  const p=portrait?{x:center.x+center.width/2,y:center.y+center.height/2}:await trackPosition(page);
  const destination={x:p.x-(portrait?76:0),y:p.y-(portrait?0:76)};
  if(run.touch) {
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
    for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+(destination.x-p.x)*i/8,y:p.y+(destination.y-p.y)*i/8,id:1}]});
    // This existing exact-next-work assertion covers a held, precise swipe.
    await page.waitForTimeout(160);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
    // A separate tap is not part of the swipe's compatibility-click sequence.
    await page.waitForTimeout(360);
  } else {
    await page.mouse.move(p.x,p.y); await page.mouse.down();
    await page.mouse.move(destination.x,destination.y,{steps:8});
    await page.waitForTimeout(160); await page.mouse.up();
  }
  await page.waitForFunction(id=>document.querySelector('[data-wheel-work].is-selected')?.dataset.workId===id,ids[index+1]);
  const current=await selected(page),node=page.locator(byId(workSelector,current));
  assert(await node.evaluate(n=>n.classList.contains('is-selected')));
  assert.equal(await page.locator('#point-preview-title').textContent(),await node.getAttribute('data-tooltip-title'));
  assert.equal(await page.locator('[data-preview-link]').getAttribute('href'),await node.locator('a').evaluate(a=>a.href));
  assert(await page.locator('#point-preview').isVisible());
  assert.equal(await page.locator('#trial-detail').isVisible(),false,'passive Wheel gesture opens no detail');
  assert.equal(await page.locator('#map-target').evaluate(n=>getComputedStyle(n).filter),'none');
  await screenshot(run,'wheel-card');
  await activate(run,toggle);
  await page.waitForFunction(()=>document.querySelector('[data-wheel-toggle]').getAttribute('aria-expanded')==='false');
  assert.equal(await selected(page),current,'closing Wheel preserves selection');
  if (!portrait) assert(await page.locator('#point-preview').isVisible(),'closing the desktop Wheel preserves its active card');
  // A real label click/tap is hit-tested, never dispatchEvent or force:true.
  await page.waitForTimeout(350); // Let collapse geometry and the previous touch sequence settle.
  await activate(run,toggle);
  await page.waitForFunction(()=>document.querySelector('[data-wheel-toggle]').getAttribute('aria-expanded')==='true');
  await page.waitForTimeout(350);
  await activate(run,page.locator(`${itemSelector}.is-selected`));
  assert.equal(await page.locator('#trial-detail').getAttribute('data-work-id'),current);
  await activate(run,page.locator('#trial-detail-close'));
  run.checks.push('real track drag/swipe and label activation, same Work ID/Point/card, collapse retains selection');
}

async function filters(run) {
  const {page}=run;
  const works=await page.locator(workSelector).evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.workId,
    tags:n.dataset.tags.split(',').map(s=>s.trim()).filter(Boolean),year:n.dataset.year,left:n.style.left,bottom:n.style.bottom})));
  // Compare the same closed-detail composition, after the previous exit has finished.
  await page.locator('#trial-detail').waitFor({state:'hidden'});
  const graph=await page.locator('#map-target').boundingBox();
  const tags=await page.locator('[data-filter-tag]').evaluateAll(nodes=>nodes.map(n=>n.dataset.filterTag).filter(t=>t!=='__all__'));
  const years=await page.locator('[data-filter-year]').evaluateAll(nodes=>nodes.map(n=>n.dataset.filterYear).filter(t=>t!=='__all__'));
  const pairs=tags.flatMap(tag=>years.map(year=>({tag,year,count:works.filter(w=>w.tags.includes(tag)&&w.year===year).length})));
  const populated=pairs.find(p=>p.count>=2 && p.count<works.length/2),empty=pairs.find(p=>p.count===0);
  assert(populated && empty,'derive real nonempty AND empty Tag/Year pairs from metadata');
  const set = async (kind,value) => {
    const trigger=page.locator(`[data-trial-panel="${kind}"]`);
    if(await trigger.getAttribute('aria-expanded')==='false') await activate(run,trigger);
    await activate(run,page.locator(`[data-filter-${kind}=${JSON.stringify(value)}]`));
  };
  const verify = async (tag,year) => {
    const expected=works.filter(w=>(!tag||w.tags.includes(tag))&&(!year||w.year===year)).map(w=>w.id).sort();
    const actual=await page.evaluate(()=>({
      map:[...document.querySelectorAll('#map-target [data-work]:not(.is-inactive)')].map(n=>n.dataset.workId).sort(),
      wheel:[...document.querySelectorAll('[data-wheel-work]:not(.is-hidden)')].map(n=>n.dataset.workId).sort(),
      coords:[...document.querySelectorAll('#map-target [data-work]')].map(n=>[n.dataset.workId,n.style.left,n.style.bottom]),
      inert:[...document.querySelectorAll('#map-target [data-work][inert]')].map(n=>n.dataset.workId).sort(),
    }));
    assert.deepEqual(actual.map,expected); assert.deepEqual(actual.wheel,expected);
    assert.deepEqual(actual.inert,works.filter(w=>!expected.includes(w.id)).map(w=>w.id).sort(),
      'only excluded Points become inert; clearing filters restores them');
    assert.deepEqual(actual.coords,works.map(w=>[w.id,w.left,w.bottom]));
    assert.deepEqual(await page.locator('#map-target').boundingBox(),graph,'filter drawer never moves Graph');
    assert.equal(await page.locator('#point-preview').isVisible(),false,'filter clears stale card');
    run.filterCounts ??= []; run.filterCounts.push({tag,year,count:expected.length});
    return expected;
  };
  await set('tag',populated.tag); await verify(populated.tag,null);
  await set('year',populated.year); await verify(populated.tag,populated.year);
  await set('tag','__all__'); await verify(null,populated.year);
  await set('tag',empty.tag); await set('year',empty.year); await verify(empty.tag,empty.year);
  await screenshot(run,'filters-empty');
  await closeDrawer(run);
  // Empty means no focusable/activatable Point, not just a faded appearance.
  const toggle=page.locator('[data-wheel-toggle]');
  if(await toggle.getAttribute('aria-expanded')==='false') await activate(run,toggle);
  await page.locator('#archive-wheel').focus(); await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('#point-preview').isVisible(),false);
  assert.equal(await page.locator(workSelector+'.is-selected').count(),0);
  await page.locator('[data-trial-panel="tag"]').focus();
  const tabbed=[];
  for(let i=0;i<works.length+12;i++) {
    await page.keyboard.press('Tab');
    const id=await page.evaluate(()=>document.activeElement?.closest('[data-work]')?.dataset.workId);
    if(id) {tabbed.push(id); break;}
  }
  assert.deepEqual(tabbed,[],'filtered Points must leave the real Tab sequence');
  // Even an explicit attempt to focus an excluded link must not permit native Enter activation.
  await page.evaluate(()=>{document.body.tabIndex=-1;document.body.focus();});
  const excludedPoint=page.locator(`${workSelector}.is-inactive [data-point-float]`).first();
  await excludedPoint.evaluate(point=>point.focus()); // controlled setup; Enter below is native input
  assert.equal(await excludedPoint.evaluate(point=>point===document.activeElement),false,
    'excluded Point cannot acquire focus');
  const popups=[];
  const recordPopup=popup=>popups.push(popup);
  page.on('popup',recordPopup);
  try {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    assert.equal(popups.length,0,'excluded Point cannot activate a work link');
    assert.equal(await page.locator('#trial-detail').isVisible(),false,'excluded Point cannot open work detail');
  } finally {
    page.off('popup',recordPopup);
    for(const popup of popups) await popup.close();
    await page.evaluate(()=>document.body.removeAttribute('tabindex'));
  }
  await set('tag','__all__'); await set('year','__all__'); await verify(null,null);
  await closeDrawer(run);
  await page.locator('[data-trial-panel="tag"]').focus();
  let restored;
  for(let i=0;i<works.length+12;i++) {
    await page.keyboard.press('Tab');
    restored=await page.evaluate(()=>document.activeElement?.closest('[data-work]')?.dataset.workId);
    if(restored) break;
  }
  assert(restored,'clearing filters restores real keyboard access to Points');
  await page.keyboard.press('Enter');
  await page.locator('#trial-detail').waitFor({state:'visible'});
  assert.equal(await page.locator('#trial-detail').getAttribute('data-work-id'),restored);
  await activate(run,page.locator('#trial-detail-close'));
  run.checks.push('native Tag, Year, AND, empty, clear, exact metadata-derived sets and stable coordinates, filtered keyboard exclusion and restored activation');
}

async function capture(run) {
  const {page}=run;
  if(page.isClosed() || run.captured) return;
  run.inputs=await page.evaluate(()=>window.browserInputs);
  run.audio=await page.evaluate(()=>window.nativeAudio.map(a=>({state:a.context.state,starts:a.starts,sourceCount:a.sources.length})));
  await screenshot(run,'final'); run.captured=true;
}

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true,chromiumSandbox:true});
  try {
    for(const [width,touch,motion] of [[1440,false,'no-preference'],[390,false,'no-preference'],[390,true,'no-preference'],[390,true,'reduce']]) {
      const run=await newRun(browser,width,touch,motion);
      await screenshot(run,'closed');
      await audio(run,false); await pointAndCard(run); await wheel(run); await filters(run);
      assert.deepEqual(run.errors,[]);
      assert.equal(run.navigations.length,1,'no silent HMR/navigation reset');
      await capture(run);
      assert(run.inputs.filter(e=>e.type==='input').length>=6);
      assert(run.inputs.every(e=>e.trusted),'all exercised control events are browser-generated');
      if(touch) assert(run.inputs.some(e=>e.type==='pointerdown'&&e.pointer==='touch'));
      console.log(JSON.stringify({name:run.name,checks:run.checks,filters:run.filterCounts}));
      await run.context.close();
    }
    for(const width of [390,1440]) {
      const run=await newRun(browser,width,width===390,'reduce',true);
      await audio(run,true); assert.equal(run.requests.length,2);
      assert.deepEqual(run.errors,[]); assert.equal(run.navigations.length,1);
      await capture(run); console.log(JSON.stringify({name:run.name,checks:run.checks}));
      await run.context.close();
    }
  } catch(error) {
    if(runs.length) runs.at(-1).failure=error.stack;
    throw error;
  } finally {
    for(const run of runs) {run.release(); await capture(run).catch(()=>{});}
    await browser.close();
    // Flush after Chrome closes: artifacts can otherwise trigger Vite reloads.
    fs.mkdirSync(evidence,{recursive:true});
    for(const [name,bytes] of artifacts) fs.writeFileSync(path.join(evidence,name),bytes);
    fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(runs.map(({page,context,release,...run})=>run),null,2));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
