// Built /archive-rebuild/ regression: controlled stereo samples through the real audio loop.
// Run after build with PLAYWRIGHT_CORE and CHROME_PATH from ../evidence/env.sh.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const dist = path.resolve(process.env.TH_DIST || 'dist');

async function main() {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const name = pathname === '/archive-rebuild/' ? 'archive-rebuild/index.html' : pathname.slice(1);
    if (!/^(?:archive-rebuild\/index\.html|_astro\/[\w.@-]+|SITE_th\.mp3|favicon\.(?:ico|svg))$/i.test(name)) return res.writeHead(404).end();
    const file = path.resolve(dist, name);
    if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html' : name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--mute-audio', '--disable-background-networking'] });
    for (const { width, height, dpr, touch } of [
      { width: 1440, height: 900, dpr: 1, touch: false },
      { width: 390, height: 650, dpr: 2, touch: true },
    ]) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        await ctx.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
          window.scopeMode = 'controlled';
          window.scopeDraws = [];
          window.scopeClears = 0;
          let calls = 0;
          const analyser = AnalyserNode.prototype;
          const originalData = analyser.getFloatTimeDomainData;
          analyser.getFloatTimeDomainData = function (data) {
            if (window.scopeMode === 'native') return originalData.call(this, data);
            const channel = calls++ % 3; // mono, left, right on each metering tick
            for (let i = 0; i < data.length; i++) data[i] = window.scopeMode === 'silent' ? 0 : .22 * Math.sin(i * .17 + (channel === 2 ? .8 : 0));
          };
          const canvas = CanvasRenderingContext2D.prototype;
          const fillRect = canvas.fillRect, clearRect = canvas.clearRect;
          canvas.fillRect = function (x, y, w, h) {
            if (this.canvas.id === 'map-lissajous') window.scopeDraws.push({ x, y, w, h, style: this.fillStyle });
            return fillRect.call(this, x, y, w, h);
          };
          canvas.clearRect = function (...args) {
            if (this.canvas.id === 'map-lissajous') { window.scopeDraws = []; window.scopeClears++; }
            return clearRect.apply(this, args);
          };
        });
        assert.equal((await page.goto(origin + '/archive-rebuild/')).status(), 200);
        if (touch) await page.locator('#start-overlay').tap();
        else await page.locator('#start-overlay').click();
        await page.waitForFunction(() => document.body.dataset.archiveAudio === 'playing', null, { timeout: 15000 });
        // Let the existing 0.12 gain smoothing settle before measuring the Graph-relative projection.
        await page.waitForFunction(() => window.scopeDraws.length === 1024 && window.scopeClears >= 40, null, { timeout: 5000 });
        const live = await page.evaluate(() => {
          const canvas = document.querySelector('#map-lissajous');
          const rect = canvas.getBoundingClientRect();
          const draws = window.scopeDraws;
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          const target = document.querySelector('#map-target');
          const graph = target.getBoundingClientRect();
          const graphLeft = (graph.left - rect.left) * canvas.width / rect.width;
          const graphTop = (graph.top - rect.top) * canvas.height / rect.height;
          const graphRight = (graph.right - rect.left) * canvas.width / rect.width;
          const graphBottom = (graph.bottom - rect.top) * canvas.height / rect.height;
          let maxAlpha = 0, colored = 0, beyondGraphX = false, beyondGraphY = false;
          for (let i = 3; i < pixels.length; i += 4) {
            maxAlpha = Math.max(maxAlpha, pixels[i]);
            if (pixels[i] > 90) colored++;
            if (pixels[i] > 90) {
              const index = (i - 3) / 4;
              const x = index % canvas.width;
              const y = Math.floor(index / canvas.width);
              if (x < graphLeft - 1 || x > graphRight + 1) beyondGraphX = true;
              if (y < graphTop - 1 || y > graphBottom + 1) beyondGraphY = true;
            }
          }
          const core = draws.slice(512);
          const xs = core.map(dot => (dot.x + dot.w / 2) / (canvas.width / rect.width));
          const ys = core.map(dot => (dot.y + dot.h / 2) / (canvas.height / rect.height));
          const point = [...target.querySelectorAll('[data-point-float]')].find(p => {
            const r = p.getBoundingClientRect();
            return p.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          });
          const r = point?.getBoundingClientRect();
          return { draws: draws.map(({ w, h, style }) => ({ w, h, style })), scale: canvas.width / rect.width,
            maxAlpha, colored, beyondGraphX, beyondGraphY, pointerEvents: getComputedStyle(canvas).pointerEvents,
            spanX: Math.max(...xs) - Math.min(...xs), spanY: Math.max(...ys) - Math.min(...ys),
            graphSpan: Math.min(graph.width, graph.height),
            centeredX: (Math.max(...xs) + Math.min(...xs)) / 2 - (graph.left + graph.width / 2 - rect.left),
            centeredY: (Math.max(...ys) + Math.min(...ys)) / 2 - (graph.top + graph.height / 2 - rect.top),
            canvasSize: [rect.width, rect.height], graphSize: [graph.width, graph.height],
            sibling: canvas.parentElement === target.parentElement && !target.contains(canvas),
            hit: point?.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
        });
        assert.equal(live.draws.length, 1024, 'two cheap stamps per <=512 stereo samples');
        assert(Math.abs(live.scale - dpr) < .02, 'backing-store follows DPR');
        for (const [start, size, alpha] of [[0, 4.5, '0.055'], [512, 2.5, '0.58']]) {
          const layer = live.draws.slice(start, start + 512);
          assert(layer.every(dot => Math.abs(dot.w / live.scale - size) < .05 && dot.w === dot.h && dot.style.includes(alpha)), `${size}px CSS-pixel layer at DPR ${dpr}`);
        }
        assert(live.maxAlpha >= 125 && live.colored > 100, 'readable bright, spatially separated cores are actually painted');
        assert(live.sibling, 'rebuild scope is behind Graph, not inside its clip');
        for (const [axis, size, graphSize, viewport] of [['X', live.canvasSize[0], live.graphSize[0], width], ['Y', live.canvasSize[1], live.graphSize[1], height]]) {
          assert(Math.abs(size - Math.min(graphSize * 1.28, viewport - 4)) < 2, `${axis} overscan is independently viewport-capped`);
        }
        for (const [axis, span, offset] of [['X', live.spanX, live.centeredX], ['Y', live.spanY, live.centeredY]]) {
          assert(Math.abs(span / (2 * live.graphSpan) - .61) < .025, `${axis} strong-signal radius is Graph-relative`);
          assert(Math.abs(offset) < 2, `${axis} stays centered on the graph`);
        }
        assert(live.beyondGraphY, 'visible core pixels cross the Graph vertically');
        if (live.canvasSize[0] > live.graphSize[0] + 8) assert(live.beyondGraphX, 'visible core pixels cross the Graph horizontally where space exists');
        assert.equal(live.pointerEvents, 'none');
        assert(live.hit, 'work Point still owns its hit target');
        await page.evaluate(() => { window.scopeMode = 'silent'; });
        await page.waitForFunction(() => window.scopeDraws.length === 0 && window.scopeClears > 3);
        assert.equal(await page.evaluate(() => {
          const canvas = document.querySelector('#map-lissajous');
          return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(value => value !== 0);
        }), false, 'silence clears dots and rim completely');
        await page.evaluate(() => { window.scopeMode = 'controlled'; });
        await page.waitForFunction(() => window.scopeDraws.length === 1024);
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        const clears = await page.evaluate(() => window.scopeClears);
        await page.waitForTimeout(160);
        assert.equal(await page.evaluate(() => window.scopeClears), clears, 'hidden tab stops cadence');
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: false });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForFunction(previous => window.scopeClears > previous && window.scopeDraws.length === 1024, clears);
        const activate = locator => touch ? locator.tap() : locator.click();
        await activate(page.locator('[data-trial-panel="audio"]'));
        await activate(page.locator('#play-pause-btn'));
        await page.waitForFunction(() => document.body.dataset.archiveAudio === 'paused');
        assert.equal(await page.evaluate(() => window.scopeDraws.length), 0, 'pause clears the canvas');
        await activate(page.locator('#play-pause-btn'));
        await page.waitForFunction(() => window.scopeDraws.length === 1024);
        assert.deepEqual(errors, []);
        console.log(`PASS built archive stereo dots ${width}x${height} DPR ${dpr}: ${live.colored} core pixels, alpha ${live.maxAlpha}; silent/pause/hidden/hits`);
      } finally { await ctx.close(); }
    }
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
