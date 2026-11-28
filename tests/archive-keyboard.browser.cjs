// Native Chrome keyboard only on the built /archive-rebuild/. No server or live origins.
// CHROME_PATH, PLAYWRIGHT_CORE, TH_DIST (default dist), optional TH_KEYBOARD_EVIDENCE_DIR under .local.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const dist = path.resolve(process.env.TH_DIST || 'dist');
const evidence = path.resolve(process.env.TH_KEYBOARD_EVIDENCE_DIR || '.local/ws-browser/keyboard');
assert(evidence.startsWith(path.resolve('.local') + path.sep), 'local evidence only');
const routeUrl = process.env.TH_PREVIEW_URL || 'http://127.0.0.1:4298/archive-rebuild/';
const preview = new URL(routeUrl);
assert(['127.0.0.1','localhost'].includes(preview.hostname) && preview.pathname === '/archive-rebuild/', 'private rebuild only');
const origin = preview.origin;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css',
  '.svg':'image/svg+xml','.ico':'image/x-icon','.mp3':'audio/mpeg'};
const runs = [];

async function scenario(browser, config) {
  const {width, touch, motion} = config;
  const result = {...config, steps:[], entrance:[], external:[], errors:[], popups:0};
  runs.push(result);
  const context = await browser.newContext({viewport:{width,height:touch ? 844 : 900},
    isMobile:touch,hasTouch:touch,reducedMotion:motion,serviceWorkers:'block'});
  try {
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        result.external.push(url.href);
        return route.abort();
      }
      const file = path.resolve(dist, '.' + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : ''));
      if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        return route.fulfill({status:404,body:''});
      }
      return route.fulfill({path:file,contentType:mime[path.extname(file)]});
    });
    await context.addInitScript(() => {
      window.testInputs = [];
      for (const type of ['keydown','pointerdown','click']) {
        document.addEventListener(type, e => window.testInputs.push({type,key:e.key,shift:e.shiftKey,
          detail:e.detail,target:e.target.id,trusted:e.isTrusted}), true);
      }
    });
    const page = await context.newPage();
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('popup', () => result.popups++);
    const response = await page.goto(routeUrl);
    assert.equal(response.status(), 200);
    const active = () => page.evaluate(() => {
      const n = document.activeElement;
      const p = n.closest('#map-target [data-work]');
      return {node:n.tagName,id:n.id,panel:n.dataset.trialPanel,tag:n.dataset.filterTag,
        year:n.dataset.filterYear,point:p?.dataset.workId,preview:n.hasAttribute('data-preview-link'),
        wheel:n.hasAttribute('data-wheel-toggle'),inert:!!n.closest('[inert]'),
        covered:document.body.classList.contains('is-blurred'),inactive:!!p?.classList.contains('is-inactive')};
    });
    const key = async (name, phase) => {
      await page.keyboard.press(name);
      const state = await active();
      result.steps.push({key:name,phase,...state});
      return state;
    };
    const tabUntil = async (match, phase, limit) => {
      for (let i = 1; i <= limit; i++) {
        const state = await key('Tab', phase);
        assert(!state.inert && !state.inactive, `${phase}: excluded content received focus`);
        if (match(state)) return {i,state};
      }
      return null;
    };
    const overlay = page.locator('#start-overlay');
    const tag = page.locator('#trial-tag'), year = page.locator('#trial-year');
    const tagTrigger = page.locator('[data-trial-panel="tag"]');
    const detail = page.locator('#trial-detail');
    const assertClosed = async (panel, label) => {
      const state = await panel.evaluate(el => ({hidden:el.hidden, inert:el.inert,
        ariaHidden:el.getAttribute('aria-hidden'), pointerEvents:getComputedStyle(el).pointerEvents}));
      if (motion === 'reduce') assert(state.hidden,`${label}: reduced-motion close is immediate`);
      else assert(state.hidden || (state.inert && state.ariaHidden === 'true' && state.pointerEvents === 'none'),
        `${label}: exit must immediately leave accessibility and input`);
      await panel.waitFor({state:'hidden',timeout:250});
    };
    const backgroundOnly = a => a.id !== 'start-overlay' && a.node !== 'BODY' && a.node !== 'HTML';

    // Separate pre-entry scan so the main path is fresh Tab → Enter, no reverse/pointer assist.
    for (const name of ['Tab','Tab','Tab','Shift+Tab','Shift+Tab','Shift+Tab']) {
      result.entrance.push(await key(name,'covered'));
    }
    assert.equal(result.entrance[0].id, 'start-overlay');
    assert(result.entrance.every(a => a.covered));
    await page.reload();
    assert.equal((await key('Tab','entrance')).id, 'start-overlay');
    await key(touch ? 'Space' : 'Enter','entrance');
    await page.waitForFunction(() => !document.body.classList.contains('is-blurred'));
    await key('Tab','stop');
    assert(await page.locator('[data-archive-stop]').evaluate(el=>el===document.activeElement),'first post-boot stop is Stop/Resume');
    const launch = await tabUntil(a => a.panel === 'tag','forward-to-filter',4);
    result.forwardToFilter = launch?.i ?? null;
    assert(launch, 'Tag is reachable by native tabs after entrance');
    assert.deepEqual(result.entrance.filter(backgroundOnly), [], 'covered background received native focus');
    await overlay.waitFor({state:'hidden'});

    const pressed = () => page.locator('[data-filter-options] [aria-pressed="true"]').evaluateAll(nodes=>nodes.map(n=>n.textContent.trim()));
    const open = async (kind, panel) => {
      await key('Enter',`open-${kind}`);
      await panel.waitFor({state:'visible'});
    };
    const exit = async (kind, panel) => {
      await key('Escape',`close-${kind}`);
      assert.equal((await active()).panel,kind);
      await assertClosed(panel,`${kind} Escape`);
    };
    await open('tag',tag);
    assert.equal(await tagTrigger.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(await pressed(), ['All Tags','All Years']);
    assert.equal((await key('Tab','filter-first')).tag, '__all__');
    const option = async (kind, value, phase) => {
      const found = await tabUntil(a => a[kind] === value,phase,70);
      assert(found, `${kind} ${value} unreachable by forward Tab`);
      const state = await key('Space',phase);
      assert.equal(state[kind], value, 'activating filter must retain focus');
    };
    await option('tag','commercial','choose-tag');
    assert.deepEqual(await pressed(), ['commercial','All Years']);
    await exit('tag',tag);
    assert.equal((await key('Tab','to-year')).panel,'year');
    await open('year',year);
    await option('year','2023','choose-year');
    assert.deepEqual(await pressed(), ['commercial','2023']);
    const points = page.locator('#map-target [data-work]');
    const excluded = page.locator('#map-target [data-work][inert]');
    const total = await points.count();
    assert(total > 0);
    assert.equal(await excluded.count(), total, 'real fixture has no commercial works from 2023');
    await exit('year',year);
    assert.deepEqual(await pressed(), ['commercial','2023'], 'closing preserves pressed filters');

    // Go backwards through the separate Tag and Setting launchers.
    assert.equal((await key('Shift+Tab','audio')).panel, 'tag');
    assert.equal((await key('Shift+Tab','audio')).panel, 'audio');
    await key('Enter','audio');
    const audio = page.locator('#trial-audio');
    await audio.waitFor({state:'visible'});
    await key('Tab','audio');
    assert(await audio.getByRole('button',{name:'Close audio controls'}).evaluate(n => n === document.activeElement));
    await key('Escape','audio');
    assert.equal((await active()).panel,'audio');
    await assertClosed(audio,'audio Escape');
    await key('Tab','empty-result-start'); // Tag
    await key('Tab','empty-result-start'); // Year
    const roundTrip = await tabUntil(a => a.panel === 'tag','empty-result-cycle',24);
    assert(roundTrip, 'filter remains reachable around an empty result set');
    const emptyTrace = result.steps.filter(s => s.phase === 'empty-result-cycle');
    assert(emptyTrace.some(s => s.wheel), 'wheel launcher remains reachable');
    assert(emptyTrace.every(s => !s.point && !s.preview && s.id !== 'start-overlay'), 'empty result leaked focus');

    await open('tag',tag);
    assert.deepEqual(await pressed(), ['commercial','2023']);
    await option('tag','__all__','clear-tag');
    await exit('tag',tag);
    assert.deepEqual(await pressed(), ['All Tags','2023']);
    assert.equal((await key('Tab','to-year')).panel,'year');
    await open('year',year);
    await option('year','__all__','clear-year');
    await exit('year',year);
    assert.deepEqual(await pressed(), ['All Tags','All Years']);
    assert.equal(await excluded.count(), 0);
    const restored = await tabUntil(a => a.point,'to-restored-point',16);
    assert(restored, 'clearing restores native focus on a map Point');
    await key('Enter','open-detail');
    await detail.waitFor({state:'visible'});
    assert.equal(await detail.getAttribute('data-work-id'), restored.state.point);
    assert.equal((await active()).id,'trial-detail-close');
    if (await page.locator('#trial-detail-link').isVisible()) {
      assert.equal((await key('Tab','detail-link')).id,'trial-detail-link');
    }
    const returned = await key('Escape','return');
    assert.equal(returned.point,restored.state.point);
    await assertClosed(detail,'detail Escape');

    // Continue natively from the Point through card interleave and the last Point.
    const loop = await tabUntil(a => a.panel === 'tag','full-cycle',240);
    assert(loop, 'last Point/Card cannot strand focus before the next pass through TAG / YEAR');
    const fullTrace = result.steps.filter(s => s.phase === 'full-cycle');
    assert(fullTrace.some(s => s.preview), 'existing keyboard Card link remains reachable');
    assert(fullTrace.some(s => s.wheel), 'existing wheel launcher remains reachable');
    const expectedPoints = await points.locator('[data-point-float][href]').evaluateAll(ns =>
      ns.map(n => n.closest('[data-work]').dataset.workId));
    assert.deepEqual([returned.point,...fullTrace.filter(s => s.point).map(s => s.point)], expectedPoints,
      'forward traversal reaches every restored Point once in map order');
    result.inputs = await page.evaluate(() => window.testInputs);
    assert(result.inputs.every(e => e.trusted && e.type !== 'pointerdown' && (e.type !== 'click' || e.detail === 0)),
      'only trusted native keyboard input and keyboard-generated clicks');
    assert.equal(result.popups,0);
    assert.deepEqual(result.errors,[]);
    result.totalPoints = total;
    result.pass = true;
    console.log(`PASS: ${width} ${touch ? 'touch emulation' : 'desktop'} ${motion}; filter in ${launch.i} Tab, ${total} Points restored`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,chromiumSandbox:true,
    args:['--mute-audio','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND']});
  try {
    for (const config of [{width:1440,touch:false,motion:'no-preference'}, {width:390,touch:true,motion:'reduce'}]) {
      try { await scenario(browser, config); }
      catch (error) { runs.at(-1).failure = error.message; console.error(error); process.exitCode = 1; }
    }
  } finally {
    fs.mkdirSync(evidence,{recursive:true});
    fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify({browser:browser.version(),routeUrl,runs},null,2)+'\n');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
