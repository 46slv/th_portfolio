// Built-route regression. CHROME_PATH, PLAYWRIGHT_CORE, TH_DIST (defaults to dist).
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const dist = path.resolve(process.env.TH_DIST || 'dist');

async function main() {
  const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.mp3':'audio/mpeg', '.svg':'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const name = url.pathname === '/archive-rebuild/' ? 'archive-rebuild/index.html' : url.pathname.slice(1);
    if (!/^(?:archive-rebuild\/index\.html|_astro\/[a-z\d_.@-]+|SITE_th\.mp3|favicon\.(?:ico|svg))$/i.test(name)) return res.writeHead(404).end();
    const file = path.join(dist, name);
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, chromiumSandbox: true, headless: true });
    for (const touch of [false, true]) {
      for (const failure of [false,true]) {
        const ctx = await browser.newContext({ viewport: touch ? {width:390,height:650} : {width:1440,height:900},
          isMobile: touch, hasTouch: touch, reducedMotion: 'reduce', serviceWorkers: 'block' });
        const result = {touch, failure, errors:[], requests:0};
        results.push(result);
        try {
          await ctx.routeWebSocket('**/*', () => {});
          let release;
          const hold = new Promise(resolve => { release = resolve; });
          await ctx.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin !== origin) return route.abort();
            if (url.pathname === '/SITE_th.mp3' && ++result.requests === 1) {
              await hold;
              if (failure) return route.fulfill({status:503,body:'disposable test failure'});
            }
            return route.continue();
          });
          const page = await ctx.newPage();
          page.on('pageerror', error => result.errors.push(error.message));
          await page.addInitScript(() => {
            const proto = AudioBufferSourceNode.prototype;
            const original = proto.start;
            window.sourceStarts = [];
            proto.start = function (...args) {
              window.sourceStarts.push(this.playbackRate.value);
              return original.apply(this, args);
            };
          });
          const activate = (locator) => touch ? locator.tap({timeout:3500}) : locator.click({timeout:3500});
          assert.equal((await page.goto(origin+'/archive-rebuild/')).status(), 200);
          await activate(page.locator('#start-overlay'));
          await activate(page.locator('[data-trial-panel="audio"]'));
          const speed = page.locator('#speed-fader');
          const box = await speed.boundingBox();
          if (touch) await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height/2);
          else await speed.click({position:{x:box.width * 0.7,y:box.height/2}});
          result.requestedRate = Number(await speed.inputValue());
          assert(result.requestedRate > 1.1, 'real input changes the rate during loading');
          release();
          const waitStatus = (expected) => page.waitForFunction(value => document.body.dataset.archiveAudio === value, expected.toLowerCase(), {timeout:6000});
          await waitStatus(failure ? 'Retry' : 'Playing');
          await activate(page.locator('.trial-audio-close'));
          const id = await page.locator('#map-target [data-work]').evaluateAll(nodes => nodes.find(n => {
            const point = n.querySelector('[data-point-float]'), r = point.getBoundingClientRect();
            return point.contains(document.elementFromPoint(r.x+r.width/2, r.y+r.height/2));
          })?.dataset.workId);
          assert(id, 'at least one unobstructed Point');
          await activate(page.locator(`[data-work-id=${JSON.stringify(id)}] [data-point-float]`));
          await page.waitForFunction(id => document.querySelector('#trial-detail:not([hidden])')?.dataset.workId === id, id, {timeout:3500});
          result.detail = id;
          // Read after browser events and the possible suspend/resume Promise have settled.
          await page.waitForTimeout(350);
          result.afterPoint = await page.locator('body').getAttribute('data-archive-audio');
          result.requestsBeforeRetry = result.requests;
          if (failure && result.afterPoint === 'retry') {
            await activate(page.locator('#trial-detail-close'));
            await activate(page.locator('[data-trial-panel="audio"]'));
            await activate(page.locator('#play-pause-btn'));
            await waitStatus('Playing');
          }
          result.startedRates = await page.evaluate(() => window.sourceStarts);
        } catch (error) { result.errors.push(error.message); }
        finally { await ctx.close(); }
      }
    }
    console.log(JSON.stringify({chrome:browser.version(),dist,results},null,2));
    for (const run of results) {
      const variant = `${run.touch ? 'touch' : 'desktop'}, ${run.failure ? 'failure/retry' : 'first load'}`;
      assert.deepEqual(run.errors, [], variant);
      assert(run.detail, variant+' opens matching Detail');
      assert.equal(run.afterPoint, run.failure ? 'retry' : 'playing', variant+' Point activation leaves audio alone');
      assert.equal(run.requestsBeforeRetry, 1, variant+' no implicit fetch');
      assert.equal(run.requests, run.failure ? 2 : 1, variant+' only explicit retry can fetch again');
      assert.equal(run.startedRates.length, 1, variant+' uses one source');
      assert(Math.abs(run.startedRates[0]-run.requestedRate) < 0.001, variant+' first source start matches the visible rate');
    }
  } finally {
    try { await browser?.close(); }
    finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });