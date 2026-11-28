// Standalone live-preview regression. Set PLAYWRIGHT_CORE and optionally CHROME_PATH.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const url = process.env.TH_PREVIEW_URL || 'http://127.0.0.1:4279/archive-rebuild/';
const near = '#point-preview';
const point = '#map-target [data-point-float]';
const detail = '#trial-detail';
async function ready(page) {
  await page.goto(url);
  await page.locator('#start-overlay').click();
  await page.waitForFunction(() => !document.body.classList.contains('is-blurred'));
}
async function usablePoint(page) {
  const index = await page.locator(point).evaluateAll(nodes => nodes.findIndex(n => {
    const b = n.getBoundingClientRect();
    const x = b.x + b.width/2, y = b.y + b.height/2;
    return n.getAttribute('href')?.startsWith('https://') && n.tabIndex >= 0 &&
      n.contains(document.elementFromPoint(x,y)) && x > innerWidth*.2 &&
      x < innerWidth*.58 && y > innerHeight*.27 && y < innerHeight*.73;
  }));
  assert.notEqual(index,-1,'visible, non-overlapping work required');
  return page.locator(point).nth(index);
}
async function waitHidden(page, selector) {
  await page.locator(selector).waitFor({state:'hidden'});
}
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
  try {
    const desktop = await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    await desktop.route('https://img.youtube.com/**', route=>route.abort());
    const page = await desktop.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await ready(page);
    const wheel = page.locator('#archive-wheel');
    const wheelState = () => wheel.evaluate(el => [...el.querySelectorAll('.is-selected')].map(x=>x.getAttribute('data-work-id')));
    const initialWheel = await wheelState();
    const p = await usablePoint(page), a=await p.boundingBox(), href=await p.getAttribute('href');
    const cx=a.x+a.width/2, cy=a.y+a.height/2;
    await page.mouse.move(cx,cy);
    await page.locator(near).waitFor({state:'visible'});
    const b=await page.locator(near).boundingBox();
    assert(b.x>=12 && b.y>=12 && b.x+b.width<=1428 && b.y+b.height<=888,'preview stays on screen');
    const edge=b.x>cx?b.x:b.x+b.width, sign=b.x>cx?1:-1;
    const halfway=(edge+(sign>0?a.x+a.width:a.x))/2;
    await page.mouse.move(halfway,cy+10,{steps:12});
    await page.waitForTimeout(600); // Deliberately slower than the dismiss debounce.
    assert(await page.locator(near).isVisible(),'slow diagonal crossing keeps card open');
    await page.mouse.move(edge+sign*4,cy+12,{steps:8});
    assert.deepEqual(await page.locator(near).boundingBox(),b,'card must not drift');
    assert.equal(await page.locator('#map-target').evaluate(x=>getComputedStyle(x).filter),'none');
    assert.deepEqual(await wheelState(),initialWheel);
    assert.equal(await page.locator(near+' [data-preview-link]').getAttribute('href'),href);
    const link = await page.locator(near+' [data-preview-link]').boundingBox();
    await desktop.route(href, route => route.fulfill({status:200,body:'Verified destination without contacting external site.'}));
    const popupPromise=page.waitForEvent('popup');
    await page.mouse.move(link.x+link.width/2,link.y+link.height/2,{steps:14});
    await page.mouse.click(link.x+link.width/2,link.y+link.height/2);
    const popup=await popupPromise;
    await popup.waitForLoadState();
    assert.equal(popup.url(),href);
    await popup.close();
    await page.bringToFront();

    await page.mouse.move(4,4);
    await page.keyboard.press('Escape');
    await waitHidden(page,near);
    await p.focus();
    if (!(await page.locator(near).isVisible())) {
      await page.locator('[data-trial-panel="tag"]').focus();
      await p.focus();
    }
    await page.locator(near).waitFor({state:'visible'});
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-preview-link')),true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await p.evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await waitHidden(page,near);
    assert.equal(await p.evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-point-float')),true);
    await page.locator(near).waitFor({state:'visible'});
    await page.evaluate(()=>window.dispatchEvent(new Event('work-filters-applied')));
    await waitHidden(page,near);
    await page.locator('[data-trial-panel="tag"]').focus();
    await page.mouse.move(cx,cy);
    await page.locator(near).waitFor({state:'visible'});
    await page.mouse.move(5,5,{steps:24});
    await waitHidden(page,near);
    assert.deepEqual(errors,[]);
    await desktop.close();
    console.log('desktop: gap, real link, focus, Escape, pointer exit, filter dismissal');

    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    await mobile.route('https://img.youtube.com/**', route=>route.abort());
    mobile.on('pageerror',e=>errors.push(e.message));
    await ready(mobile);
    const mp=await usablePoint(mobile);
    await mp.tap();
    assert(await mobile.locator(detail).isVisible());
    assert.equal(await mobile.locator(detail+' a').getAttribute('href'),await mp.getAttribute('href'));
    await waitHidden(mobile,near);
    await mobile.locator('#trial-detail-close').tap();
    await waitHidden(mobile,detail);
    assert.deepEqual(errors,[]);
    await mobile.close();
    console.log('mobile touch: tap, matching work link, dismiss');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
