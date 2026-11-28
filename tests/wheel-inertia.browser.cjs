// Real installed Chrome, built /archive-rebuild/, trusted input; position comes
// from each rendered radial label's CSS rotation, NOT from a private motion variable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const url = new URL(process.env.TH_PREVIEW_URL);
assert.equal(url.hostname, '127.0.0.1');
const evidence = process.env.TH_INERTIA_EVIDENCE;
const results = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function setup(browser, reduce = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduce ? 'reduce' : 'no-preference', serviceWorkers:'block' });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', route => new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.inputs = [];
    for (const type of ['wheel','pointerdown','pointermove','pointerup','pointercancel','click']) document.addEventListener(type, e => {
      if (!e.target.closest?.('#archive-wheel') && type !== 'wheel') return;
      const labels=[...document.querySelectorAll('[data-wheel-work]')];
      const label=labels.find(n=>n.classList.contains('is-selected') && n.style.visibility==='visible');
      const beforeOffset=label ? Number(document.querySelector('#archive-wheel').dataset.wheelOffset) : null;
      window.inputs.push({ type, at:performance.now(), trusted:e.isTrusted, delta:e.deltaY, mode:e.deltaMode, pointer:e.pointerType, x:e.clientX, y:e.clientY, detail:e.detail, beforeOffset, target:e.target.outerHTML?.slice(0,120) });
    }, true);
  });
  await page.goto(url.href);
  await page.locator('#start-overlay').click();
  await page.waitForFunction(() => !document.body.classList.contains('is-blurred'));
  await page.locator('[data-wheel-toggle]').click();
  await page.locator('#archive-wheel').focus();
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowDown');
  await sleep(380);
  const pos = await page.evaluate(() => {
    const track = document.querySelector('[data-trial-track]');
    for (let i = 10; i < 90; i++) {
      const p = track.getPointAtLength(track.getTotalLength() * i / 100).matrixTransform(track.getScreenCTM());
      if (document.elementFromPoint(p.x,p.y) === track) return { x:p.x, y:p.y };
    }
  });
  assert(pos, 'real open arc hit target');
  await page.mouse.move(pos.x,pos.y);
  await page.evaluate(() => {
    window.samples = []; window.sampling = true;
    const labels = [...document.querySelectorAll('[data-wheel-work]')];
    const sample = () => {
      if (!window.sampling) return;
      const label = labels.find(n => n.classList.contains('is-selected') && n.style.visibility === 'visible');
      if (label) {
        const i = labels.indexOf(label);
        const offset = Number(document.querySelector('#archive-wheel').dataset.wheelOffset);
        const id = label.dataset.workId;
        window.samples.push({ at:performance.now(), offset, i, id, open:!document.querySelector('#archive-wheel').classList.contains('is-collapsed'),
          point:document.querySelector('#map-target [data-work].is-selected')?.dataset.workId,
          card:document.querySelector('#point-preview-title')?.textContent,
          title:document.querySelector(`#map-target [data-work][data-work-id="${id}"]`)?.dataset.tooltipTitle,
          visible:labels.filter(n => n.style.visibility === 'visible' && +getComputedStyle(n).opacity > .15).length });
      }
      requestAnimationFrame(sample);
    };
    sample();
  });
  return { page, context, pos };
}
async function finish(run, name) {
  const {page,context} = run;
  const data = await page.evaluate(() => { window.sampling = false; return { samples:window.samples, inputs:window.inputs }; });
  assert(data.samples.length > 8, name + ' frame samples');
  assert(data.samples.every(s => !s.open || (s.id === s.point && s.card.trim() === s.title.trim() && s.visible >= 2)), name + ' Point/Card/labels coherent');
  assert(data.inputs.every(input => input.trusted), name + ' trusted Chrome events');
  results.push({ name, ...data });
  await context.close();
  return data.samples;
}
const rest = frames => frames.at(-1).offset;
function stable(frames, label) {
  const tail = frames.slice(-7).map(s => s.offset);
  assert(Math.max(...tail)-Math.min(...tail) < .025, label + ' stable final station');
  assert(Math.abs(rest(frames)-Math.round(rest(frames))) < .025, label + ' snapped');
}
async function wheel(browser, name, packets, interval, reduce=false) {
  const run = await setup(browser,reduce);
  for (const delta of packets) { await run.page.mouse.wheel(0,delta); if (interval) await sleep(interval); }
  await sleep(packets.some(x=>Math.abs(x)>220) ? 1250 : 1050);
  const frames=await finish(run,name); stable(frames,name);
  assert.equal(results.at(-1).inputs.filter(e=>e.type==='wheel').length,packets.length);
  return frames;
}
function captureFrames(name,frames,release,target,initial) {
  // The first recorded frame may precede the release handler's next RAF.
  const after=frames.filter(s=>s.at>release+22 && s.at<release+185);
  const distances=after.map(s=>Math.abs(s.offset-target));
  assert(after.length>=5,name+' has several post-release Chrome frames');
  assert(distances[0]<Math.abs(initial-target)-.004 && distances[0]>.012,name+' neither dwells nor jumps');
  assert(distances.slice(1).every((d,i)=>d<=distances[i]+.025),name+' has no repeated crossing');
  assert(distances.filter((d,i)=>i>0 && distances[i-1]-d>.008).length>=3,name+' decreases on at least three frames');
  assert(Math.abs(rest(frames)-target)<.025,name+' chooses the natural nearest detent');
}
async function fractionalDrag(browser,name,fraction,sign,touch) {
  const run=await setup(browser);
  const {page,pos}=run;
  const y=pos.y-sign*fraction*76;
  if(touch) {
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...pos,id:1}]});
    for(let i=1;i<=4;i++) { await sleep(23); await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pos.x,y:pos.y+(y-pos.y)*i/4,id:1}]}); }
    await sleep(190);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
  } else {
    await page.mouse.down();
    for(let i=1;i<=4;i++) { await sleep(23); await page.mouse.move(pos.x,pos.y+(y-pos.y)*i/4); }
    await sleep(190);
    await page.mouse.up();
  }
  await sleep(700);
  assert.equal(await page.locator('#trial-detail').isVisible(),false,name+' no synthetic detail');
  const frames=await finish(run,name); stable(frames,name);
  const release=results.at(-1).inputs.findLast(e=>e.type==='pointerup');
  assert(release && release.pointer===(touch?'touch':'mouse'),name+' real release');
  captureFrames(name,frames,release.at,Math.round(30+sign*fraction),30+sign*fraction);
}
async function flick(browser,name,hold,touch) {
  const run=await setup(browser);
  const {page,pos} = run;
  if(touch) {
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...pos,id:1}]});
    for(let i=1;i<=4;i++) { await sleep(24); await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pos.x,y:pos.y-76*i/4,id:1}]}); }
    if(hold) await sleep(180);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
  } else {
    await page.mouse.down();
    for(let i=1;i<=4;i++) { await sleep(24); await page.mouse.move(pos.x,pos.y-76*i/4); }
    if(hold) await sleep(180);
    await page.mouse.up();
  }
  await sleep(1050);
  assert.equal(await page.locator('#trial-detail').isVisible(),false,name+' does not synthesize a label click/detail');
  const frames=await finish(run,name); stable(frames,name);
  assert(results.at(-1).inputs.some(e=>e.type==='pointermove' && e.pointer===(touch?'touch':'mouse')));
  return frames;
}
(async () => {
  const browser = await chromium.launch({ executablePath:process.env.CHROME_PATH,headless:true,chromiumSandbox:true,
    args:['--no-proxy-server','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
  try {
    const fast=await wheel(browser,'fast 4x55',Array(4).fill(55),25);
    const slow=await wheel(browser,'slow 4x55',Array(4).fill(55),190);
    const negative=await wheel(browser,'negative 4x55',Array(4).fill(-55),25);
    const negativeNotches=await wheel(browser,'negative 4x110',Array(4).fill(-110),25);
    const positiveNotches=await wheel(browser,'positive 4x110',Array(4).fill(110),25);
    const positiveStream=await wheel(browser,'positive 8x55',Array(8).fill(55),25);
    const negativeStream=await wheel(browser,'negative 8x55',Array(8).fill(-55),25);
    const firstPackets=results.find(r=>r.name==='fast 4x55').inputs.filter(e=>e.type==='wheel');
    const firstSpan=firstPackets.at(-1).at-firstPackets[0].at;
    const partition=await wheel(browser,'same elapsed 2x110',[110,110],Math.max(35,Math.min(170,firstSpan-35)));
    const taper=await wheel(browser,'tapering OS packets',[110,55,25,10],30);
    const negativeTaper=await wheel(browser,'negative tapering OS packets',[-110,-55,-25,-10],30);
    const nativeTail=await wheel(browser,'native tail 12 packets',[110,110,84,62,42,29,18,12,7,4,2,1],25);
    const isolated=await wheel(browser,'isolated 110',[110],0);
    const oversized=await wheel(browser,'oversized isolated',[1e6],0);
    const large=await wheel(browser,'isolated 880 continuity',[880],0);
    const reduced=await wheel(browser,'reduced fast',Array(4).fill(55),25,true);
    const reducedLarge=await wheel(browser,'reduced isolated 880',[880],0,true);
    for(const [name,frames] of [['fast',fast],['slow',slow],['partition',partition],['taper',taper],['isolated',isolated],['large',large],['reduced',reduced],['reduced large',reducedLarge]]) {
      assert(frames.every(s=>s.offset>=29.99 && s.offset<=41.01), name+' bounded');
    }
    assert(rest(fast)>rest(slow)+.5, `fast packets coast beyond identical direct displacement: ${rest(fast)} vs ${rest(slow)}`);
    for(const [name,frames,budget] of [['negative 4x55',negative,28],['negative 4x110',negativeNotches,26]]) {
      const inputs=results.find(r=>r.name===name).inputs.filter(e=>e.type==='wheel');
      assert(inputs.length===4 && inputs.every(e=>e.trusted && e.delta<0));
      assert(frames.some(s=>s.at>inputs.at(-1).at+35 && s.offset<Math.min(budget-.05,inputs.at(-1).beforeOffset-.08)),
        name+' continues NEGATIVE after release without requiring the old directional-floor detent');
      const coast=frames.filter(s=>s.at>inputs.at(-1).at+30);
      assert(coast.slice(1).every((s,i)=>s.offset<=coast[i].offset+.025),name+' has no sign inversion or rebound');
      stable(frames,name);
    }
    assert(Math.abs((30-rest(negative))-(rest(fast)-30))<=1.05, 'signed symmetry for equal wheel bursts');
    assert(Math.abs((30-rest(negativeNotches))-(rest(positiveNotches)-30))<=1.05, 'signed symmetry for four notches');
    const positiveInputs=results.find(r=>r.name==='positive 4x110').inputs.filter(e=>e.type==='wheel');
    const between=positiveNotches.filter(s=>s.at>positiveInputs[1].at+12 && s.at<positiveInputs[2].at-5);
    assert(between.length && between.some(s=>s.offset>positiveInputs[1].beforeOffset+1.07),
      'coast moves on display frames BETWEEN fast packets, no stationary release plateau');
    assert(positiveNotches.some(s=>s.at>positiveInputs.at(-1).at+35 && s.offset>34.2), '110px burst continues after last input');
    const afterNotches=positiveNotches.filter(s=>s.at>positiveInputs.at(-1).at+30);
    assert(afterNotches.slice(1).every((s,i)=>s.offset>=afterNotches[i].offset-.025), 'positive coast never reverses at detent');
    for(const [name,frames,sign] of [['positive 4x110',positiveNotches,1],['negative 4x110',negativeNotches,-1]]) {
      const last=results.find(r=>r.name===name).inputs.filter(e=>e.type==='wheel').at(-1).at;
      const rate=(low,high) => {
        const range=frames.filter(s=>s.at>last+low && s.at<last+high);
        return sign*(range.at(-1).offset-range[0].offset)/(range.at(-1).at-range[0].at);
      };
      const early=rate(25,115),late=rate(190,310);
      assert(early>.002 && late>=-.0002 && early>late*1.3,name+' signed speed decays without re-acceleration');
    }
    assert(Math.abs(rest(slow)-32)<.03 && Math.abs(rest(isolated)-31)<.03, 'slow/isolated rest accurately');
    const spans = ['fast 4x55','same elapsed 2x110'].map(name => {
      const inputs=results.find(r=>r.name===name).inputs.filter(e=>e.type==='wheel');
      return inputs.at(-1).at-inputs[0].at;
    });
    assert(Math.abs(spans[0]-spans[1])<75,'real input durations comparable across packet partitions');
    assert(Math.abs(rest(fast)-rest(partition))<=1.1, 'equal displacement and elapsed time similar across packet counts');
    assert(rest(taper)===32 && rest(negativeTaper)===28, 'both signed native tapers capture the nearest velocity-derived rest, not the first peak');
    for(const [name,frames,sign] of [['positive 8x55',positiveStream,1],['negative 8x55',negativeStream,-1],
        ['native tail 12 packets',nativeTail,1],['positive 4x110',positiveNotches,1],['negative 4x110',negativeNotches,-1]]) {
      const inputs=results.find(r=>r.name===name).inputs.filter(e=>e.type==='wheel');
      assert.equal(inputs.length,name.includes('12')?12:name.includes('8x')?8:4);
      for(let i=0;i<inputs.length;i++) {
        const until=inputs[i+1]?.at ?? inputs[i].at+65;
        const after=frames.filter(s=>s.at>inputs[i].at && s.at<until);
        assert(after.length>0 && after.every(s=>sign*(s.offset-inputs[i].beforeOffset)>-.035),
          name+' same-sign packet '+i+' must never rewind drawn position');
      }
      assert(sign*(rest(frames)-30)>0 && sign*(rest(frames)-30)<=
        inputs.reduce((sum,e)=>sum+Math.abs(e.delta),0)/110+3,name+' bounded signed rest');
      const tail=frames.filter(s=>s.at>inputs.at(-1).at+20);
      assert(tail.slice(1).every((s,i)=>sign*(s.offset-tail[i].offset)>=-.025),
        name+' cannot reverse on native tail or terminal detent');
    }
    const fastInputs=results.find(r=>r.name==='fast 4x55').inputs.filter(e=>e.type==='wheel');
    assert(fast.some(s=>s.at>fastInputs.at(-1).at+100 && s.offset>32.2), 'rendered labels travel past the 220px direct budget after input');
    const coastFrames=fast.filter(s=>s.at>fastInputs.at(-1).at+110);
    assert(coastFrames.slice(1).every((s,i)=>s.offset>=coastFrames[i].offset-.025), 'coast and snap never rebound');
    assert(rest(oversized)<=38.03, 'oversize cannot imply more than capped 880px, no boost');
    assert(Math.abs(rest(large)-38)<.03, '880px traverses eight stations without isolated velocity');
    assert(new Set(large.map(s=>s.i)).size>=8, 'large isolated packet traverses intermediate labels');
    assert(Math.abs(rest(reduced)-32)<.03 && new Set(reduced.map(s=>s.i)).size<=3, 'Reduced Motion direct');
    assert(Math.abs(rest(reducedLarge)-38)<.03 && new Set(reducedLarge.map(s=>s.i)).size===2,
      'Reduced Motion large notch jumps directly, without catch-up or coast');
    for(const sign of [-1,1]) for(const fraction of [.34,.66]) {
      const name=`gentle wheel ${sign} ${fraction}`;
      // Invert the calibrated first-detent curve: these are still exactly
      // .34/.66 fractional positions, not a relaxed outcome after calibration.
      const pixels=fraction<=.60 ? fraction*32/.60 : 32+(fraction-.60)*78/.40;
      const frames=await wheel(browser,name,[sign*pixels],0);
      const input=results.at(-1).inputs.findLast(e=>e.type==='wheel');
      const first=frames.filter(s=>s.at>=input.at).slice(0,2);
      assert(first.length===2 && first.some(s=>sign*(s.offset-30)>.025),name+' first two paints respond to trusted input');
      if(fraction>.5) captureFrames(name,frames,input.at,Math.round(30+sign*fraction),first[0].offset);
      else {
        const after=frames.filter(s=>s.at>input.at+450 && s.at<input.at+850);
        assert(after.length>=4 && after.some(s=>sign*(s.offset-30)>.02) &&
          sign*(after.at(-1).offset-30)<sign*(after[0].offset-30),name+' below-midpoint capture follows accumulated intent');
        assert(Math.abs(rest(frames)-30)<.025,name+' below-midpoint rest');
      }
      await fractionalDrag(browser,`held ${sign} ${fraction} ${sign<0?'touch':'mouse'}`,fraction,sign,sign<0);
    }
    const fastMouse=await flick(browser,'fast mouse flick',false,false);
    const slowMouse=await flick(browser,'held mouse release',true,false);
    const fastTouch=await flick(browser,'fast emulated touch flick',false,true);
    const slowTouch=await flick(browser,'held emulated touch release',true,true);
    assert(rest(fastMouse)>rest(slowMouse)+.5 && rest(fastTouch)>rest(slowTouch)+.5,'flicks coast, held releases do not');
    assert(Math.abs(rest(slowMouse)-31)<.03 && Math.abs(rest(slowTouch)-31)<.03);
    for(const [name,frames] of [['fast mouse flick',fastMouse],['fast emulated touch flick',fastTouch]]) {
      const last=results.find(r=>r.name===name).inputs.filter(e=>e.type==='pointerup').at(-1);
      assert(frames.some(s=>s.at>last.at+40 && s.offset>31.25),name+' keeps moving after real release');
    }
    // Reversing with a tiny packet must move from the drawn arc on its very
    // first frame, even if the old coast/large-packet catch-up was in flight.
    for(const first of ['coast','large 220','large 221','large 880','mixed 110+221']) {
      const run=await setup(browser);
      if(first==='coast') for(let i=0;i<4;i++) { await run.page.mouse.wheel(0,55); await sleep(25); }
      else if(first==='mixed 110+221') { await run.page.mouse.wheel(0,110); await run.page.mouse.wheel(0,221); }
      else await run.page.mouse.wheel(0,Number(first.split(' ')[1]));
      await sleep(first==='coast'?45:40);
      await run.page.mouse.wheel(0,-8);
      const before=await run.page.evaluate(() => window.inputs.filter(e=>e.type==='wheel').at(-1).beforeOffset);
      await run.page.waitForFunction(before => window.samples.some(s=>s.at>window.inputs.filter(e=>e.type==='wheel').at(-1).at && s.offset < before-.025),before,{timeout:500});
      const after=await run.page.evaluate(() => Math.min(...window.samples.filter(s=>s.at>window.inputs.filter(e=>e.type==='wheel').at(-1).at).map(s=>s.offset)));
      assert(after<before-.025,first+' tiny reverse immediately cancels stale target');
      await sleep(560);
      const frames=await finish(run,'tiny reverse '+first);
      assert(frames.filter(s=>s.at>frames.at(-1).at-200).every(s=>s.offset<=Math.ceil(before)+.025));
    }
    const canceled=await setup(browser);
    const cdp=await canceled.page.context().newCDPSession(canceled.page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...canceled.pos,id:1}]});
    for(let i=1;i<=4;i++) { await sleep(24); await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:canceled.pos.x,y:canceled.pos.y-76*i/4,id:1}]}); }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await cdp.detach();
    await sleep(750);
    const canceledFrames=await finish(canceled,'canceled touch'); stable(canceledFrames,'canceled touch');
    assert.equal(rest(canceledFrames),31,'pointercancel snaps without flick velocity');
    assert(results.at(-1).inputs.some(e=>e.type==='pointercancel' && e.pointer==='touch'));
    // Interrupt the coast with a real close and a live Reduced Motion toggle.
    for (const interruption of ['close','reduce','step']) {
      const run=await setup(browser);
      for(let i=0;i<4;i++) { await run.page.mouse.wheel(0,55); await sleep(25); }
      await sleep(140);
      if(interruption==='close') await run.page.locator('[data-wheel-toggle]').click();
      if(interruption==='reduce') {
        await run.page.emulateMedia({reducedMotion:'reduce'});
        await run.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      if(interruption==='step') { await run.page.locator('#archive-wheel').focus(); await run.page.keyboard.press('ArrowDown'); }
      const id=await run.page.locator('[data-wheel-work].is-selected').getAttribute('data-work-id');
      await sleep(650);
      assert.equal(await run.page.locator('[data-wheel-work].is-selected').getAttribute('data-work-id'),id,interruption+' clears motion debt');
      await finish(run,'interrupt '+interruption);
    }
    console.log(results.map(r=>`${r.name}: ${r.samples[0].offset.toFixed(2)} -> ${rest(r.samples).toFixed(2)} (${r.samples.length} frames)`).join('\n'));
  } finally {
    await browser.close();
    if(evidence) fs.writeFileSync(evidence,JSON.stringify(results,null,2));
  }
})().catch(error => { console.error(error); process.exitCode=1; });
