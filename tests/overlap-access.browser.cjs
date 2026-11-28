// Real-data fallback for overlapped Points; no synthetic records or external navigation.
// TH_PREVIEW_URL, CHROME_PATH, PLAYWRIGHT_CORE; optional TH_OVERLAP_EVIDENCE_DIR under .local/.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const url = process.env.TH_PREVIEW_URL || 'http://127.0.0.1:4279/archive-rebuild/';
const evidence = process.env.TH_OVERLAP_EVIDENCE_DIR;
const artifacts = [];
const targets = [
  {index:0, title:'The Starting Points (album)', href:'https://www.youtube.com/watch?v=mI2bLEBQrK0'},
  {index:1, title:'夢日記', href:'https://www.youtube.com/watch?v=d_eUugLDV5Q'},
];
const settle = page => page.waitForTimeout(600);
const labelFor = (page, work) => page.locator(`[data-wheel-work][data-work-id=${JSON.stringify(work.id)}]`);
const selected = page => page.locator('[data-wheel-work].is-selected').getAttribute('data-work-id');
async function detail(page, work) {
  await page.locator('#trial-detail').waitFor({state:'visible'});
  assert.equal(await page.locator('#trial-detail-title').textContent(),work.title);
  assert.equal(await page.locator('#trial-detail-link').getAttribute('href'),work.href);
  assert.equal(await page.locator('#point-preview').isVisible(),false);
}
async function undimmed(page) {
  assert.equal(await page.locator('#trial-detail').isVisible(),false);
  assert.equal(await page.locator('#map-target').evaluate(n=>getComputedStyle(n).filter),'none');
}
async function keyboardAccess(page, works, context) {
  await page.locator('[data-trial-panel="tag"]').focus();
  const reached = [];
  for(let tabs=0; tabs<220 && reached.length<works.length; tabs++) {
    await page.keyboard.press('Tab');
    const id=await page.evaluate(()=>document.activeElement?.closest('[data-work]')?.dataset.workId);
    const work=works.find(w=>w.id===id);
    if(!work || reached.includes(id)) continue;
    reached.push(id);
    assert.equal(await page.locator('#point-preview-title').textContent(),work.title);
    assert.equal(await page.locator('[data-preview-link]').getAttribute('href'),work.href);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('[data-preview-link]').evaluate(n=>n===document.activeElement),true);
    // Activate the real card URL, fulfilled locally so no outward request is made.
    await context.route(work.href,route=>route.fulfill({status:200,body:'Verified real destination locally.'}));
    const opened=page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    const popup=await opened;
    await popup.waitForLoadState();
    assert.equal(popup.url(),work.href);
    await popup.close();
    await page.bringToFront();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement?.closest('[data-work]')?.dataset.workId),work.id);
    assert.equal(await page.locator('#point-preview').isVisible(),false);
  }
  assert.deepEqual(reached,works.map(w=>w.id),'Tab reaches each exact overlapped Point and its card');
}
async function activateLabel(page, work, touch) {
  const label=labelFor(page,work);
  await page.evaluate(()=>{window.overlapEvents=[];});
  // No focus()/Enter(), force, dispatchEvent, or hand-picked safe coordinate:
  // exercise the real label tap/click that previously selected its neighbour.
  if(touch) await label.tap({timeout:3500}); else await label.click({timeout:3500});
  await detail(page,work);
  const events=await page.evaluate(()=>window.overlapEvents);
  assert.deepEqual(events.map(e=>[e.type,e.id]),[['pointerdown',work.id],['click',work.id]],'down and click both reach the intended label');
  assert.equal(await selected(page),work.id);
  if(touch) await page.locator('#trial-detail-close').tap(); else await page.keyboard.press('Escape');
  await settle(page);
  assert.equal(await selected(page),work.id,'closing detail retains exact Wheel selection');
  assert.equal(await label.evaluate(n=>n===document.activeElement),true,'close returns focus to originating label');
  assert.equal(await page.locator('[data-wheel-toggle]').getAttribute('aria-expanded'),'true');
  await undimmed(page);
}
async function swipe(page) {
  const pos=await page.evaluate(()=>{
    const dock=matchMedia('(max-width:600px) and (orientation:portrait)').matches;
    if(dock) {
      const r=document.querySelector('[data-wheel-work][aria-current="true"]').getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2,dock};
    }
    const track=document.querySelector('[data-trial-track]'), m=track.getScreenCTM();
    for(const fraction of [.35,.25,.65,.75,...Array.from({length:101},(_,i)=>i/100)]) {
      const p=track.getPointAtLength(track.getTotalLength()*fraction).matrixTransform(m);
      if(p.x>12 && p.x<innerWidth-12 && p.y>150 && document.elementFromPoint(p.x,p.y)===track) return {x:p.x,y:p.y};
    }
  });
  assert(pos,'exposed real arc accepts swipe');
  const cdp=await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pos.x,y:pos.y,id:1}]});
    for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{
      type:'touchMove',touchPoints:[{x:pos.x-(pos.dock?76*i/8:0),y:pos.y-(pos.dock?0:76*i/8),id:1}],
    });
    // Intentional held release: this legacy test asserts exactly one station.
    await page.waitForTimeout(160);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  } finally { await cdp.detach(); }
  await settle(page);
  await undimmed(page);
}
async function filter(page, touch, year) {
  const activate=async locator=>touch?locator.tap():locator.click();
  const trigger=page.locator(`[data-trial-panel="${year?'year':'tag'}"]`);
  await activate(trigger);
  if(year) await activate(page.locator('[data-filter-year="2022"]'));
  else await activate(page.locator('[data-filter-tag="arranged"]'));
  const sets=await page.evaluate(()=>({
    map:[...document.querySelectorAll('#map-target [data-work]:not(.is-inactive)')].map(n=>n.dataset.workId).sort(),
    wheel:[...document.querySelectorAll('[data-wheel-work]:not(.is-hidden)')].map(n=>n.dataset.workId).sort(),
    total:document.querySelectorAll('[data-wheel-work]').length,
  }));
  assert(sets.map.length>1 && sets.map.length<sets.total,'real nontrivial filtered subset');
  assert.deepEqual(sets.map,sets.wheel,'Tag / Year share the exact Point and Wheel set');
  // Repeat trigger closes without requiring a touch-only dismissal gesture.
  await activate(trigger);
  const toggle=page.locator('[data-wheel-toggle]');
  if(await toggle.getAttribute('aria-expanded')==='false') await activate(toggle);
  await settle(page);
  return sets.map;
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
  try {
    for(const [width,touch,motion] of [[320,true,'reduce'],[390,true,'reduce'],[1440,false,'reduce'],[320,true,'no-preference'],[390,true,'no-preference']]) {
      const context=await browser.newContext({viewport:{width,height:width===1440?900:844},isMobile:touch,hasTouch:touch,reducedMotion:motion});
      const page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);
      await page.locator('#start-overlay').click();
      await page.waitForFunction(()=>!document.body.classList.contains('is-blurred'));
      const works=[];
      for(const target of targets) {
        const data=await page.locator(`#map-target [data-work][data-work-id$="-${target.index}"]`).evaluate(n=>{
          const point=n.querySelector('[data-point-float]'), r=point.getBoundingClientRect();
          return {id:n.dataset.workId,title:n.dataset.tooltipTitle,href:point.href,
            hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-work]')?.dataset.workId};
        });
        assert.equal(data.title,target.title);
        assert.equal(data.href,target.href);
        if(touch && motion==='reduce') assert.notEqual(data.hit,data.id,'real Point-on-Point overlap remains, not shifted away');
        works.push(data);
      }
      await keyboardAccess(page,works,context);
      const toggle=page.locator('[data-wheel-toggle]');
      if(touch) await toggle.tap(); else await toggle.click();
      await settle(page);
      await page.evaluate(()=>{
        window.overlapEvents=[];
        for(const type of ['pointerdown','click']) document.addEventListener(type,e=>{
          const n=e.target.closest('[data-wheel-work]');
          if(n) window.overlapEvents.push({type,id:n.dataset.workId,x:e.clientX,y:e.clientY});
        },true);
      });
      const name=`${width}-${touch?'touch':'mouse'}-${motion}`;
      if(evidence) artifacts.push([`wheel-${name}.png`,await page.screenshot()]);
      for(const work of [works[0],works[1],works[0]]) await activateLabel(page,work,touch);
      if(touch) {
        await swipe(page);
        assert.equal(await selected(page),works[1].id,'real swipe advances to the exact next work');
      } else {
        await page.locator('#archive-wheel').focus();
        await page.keyboard.press('ArrowDown');
        assert.equal(await selected(page),works[1].id);
      }
      await activateLabel(page,works[1],touch);
      const filtered=await filter(page,touch,false);
      assert(works.every(w=>filtered.includes(w.id)),'arranged retains both real targets');
      for(const work of [works[0],works[1],works[0]]) await activateLabel(page,work,touch);
      const yearSet=await filter(page,touch,true);
      assert(!yearSet.includes(works[0].id) && yearSet.includes(works[1].id));
      assert.equal(await labelFor(page,works[0]).isVisible(),false,'excluded work is not actionable');
      await page.locator('#archive-wheel').focus();
      await page.keyboard.press('ArrowUp'); // first remaining work, without explicit activation
      assert.equal(await selected(page),works[1].id);
      await undimmed(page);
      await activateLabel(page,works[1],touch);
      if(evidence) artifacts.push([`result-${name}.json`,JSON.stringify({works,filteredCount:filtered.length,yearCount:yearSet.length,errors},null,2)]);
      assert.deepEqual(errors,[]);
      console.log(`${name}: exact real label down/click, detail title/href, close/focus/selection, Tab/card URL, ${touch?'swipe':'arrows'}, Tag + Year`);
      await context.close();
    }
  } finally { await browser.close(); }
  // Avoid dev reloads during interactions by flushing evidence only after closing Chrome.
  if(evidence) {
    assert(path.resolve(evidence).includes(`${path.sep}.local${path.sep}`),'evidence belongs under .local/');
    fs.mkdirSync(evidence,{recursive:true});
    for(const [name,content] of artifacts) fs.writeFileSync(path.join(evidence,name),content);
  }
})().catch(e=>{console.error(e);process.exit(1);});
