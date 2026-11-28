// Built rebuild only. Native MP3, analyser and animation timelines; no synthetic signal.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const url = new URL(process.env.TH_PREVIEW_URL || 'http://127.0.0.1:4287/archive-rebuild/');
assert(['localhost','127.0.0.1'].includes(url.hostname));
const evidence = process.env.TH_AMBIENT_EVIDENCE_DIR;
const results = [];

function instrument() {
  const probe = window.galaxyProbe = { batches: [], reads: 0, starts: 0, sources: 0, contexts: [] };
  const source = AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource = function() {
    probe.sources++;
    probe.contexts.push(this);
    const node = source.call(this);
    const start = node.start.bind(node);
    node.start = (...args) => { probe.starts++; return start(...args); };
    return node;
  };
  const read = AnalyserNode.prototype.getByteTimeDomainData;
  AnalyserNode.prototype.getByteTimeDomainData = function(values) { probe.reads++; return read.call(this, values); };
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  const fill = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.clearRect = function(...args) {
    if (this.canvas.id === 'archive-galaxy') probe.batches.push({ t: performance.now(), dust: 0, reactive: 0 });
    return clear.apply(this, args);
  };
  CanvasRenderingContext2D.prototype.fillRect = function(...args) {
    if (this.canvas.id === 'archive-galaxy') {
      const batch = probe.batches.at(-1);
      batch[/#ffe2ad|#a3eaff/i.test(this.fillStyle) ? 'reactive' : 'dust']++;
    }
    return fill.apply(this, args);
  };
  window.freezeSample = () => {
    const scene = document.getElementById('archive-scene');
    const effect = id => document.querySelector(id).getAnimations().map(a => [a.playState, a.currentTime]);
    const hash = id => {
      const c = document.querySelector(id), data = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let value = 0;
      for (let i = 0; i < data.length; i += 4) value = Math.imul(value,31) + data[i+3] | 0;
      return value;
    };
    return {
      stopped: scene.inert, filter: getComputedStyle(scene).filter,
      position: getComputedStyle(document.querySelector('[data-point-float]')).transform,
      year: effect('#trial-ambient'), map: hash('#map-lissajous'), wave: hash('#waveform-scope'),
      dust: hash('#archive-galaxy'), clock: probe.contexts[0]?.currentTime ?? null,
      audio: probe.contexts[0]?.state ?? null, reads: probe.reads, batches: probe.batches.length,
      station: document.querySelector('#archive-wheel').dataset.wheelOffset,
      detail: document.querySelector('#trial-detail').dataset.workId ?? null,
    };
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  try {
    for (const variant of ['native', 'failure', 'reduce', 'delayed']) {
      const context = await browser.newContext({ viewport: variant === 'failure' ? {width:390,height:844} : {width:1264,height:1254},
        deviceScaleFactor: 2, reducedMotion: variant==='reduce'?'reduce':'no-preference', serviceWorkers:'block' });
      let unblock;
      const gate = new Promise(resolve => { unblock = resolve; });
      await context.route('**/*', async route => {
        const target = new URL(route.request().url());
        if (target.origin !== url.origin) return route.abort();
        if (target.pathname.endsWith('/SITE_th.mp3')) {
          if (variant === 'failure') return route.fulfill({status:503, body:'Deliberate local audio failure'});
          if (variant === 'delayed') await gate;
        }
        return route.continue();
      });
      await context.addInitScript(instrument);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url.href);
      const sample = () => page.evaluate(() => window.freezeSample());
      const stop = page.locator('[data-archive-stop]');
      assert.equal(await page.evaluate(()=>window.galaxyProbe.sources),0);
      await page.locator('#start-overlay').click();
      const ready = state => page.waitForFunction(state=>document.body.dataset.archiveAudio===state,state,{timeout:15000});
      if (variant === 'delayed') {
        await ready('starting');
        await stop.click();
        unblock();
        await ready('playing');
        assert.equal((await sample()).audio,'suspended','startup cannot leak audio after Stop');
        await stop.click();
      }
      await ready(variant === 'failure' ? 'retry' : 'playing');
      await page.waitForTimeout(250);
      const launcherStatus = await page.locator('[data-preview-audio-status]').textContent();
      assert.equal(launcherStatus,variant==='failure'?'Audio unavailable':'');
      if (variant !== 'failure' && variant !== 'reduce') {
        await page.waitForFunction(()=>window.galaxyProbe.batches.some(b=>b.reactive>0));
        await page.locator('[data-trial-panel="audio"]').click();
        await page.locator('#vol-fader').focus();
        await page.keyboard.press('Home');
        await page.waitForFunction(()=>window.galaxyProbe.batches.slice(-4).every(b=>b.reactive===0 && b.dust>0));
        const muted = await sample();
        await page.waitForTimeout(180);
        assert.notEqual((await sample()).dust, muted.dust,'ordinary silent playback retains ambient drift');
        await page.keyboard.press('End');
        await page.waitForFunction(()=>window.galaxyProbe.batches.at(-1)?.reactive>0);
        await stop.click();
        await page.waitForFunction(()=>window.galaxyProbe.contexts[0].state==='suspended');
        const instrument = await sample();
        await page.waitForTimeout(250);
        assert.deepEqual(await sample(),instrument,'open instrument, meter/Point, waveform, galaxy, and context clock stay held');
        assert(await page.locator('#trial-audio').isVisible());
        await stop.click();
        await page.waitForFunction(()=>window.galaxyProbe.contexts[0].state==='running');
        await page.locator('#play-pause-btn').click();
        await ready('paused');
        await stop.click(); await stop.click();
        assert.equal((await sample()).audio,'suspended','scene Resume preserves Settings audio-only Pause');
        await page.locator('#play-pause-btn').click(); await ready('playing');
        await page.keyboard.press('Escape');
        await page.locator('#trial-audio').waitFor({state:'hidden'});
      }
      if (variant === 'native') {
        const toggle = page.locator('[data-wheel-toggle]');
        await toggle.click();
        const item = await page.locator('[data-wheel-work].is-selected').boundingBox();
        await page.mouse.move(item.x+item.width/2,item.y+item.height/2);
        const before = Number((await sample()).station);
        await page.mouse.wheel(0,880);
        await page.waitForFunction(before=>Number(document.querySelector('#archive-wheel').dataset.wheelOffset)>before+.03,before);
        await stop.evaluate(el=>el.click());
        const held = Number((await sample()).station);
        await page.waitForTimeout(350);
        assert.equal(Number((await sample()).station),held,'in-flight Wheel travel and settle deadline remain held');
        await stop.click();
        await page.waitForFunction(held=>Number(document.querySelector('#archive-wheel').dataset.wheelOffset)>held,held);
        await toggle.click();
        await page.locator('[data-trial-panel="year"]').click();
        const years = page.locator('#trial-year [data-filter-year]:not([data-filter-year="__all__"])');
        await years.nth(0).click(); await years.nth(1).click();
        await page.locator('#trial-year').evaluate(el => {
          el.querySelector('.trial-filter-close').click();
          document.querySelector('[data-archive-stop]').click();
        });
        await page.waitForTimeout(170);
        assert(await page.locator('#trial-year').isVisible(),'the exit deadline and its pose are held');
        assert((await sample()).year.some(([state])=>state==='paused'),'year travel held mid-animation');
      } else await stop.click();
      await page.waitForTimeout(100);
      const first = await sample();
      assert.equal(first.stopped,true);
      assert.match(first.filter,/grayscale\(1\)/);
      assert.equal(await stop.getAttribute('aria-label'),'Resume archive');
      await page.waitForTimeout(400);
      assert.deepEqual(await sample(),first,'Stop holds drawn frames, timelines, analyser reads and Web Audio time');
      if (evidence) {
        fs.mkdirSync(evidence,{recursive:true});
        await page.screenshot({path:path.join(evidence,`${variant}-held.png`)});
      }
      await stop.click();
      if (variant === 'native') await page.locator('#trial-year').waitFor({state:'hidden'});
      await page.waitForTimeout(240);
      const resumed = await sample();
      assert.equal(resumed.stopped,false);
      if (variant === 'reduce') assert.equal(resumed.dust,first.dust);
      else assert.notEqual(resumed.dust,first.dust);
      if (variant === 'failure') assert.equal(resumed.reads,0);
      else {
        assert(resumed.clock > first.clock && resumed.clock < first.clock + 1.2);
        assert.equal(await page.evaluate(()=>window.galaxyProbe.sources),1,'Resume never creates another source');
      }
      const cost = await page.evaluate(()=>{
        const canvas = document.querySelector('#archive-galaxy');
        const {batches, reads}=window.galaxyProbe;
        return {backingPixels:canvas.width*canvas.height, batches:batches.length, reads,
          maxDraws:Math.max(0,...batches.map(b=>b.dust+b.reactive)), reactiveBatches:batches.filter(b=>b.reactive>0).length};
      });
      assert(cost.backingPixels<=1_350_000 && cost.maxDraws<=540);
      assert.equal(cost.reactiveBatches>0,variant==='native'||variant==='delayed');
      assert.deepEqual(errors,[]);
      results.push({variant, cost, timeHeld:first.clock, timeResumed:resumed.clock});
      await context.close();
    }
    console.log(JSON.stringify(results,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
