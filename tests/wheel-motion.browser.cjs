// Real Chrome input and frame reads on the local rebuild; sandbox remains enabled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const evidence = process.env.TH_WHEEL_EVIDENCE_DIR;
const runs = [];
const artifacts = [];
if (evidence) assert(path.resolve(evidence).startsWith(path.resolve('.local') + path.sep), 'local evidence only');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const url = new URL(process.env.TH_PREVIEW_URL || 'http://127.0.0.1:4287/archive-rebuild/');
assert(['127.0.0.1','localhost'].includes(url.hostname), 'local preview only');

async function wheelAtTrack(page) {
  for (let i=12; i<88; i+=4) {
    const position = await page.evaluate(i => {
      const track = document.querySelector('[data-trial-track]');
      const p = track.getPointAtLength(track.getTotalLength()*i/100).matrixTransform(track.getScreenCTM());
      return {x:p.x,y:p.y};
    }, i);
    // CDP wheel coordinates are integer pixels; verify *that* hit, not the
    // floating SVG point which may sit just across a Point hit boundary.
    position.x = Math.floor(position.x); position.y = Math.floor(position.y);
    await page.mouse.move(position.x,position.y);
    await page.waitForTimeout(45); // let real hover overlays settle before verifying the hit
    if (await page.evaluate(p => document.elementFromPoint(p.x,p.y)?.hasAttribute('data-trial-track'),position)) return;
  }
  assert.fail('open arc retains a real scroll hit target after hover');
}

async function trace(page) {
  await page.evaluate(() => {
    const wheel = document.querySelector('#archive-wheel');
    const arc = wheel.querySelector('svg');
    const labels = [...wheel.querySelectorAll('[data-wheel-work]')];
    if (window.wheelRegressionTrace) window.wheelRegressionTrace.running = false;
    const state = window.wheelRegressionTrace = { frames:[], running:true };
    (window.wheelRegressionTraces ??= []).push(state);
    const sample = () => {
      if (!state.running) return;
      const label = labels.find(e => e.classList.contains('is-selected') && !e.classList.contains('is-hidden'));
      const rect = arc.getBoundingClientRect();
      state.frames.push({
        selected:labels.indexOf(label),
        arc:[rect.x,rect.y,rect.width,rect.height], open:!wheel.classList.contains('is-collapsed'),
        point:document.querySelector('#map-target [data-work].is-selected')?.dataset.workId,
        pointTitle:document.querySelector('#map-target [data-work].is-selected')?.dataset.tooltipTitle,
        card:document.querySelector('#point-preview-title').textContent,
        cardVisible:!document.querySelector('#point-preview').hidden,
        cardHref:document.querySelector('[data-preview-link]').href,
        pointHref:document.querySelector('#map-target [data-work].is-selected a')?.href,
        id:label?.dataset.workId,
        labels:labels.flatMap((e,i) => {
          if (e.style.visibility !== 'visible' || e.classList.contains('is-hidden')) return [];
          const style = getComputedStyle(e);
          if (Number(style.opacity) <= .15) return [];
          const transform = new DOMMatrix(style.transform);
          return [{i,y:transform.m42}];
        }),
      });
      requestAnimationFrame(sample);
    };
    sample();
  });
}

async function collect(page) {
  return page.evaluate(() => {
    window.wheelRegressionTrace.running = false;
    return window.wheelRegressionTrace.frames;
  });
}

const selectedIndices = frames => [...new Set(frames.map(f => f.selected))];
function assertCoherent(frames, diagnostic) {
  assert(frames.length>1, diagnostic+' has frame samples');
  assert(frames.every(f=>f.open && f.arc.every((number,index)=>Math.abs(number-frames[0].arc[index])<.01)),
    diagnostic+' keeps the same arc and remains open');
  assert(frames.every(f=>f.id===f.point && f.cardVisible && f.card.trim()===f.pointTitle?.trim() && f.cardHref===f.pointHref),
    diagnostic+' keeps the station, selected Point and matching Card together');
}

async function openPreview(browser, width, reducedMotion) {
  const context = await browser.newContext({viewport:{width,height:900},reducedMotion,serviceWorkers:'block'});
  const run = {width,reducedMotion,navigations:[],blockedRequests:[],isolatedWebSockets:[]};
  runs.push(run);
  // Local Chrome profiles/artifacts live inside the checkout and can cause Vite
  // full reloads. Isolate HMR in this disposable test context, not on the server.
  await context.routeWebSocket('**/*', socket => { run.isolatedWebSockets.push(socket.url()); });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === url.origin) return route.continue();
    run.blockedRequests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  run.page = page;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) run.navigations.push(frame.url()); });
  await page.addInitScript(() => {
    window.wheelRegressionInputs = [];
    document.addEventListener('wheel', event => {
      const input = {at:performance.now(),trusted:event.isTrusted,delta:event.deltaY,
        target:event.target.closest?.('[data-trial-track],[data-wheel-work]')?.outerHTML.slice(0,180),prevented:false};
      window.wheelRegressionInputs.push(input);
      input.prevented = event.defaultPrevented;
    });
  });
  await page.goto(url.href);
  await page.locator('#start-overlay').click();
  await page.waitForFunction(()=>!document.body.classList.contains('is-blurred'));
  await page.locator('[data-wheel-toggle]').click();
  await page.locator('#archive-wheel').focus();
  return page;
}

async function shortFilter(page) {
  const filter=await page.evaluate(()=>{
    const count = new Map();
    const nodes = document.querySelectorAll('#map-target [data-work]');
    for (const node of nodes) {
      if (!node.dataset.year) continue;
      for (const tag of node.dataset.tags.split(',').filter(Boolean)) {
        const key=JSON.stringify([tag,node.dataset.year]);
        count.set(key,(count.get(key)||0)+1);
      }
    }
    const buttons = new Set([...document.querySelectorAll('[data-filter-tag]')].map(n=>n.dataset.filterTag));
    const group=[...count].find(([key,size])=>size===3 && buttons.has(JSON.parse(key)[0]));
    return group && JSON.parse(group[0]);
  });
  assert(filter, 'one real three-work Tag/Year intersection');
  await page.locator('[data-trial-panel="tag"]').click();
  await page.locator('[data-filter-tag='+JSON.stringify(filter[0])+']').click();
  await page.locator('[data-trial-panel="year"]').click();
  await page.locator('[data-filter-year='+JSON.stringify(filter[1])+']').click();
  await page.keyboard.press('Escape');
  const toggle=page.locator('[data-wheel-toggle]');
  if (await toggle.getAttribute('aria-expanded')==='false') await toggle.click();
  await page.locator('#archive-wheel').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  const ids = await page.locator('[data-wheel-work]:not(.is-hidden)').evaluateAll(nodes=>nodes.map(n=>n.dataset.workId));
  assert.equal(ids.length,3);
  await page.waitForTimeout(360);
  await wheelAtTrack(page);
  await trace(page);
  for(let i=0;i<3;i++) await page.mouse.wheel(0,880);
  await page.waitForFunction(id=>document.querySelector('[data-wheel-work].is-selected')?.dataset.workId===id,ids[2]);
  await page.mouse.wheel(0,-110);
  await page.waitForFunction(id=>document.querySelector('[data-wheel-work].is-selected')?.dataset.workId===id,ids[1],{timeout:900});
  await page.waitForTimeout(210);
  const frames=await collect(page);
  assertCoherent(frames,'short filtered burst and reversal');
  assert(frames.every(f=>ids.includes(f.id)), 'only real filtered titles can occupy the station');
  const last=frames.at(-1);
  assert.equal(last.id,ids[1],'reverse after saturated endpoint changes work once');
  assert(last.labels.length>=2 && last.labels.length<=3,'no blank arc or repeated/fake titles');
}

async function captureRun(run) {
  if (run.captured) return;
  const result = await run.page.evaluate(() => {
    for (const trace of window.wheelRegressionTraces ?? []) trace.running = false;
    return {traces:window.wheelRegressionTraces?.map(trace=>trace.frames),inputs:window.wheelRegressionInputs};
  });
  Object.assign(run,result);
  assert(run.inputs.length && run.inputs.every(input=>input.trusted && input.target && input.prevented),
    'every scroll packet is real, hit-tests to the Wheel and is consumed');
  if (evidence) artifacts.push([`wheel-${run.width}-${run.reducedMotion}.png`,await run.page.screenshot()]);
  run.captured = true;
}

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true,chromiumSandbox:true});
  try {
    for(const width of [390,1440]){
      const page=await openPreview(browser,width,'no-preference');
      const errors=[]; page.on('pageerror', e=>errors.push(e.message));
      for(let i=0;i<12;i++) await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(450);
      await wheelAtTrack(page);
      await trace(page);
      await page.mouse.wheel(0,880);
      await page.waitForFunction(()=>document.querySelectorAll("[data-wheel-work]")[20].classList.contains("is-selected"),null,{timeout:2000});
      await page.waitForTimeout(90);
      const frames=await collect(page);
      const indices=selectedIndices(frames);
      const counts=frames.map(f=>f.labels.length);
      const overlap=frames.slice(1).every((f,i)=>f.labels.filter(a=>frames[i].labels.some(b=>a.i===b.i)).length>=2);
      const spans=frames.map(f=>Math.max(...f.labels.map(e=>e.y))-Math.min(...f.labels.map(e=>e.y)));
      assertCoherent(frames,width+' burst');
      assert.equal(indices.at(-1),20);
      assert.deepEqual(indices,[12,13,14,15,16,17,18,19,20], 'burst must move through intermediate stations, not replace a title');
      assert(counts.every(n=>n>=2) && overlap, 'adjacent frames share multiple rendered titles');
      assert(spans.every(span=>span>=.50*spans[0]), 'positions must not collapse toward the hub');
      // A real stream of rapid small wheel packets, reversed while the previous
      // target is ahead. No second artificial event stream or selection stores.
      await trace(page);
      for (let i=0;i<6;i++) await page.mouse.wheel(0,55);
      const atReverse=await page.locator('[data-wheel-work].is-selected').getAttribute('data-work-id');
      await page.mouse.wheel(0,-330);
      await page.waitForTimeout(530);
      const reverse=await collect(page);
      assertCoherent(reverse,width+' stream reversal');
      const pivot=reverse.findLastIndex(f=>f.id===atReverse);
      assert(pivot>=0 && reverse.at(-1).selected<reverse[pivot].selected, 'reverse must not pay back queued forward motion');
      if(width===390) await shortFilter(page);
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({width,indices,minVisible:Math.min(...counts),minSpan:Math.min(...spans),initialSpan:spans[0],overlap,stream: selectedIndices(reverse),shortFilter:width===390}));
      await captureRun(runs.at(-1));
      await page.context().close();
    }
    const reduced=await openPreview(browser,390,'reduce');
    await reduced.keyboard.press('ArrowDown');
    await wheelAtTrack(reduced);
    // Hovering near the compact track can preview a Point. Re-select the
    // starting station by keyboard after the hover settles, before tracing.
    await reduced.keyboard.press('ArrowDown');
    await reduced.keyboard.press('ArrowUp');
    await reduced.waitForFunction(() => document.querySelector('#point-preview-title')?.textContent?.trim() ===
      document.querySelector('#map-target [data-work].is-selected')?.dataset.tooltipTitle?.trim());
    await trace(reduced);
    await reduced.mouse.wheel(0,550);
    await reduced.waitForTimeout(260);
    const reducedFrames=await collect(reduced);
    assertCoherent(reducedFrames,'reduced motion');
    assert.deepEqual(selectedIndices(reducedFrames),[1,6],'Reduced Motion has no animated stepping');
    console.log('reduced motion: [1,6], arc and selection coherent');
    await captureRun(runs.at(-1));
    assert(runs.every(run => run.navigations.length === 1), 'no navigation/reload during input checks');
  } finally {
    for (const run of runs) if (!run.page.isClosed()) await captureRun(run).catch(() => {});
    await browser.close();
    // New evidence files can trigger dev-server reloads; flush after closing.
    if (evidence) {
      fs.mkdirSync(evidence,{recursive:true});
      fs.writeFileSync(path.join(evidence,'wheel-motion.json'),JSON.stringify(runs.map(({page,...run})=>run),null,2));
      for (const [name,bytes] of artifacts) fs.writeFileSync(path.join(evidence,name),bytes);
    }
  }
})().catch(e=>{console.error(e);process.exitCode=1});
