// Optional rendered regression: run after the offline build with PLAYWRIGHT_CORE and CHROME_PATH set.
// Only this process's loopback server and isolated browser context are used.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_CORE);
const root = path.resolve(process.env.TH_DIST || 'dist');
const entry = fs.readFileSync(path.join(root, 'archive-rebuild/index.html'));
const digest = createHash('sha256').update(entry).digest('hex');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  if (!/^\/(?:archive-rebuild\/(?:index\.html)?|_astro\/[\w.@-]+\.(?:js|css)|favicon\.(?:ico|svg)|SITE_th\.mp3)$/.test(name)) {
    res.writeHead(404).end(); return;
  }
  const file = path.join(root, name === '/archive-rebuild/' ? 'archive-rebuild/index.html' : name.slice(1));
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/archive-rebuild/`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, chromiumSandbox: true,
      args: ['--no-proxy-server', '--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    for (const [width, height] of [[1264, 1254], [1280, 1000], [1440, 900], [390, 650], [320, 570], [844, 390]]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await context.route('**/*', route => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort());
      await context.routeWebSocket('**/*', route => route.close());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(url);
      assert.equal(response.status(), 200);
      assert.equal(createHash('sha256').update(await response.body()).digest('hex'), digest);
      await page.locator('#start-overlay').click();
      await page.waitForFunction(() => !document.body.classList.contains('is-blurred'));
      const disclosure = kind => page.locator(`[data-trial-panel="${kind}"]`);
      const options = kind => page.locator(`#trial-${kind}`);
      const choose = (kind, value) => options(kind).locator(`[data-filter-${kind}=${JSON.stringify(value)}]`);
      const escape = async kind => {
        await page.keyboard.press('Escape');
        await options(kind).waitFor({ state:'hidden' });
        assert(await disclosure(kind).evaluate(el=>document.activeElement===el));
      };
      const tagBox = await disclosure('tag').boundingBox(), yearBox = await disclosure('year').boundingBox();
      assert.equal(tagBox.x, yearBox.x);
      assert(tagBox.height>=44 && yearBox.height>=44 && yearBox.y>=tagBox.y+tagBox.height);
      const tag = await options('tag').locator('[data-filter-tag]').last().getAttribute('data-filter-tag');
      const year = await options('year').locator('[data-filter-year]').nth(1).getAttribute('data-filter-year');
      await disclosure('tag').click();
      assert(await options('tag').locator('[data-filter-options]').evaluate(el=>el.scrollWidth>el.clientWidth));
      assert(await options('year').isHidden());
      await choose('tag', tag).click();
      await disclosure('year').click();
      assert(await options('tag').isHidden());
      await choose('year', year).click();
      assert.equal(await choose('tag',tag).getAttribute('aria-pressed'),'true');
      assert.equal(await choose('year',year).getAttribute('aria-pressed'),'true');
      await escape('year');
      assert.equal(await disclosure('tag').getAttribute('aria-label'),`Tag: ${tag}`);
      assert.equal(await disclosure('year').getAttribute('aria-label'),`Year: ${year}`);
      await disclosure('tag').click();
      await choose('tag','__all__').click();
      await options('tag').getByRole('button',{name:'Close Tag filter'}).click();
      assert(await disclosure('tag').evaluate(el=>document.activeElement===el));
      assert.equal(await disclosure('year').getAttribute('aria-label'),`Year: ${year}`);
      await disclosure('year').click(); await choose('year','__all__').click(); await escape('year');
      assert.equal(await disclosure('year').getAttribute('aria-label'),null);

      const toggle = page.locator('[data-wheel-toggle]');
      const selected = page.locator('[data-wheel-work].is-selected:visible');
      const outline = () => toggle.evaluate(el=>getComputedStyle(el).outlineStyle);
      await toggle.click(); assert.equal(await outline(),'none');
      const wheel = page.locator('#archive-wheel'), graph = page.locator('#map-target');
      const a = await wheel.boundingBox(), g = await graph.boundingBox();
      const portrait = width<=600 && height>width;
      assert(portrait ? g.y+g.height<=a.y+.5 : g.x+g.width<=a.x-.5, 'Wheel and graph/axis lanes are separate');
      assert.equal(await page.locator('[data-wheel-work]').count(),96);
      const id = await selected.getAttribute('data-work-id');
      await selected.click();
      const detail = page.locator('#trial-detail'), box = await detail.boundingBox();
      assert.equal(await detail.getAttribute('data-work-id'),id);
      assert(portrait ? box.y+box.height<=a.y-.5 : box.x+box.width<=a.x-.5, 'Detail and Wheel do not overlap');
      assert(await toggle.evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}));
      await page.locator('[data-archive-stop]').click();
      assert.equal(await detail.getAttribute('data-work-id'),id);
      await page.locator('[data-archive-stop]').click();
      assert.equal(await detail.getAttribute('data-work-id'),id);
      await page.locator('#trial-detail-close').click();
      await toggle.click(); assert.equal(await outline(),'none');
      await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
      assert(await toggle.evaluate(el=>document.activeElement===el && getComputedStyle(el.querySelector('.archive-wheel__quiet-open')).textDecorationLine.includes('underline')));
      assert.equal(await outline(),'none','Keyboard marks the word, not a rectangle');
      assert.deepEqual(errors, []);
      console.log(`${width}x${height}: independent AND filters/reset/focus; Wheel/Graph/Detail/Stop hit lanes and compact focus`);
      await context.close();
    }
    console.log(`Frozen offline build SHA256 ${digest}`);
  } finally {
    try { if (browser) await browser.close(); }
    finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
