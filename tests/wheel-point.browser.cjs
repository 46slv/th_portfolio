// Focused /archive-rebuild/ regression; no deploy dependency or external work navigation.
// TH_PREVIEW_URL, CHROME_PATH, PLAYWRIGHT_CORE; optional TH_WHEEL_EVIDENCE_DIR under .local/.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const url = process.env.TH_PREVIEW_URL || 'http://127.0.0.1:4279/archive-rebuild/';
const evidence = process.env.TH_WHEEL_EVIDENCE_DIR;
// Flush artifacts after closing the browser: new files can trigger dev-server reloads.
const artifacts = [];
const wheelSelector = '#archive-wheel';
const pointSelector = '#map-target [data-point-float]';

async function settled(page) { await page.waitForTimeout(600); }
async function selected(page) {
  return page.locator('[data-wheel-work].is-selected').getAttribute('data-work-id');
}
async function noDrawer(page) {
  assert.equal(await page.locator('#trial-detail').isVisible(), false, 'passive browsing opens no detail');
  assert.equal(await page.locator('#map-target').evaluate(el => getComputedStyle(el).filter), 'none');
}
async function measure(page) {
  return page.evaluate(() => {
    const wheel = document.querySelector('#archive-wheel');
    const points = [...document.querySelectorAll('#map-target [data-point-float]')];
    const samples = points.flatMap(point => {
      const b = point.getBoundingClientRect();
      return [.2,.5,.8].flatMap(fx => [.2,.5,.8].map(fy => ({
        id:point.closest('[data-work]').dataset.workId,
        x:b.x+b.width*fx, y:b.y+b.height*fy,
      })));
    });
    // Compare against the actual underlying Point, NOT against each source
    // Point's centre: Point-on-Point overlap is a separate existing limitation.
    const hit = s => document.elementFromPoint(s.x,s.y);
    const openHits = samples.map(s => hit(s)?.closest('#archive-wheel') != null);
    const previous = wheel.style.visibility;
    wheel.style.visibility = 'hidden';
    const underlying = samples.map(s => hit(s)?.closest('[data-point-float]')?.closest('[data-work]')?.dataset.workId);
    wheel.style.visibility = previous;
    return {
      graph:document.querySelector('#map-target').getBoundingClientRect().toJSON(),
      wheel:wheel.getBoundingClientRect().toJSON(),
      pointSamples:samples.length,
      pointOnPointSamples:samples.filter((s,i) => underlying[i] && underlying[i] !== s.id).length,
      wheelOcclusions:samples.filter((s,i) => openHits[i] && underlying[i]),
      trackWidth:getComputedStyle(document.querySelector('[data-trial-track]')).strokeWidth,
    };
  });
}
async function trackPosition(page) {
  const pos = await page.evaluate(() => {
    const track = document.querySelector('[data-trial-track]');
    const m = track.getScreenCTM();
    // Upper half is label-free at the initial selection; find a real stroke hit.
    for (const fraction of [.35,.25,.65,.75,...Array.from({length:101},(_,i)=>i/100)]) {
      const p=track.getPointAtLength(track.getTotalLength()*fraction).matrixTransform(m);
      if (p.y>150 && p.x>12 && p.x<innerWidth-12 && document.elementFromPoint(p.x,p.y)===track) return {x:p.x,y:p.y};
    }
    return null;
  });
  assert(pos, 'an exposed, bounded drag track must remain usable');
  return pos;
}
async function drag(page, touch) {
  const p = await trackPosition(page);
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
    for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{
      type:'touchMove',touchPoints:[{x:p.x,y:p.y-76*i/8,id:1}],
    });
    // Keep this legacy one-station precision check a deliberate slow release.
    await page.waitForTimeout(160);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
  } else {
    await page.mouse.move(p.x,p.y);
    await page.mouse.down();
    await page.mouse.move(p.x,p.y-76,{steps:8});
    await page.waitForTimeout(160);
    await page.mouse.up();
  }
  await settled(page);
}
async function activateLabel(page) {
  const id=await selected(page);
  const data=await page.locator('#map-target [data-work]').evaluateAll((nodes,id)=>{
    const node=nodes.find(n=>n.dataset.workId===id);
    return {title:node.dataset.tooltipTitle,href:node.querySelector('a').href};
  },id);
  const label=page.locator('[data-wheel-work].is-selected');
  await label.focus();
  await page.keyboard.press('Enter');
  await page.locator('#trial-detail').waitFor({state:'visible'});
  assert.equal(await page.locator('#trial-detail-title').textContent(),data.title);
  assert.equal(await page.locator('#trial-detail-link').getAttribute('href'),data.href);
  await page.locator('#trial-detail-close').click();
  await settled(page);
  assert.equal(await selected(page),id,'detail dismissal preserves Wheel position');
  await noDrawer(page);
}
async function formerCollision(page, title, touch) {
  const p = page.locator('[data-work]').filter({has:page.locator('[data-point-float]')});
  const position = await p.evaluateAll((nodes,title) => {
    const node=nodes.find(n=>n.dataset.tooltipTitle===title);
    const b=node.querySelector('[data-point-float]').getBoundingClientRect();
    const x=b.x+b.width/2,y=b.y+b.height/2;
    const actual=document.elementFromPoint(x,y)?.closest('[data-point-float]');
    return {x,y,title:actual?.closest('[data-work]').dataset.tooltipTitle,href:actual?.href};
  },title);
  assert(position.title, 'formerly Wheel-occluded position now reaches a Point (possibly an overlapping Point)');
  if (touch) {
    await page.touchscreen.tap(position.x,position.y);
    await page.locator('#trial-detail').waitFor({state:'visible'});
    assert.equal(await page.locator('#trial-detail-title').textContent(),position.title);
    assert.equal(await page.locator('#trial-detail-link').getAttribute('href'),position.href);
    await page.locator('#trial-detail-close').tap();
  } else {
    await page.mouse.move(position.x,position.y);
    await page.locator('#point-preview').waitFor({state:'visible'});
    assert.equal(await page.locator('#point-preview-title').textContent(),position.title);
    assert.equal(await page.locator('[data-preview-link]').getAttribute('href'),position.href);
    await page.mouse.move(4,4);
    await page.keyboard.press('Escape');
  }
  // Detail dismissal restores Point focus; clear its intentional focus preview.
  await page.locator('[data-wheel-toggle]').focus();
  await page.keyboard.press('Escape');
}
async function filters(page) {
  await page.locator('[data-trial-panel="tag"]').click();
  const tag=await page.locator('[data-filter-tag]:not([data-filter-tag="__all__"])').first().getAttribute('data-filter-tag');
  await page.locator(`[data-filter-tag=${JSON.stringify(tag)}]`).click();
  const year=await page.locator('#map-target [data-work]:not(.is-inactive)').first().getAttribute('data-year');
  await page.locator('[data-trial-panel="year"]').click();
  await page.locator(`[data-filter-year="${year}"]`).click();
  const sets=await page.evaluate(()=>({
    map:[...document.querySelectorAll('#map-target [data-work]:not(.is-inactive)')].map(n=>n.dataset.workId).sort(),
    wheel:[...document.querySelectorAll('[data-wheel-work]:not(.is-hidden)')].map(n=>n.dataset.workId).sort(),
  }));
  assert(sets.map.length>0);
  assert.deepEqual(sets.wheel,sets.map,'Tag AND Year produce the same Wheel/Point set');
  await page.keyboard.press('Escape');
  await settled(page);
  const toggle=page.locator('[data-wheel-toggle]');
  if(await toggle.getAttribute('aria-expanded')==='false') await toggle.click();
  await page.locator(wheelSelector).focus();
  await page.keyboard.press('ArrowDown');
  assert(sets.map.includes(await selected(page)));
  await noDrawer(page);
}
async function launchers(page, touch) {
  const audio=page.getByRole('button',{name:/Audio & Space/});
  const drawer=page.locator('#trial-audio');
  const click=target=>touch?target.tap():target.click();
  assert.equal(await drawer.isVisible(),false);
  const wheelLaunch=page.locator('[data-wheel-toggle]');
  const portrait=await page.evaluate(()=>matchMedia('(max-width:600px) and (orientation:portrait)').matches);
  assert.equal(await wheelLaunch.isVisible(),true);
  assert.equal(await wheelLaunch.getAttribute('aria-controls'),'archive-wheel-rail');
  assert.equal(await wheelLaunch.getAttribute('aria-expanded'),'false');
  assert.equal(await wheelLaunch.locator('.line-action__word:visible').innerText(),portrait?'Browse works':'Wheel');
  assert.equal(await audio.isVisible(),true);
  const tagYear=page.locator('[data-trial-panel="tag"]');
  await tagYear.evaluate(button=>{
    const visual=document.createElement('span');
    visual.textContent=button.textContent;
    visual.setAttribute('data-replacement-skin','');
    button.replaceChildren(visual);
  });
  await click(tagYear.locator('[data-replacement-skin]'));
  assert.equal(await page.locator('#trial-tag').isVisible(),true,'replacement markup keeps the disclosure contract');
  await page.keyboard.press('Escape');
  assert.equal(await tagYear.evaluate(el=>document.activeElement===el),true);
  await click(audio);
  assert.equal(await audio.getAttribute('aria-expanded'),'true');
  if (portrait) assert(await page.locator('#archive-wheel').evaluate(el=>el.inert),'portrait drawer makes the dock passive');
  else {
    await click(wheelLaunch);
    assert.equal(await wheelLaunch.getAttribute('aria-expanded'),'true');
    assert.equal(await drawer.isVisible(),true,'Wheel opening does not close Audio');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#map-lissajous')).filter==='brightness(0.62)');
    await click(wheelLaunch);
    assert.equal(await drawer.isVisible(),true,'Wheel closing does not alter Audio');
  }
  assert.equal(await drawer.locator('#vol-fader').inputValue(),'0.5');
  for (const selector of ['#play-pause-btn','#vol-fader','#speed-fader','#dist-fader','#delay-fader','#reverb-fader','#doppler-status'])
    assert.equal(await drawer.locator(selector).isVisible(),true,selector);
  const status=page.locator('body');
  await page.waitForFunction(()=>['playing','retry'].includes(document.body.dataset.archiveAudio));
  if(await status.getAttribute('data-archive-audio')==='playing') {
    const play=drawer.locator('#play-pause-btn');
    await click(play);
    await page.waitForFunction(()=>document.body.dataset.archiveAudio==='paused');
    await click(play);
    await page.waitForFunction(()=>document.body.dataset.archiveAudio==='playing');
  } else {
    assert.match(await drawer.locator('#play-pause-btn').textContent(),/Retry/);
  }
  await click(drawer.getByRole('button',{name:'Close audio controls'}));
  await drawer.waitFor({state:'hidden'});
  assert.equal(await audio.evaluate(el=>document.activeElement===el),true);
  console.log('Launchers: '+(touch?'touch':'desktop')+'; visible, close focus retained, audio '+await status.getAttribute('data-archive-audio'));
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true,chromiumSandbox:true});
  try {
    for(const [width,touch,motion] of [[320,false,'reduce'],[390,false,'reduce'],[480,false,'reduce'],[760,false,'reduce'],[1440,false,'reduce'],[320,true,'reduce'],[390,true,'reduce'],[320,true,'no-preference'],[390,false,'no-preference']]) {
      const height=width===1440?900:844;
      const page=await browser.newPage({viewport:{width,height},isMobile:touch,hasTouch:touch,reducedMotion:motion});
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.route('https://img.youtube.com/**', route=>route.abort());
      await page.goto(url);
      await page.locator('#start-overlay').click();
      await page.waitForFunction(()=>!document.body.classList.contains('is-blurred'));
      if ((width===390&&touch)||width===1440) await launchers(page,touch);
      const initial=await page.locator('#map-target').boundingBox();
      const toggle=page.locator('[data-wheel-toggle]');
      await toggle.click(); await settled(page);
      const geometry=await measure(page);
      assert.deepEqual(geometry.wheelOcclusions,[],`${width}: Wheel must not steal sampled Point targets`);
      assert.equal(geometry.graph.width,geometry.graph.height);
      assert(Math.abs(geometry.graph.x+geometry.graph.width/2-width/2)<1);
      assert(Math.abs(geometry.graph.y+geometry.graph.height/2-height/2)<1);
      assert.equal(geometry.wheel.x+geometry.wheel.width,width);
      assert(Math.abs(geometry.wheel.y+geometry.wheel.height/2-height/2)<1);
      assert.deepEqual(await page.locator('#map-target').boundingBox(),initial,'opening Wheel leaves Graph stable');
      await noDrawer(page);
      assert.equal(await page.locator('#point-preview').isVisible(),false,'opening alone does not choose a card');
      const name=`${width}-${touch?'touch':'mouse'}-${motion}`;
      if(evidence) {
        assert(path.resolve(evidence).includes(`${path.sep}.local${path.sep}`),'evidence belongs under .local/');
        artifacts.push([`geometry-${name}.json`,JSON.stringify(geometry,null,2)]);
        artifacts.push([`wheel-${name}.png`,await page.screenshot()]);
      }
      const entries=await page.locator('[data-wheel-work]').evaluateAll(nodes=>nodes.map(n=>n.dataset.workId));
      await page.locator(wheelSelector).focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await selected(page),entries[1]);
      const linked=page.locator('#map-target [data-work-id='+JSON.stringify(entries[1])+']');
      assert.equal(await linked.evaluate(el=>el.classList.contains('is-selected')),true);
      assert.equal(await page.locator('#point-preview-title').textContent(),await linked.getAttribute('data-tooltip-title'));
      assert.equal(await page.locator('#point-preview').isVisible(),true);
      await page.keyboard.press('ArrowRight');
      assert.equal(await selected(page),entries[2]);
      await page.keyboard.press('ArrowUp');
      assert.equal(await selected(page),entries[1]);
      await page.keyboard.press('ArrowLeft');
      assert.equal(await selected(page),entries[0]);
      await noDrawer(page);
      await toggle.focus(); await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-wheel-step')),true,'quiet step controls remain keyboard reachable');
      await settled(page);
      assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).opacity),'1');
      await page.keyboard.press('Enter');
      assert.equal(await selected(page),entries[0]);
      await page.locator(wheelSelector).focus();
      await drag(page,touch);
      assert.equal(await selected(page),entries[1],`${name}: real drag/swipe advances one work`);
      await noDrawer(page);
      assert.deepEqual((await measure(page)).wheelOcclusions,[],`${name}: no Point occlusion after browsing`);
      if(!touch) {
        const p=await trackPosition(page);
        await page.mouse.move(p.x,p.y); await page.mouse.wheel(0,110); await settled(page);
        assert.equal(await selected(page),entries[2]);
      }
      await activateLabel(page);
      const preserved=await selected(page);
      const item=page.locator('[data-wheel-work].is-selected');
      await item.click();
      const openDetail=page.locator('#trial-detail');
      await openDetail.waitFor();
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      assert.equal(await openDetail.isVisible(),true,'Wheel close preserves explicit detail');
      assert.equal(await selected(page),preserved);
      await page.keyboard.press('Escape');
      await openDetail.waitFor({state:'hidden'});
      await toggle.click();
      await page.keyboard.press('Escape');
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      assert.equal(await page.locator('[data-wheel-rail]').getAttribute('inert'),'');
      assert.equal(await toggle.evaluate(el=>document.activeElement===el),true);
      assert.equal(await selected(page),preserved,'collapse retains the selected Work ID');
      await page.keyboard.press('ArrowDown');
      await toggle.dispatchEvent('wheel',{deltaY:110});
      await settled(page);
      assert.equal(await toggle.getAttribute('aria-expanded'),'false','closed trigger does not capture wheel');
      assert.equal(await selected(page),preserved,'closed trigger does not rotate selection');
      await toggle.click(); await settled(page);
      if(width<760 && motion==='reduce') {
        for(const title of ['The Starting Points (album)','U-ena Original Soundtrack (album)']) {
          await formerCollision(page,title,touch);
          if(await toggle.getAttribute('aria-expanded')==='false') await toggle.click();
        }
      }
      await filters(page);
      assert.deepEqual(errors,[]);
      console.log(`${name}: ${geometry.pointSamples} Point samples, 0 Wheel occlusions; ${geometry.pointOnPointSamples} overlapping-Point samples retained; keyboard, drag/swipe, filters, undimmed Graph`);
      await page.close();
    }
  } finally { await browser.close(); }
  if(evidence) {
    fs.mkdirSync(evidence,{recursive:true});
    for(const [name,content] of artifacts) fs.writeFileSync(path.join(evidence,name),content);
  }
})().catch(e=>{console.error(e);process.exit(1);});
