// Built-route, private ephemeral loopback. PLAYWRIGHT_CORE and CHROME_PATH required.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const dist = path.resolve(process.env.TH_DIST || 'dist');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9N0QAAAABJRU5ErkJggg==','base64');

async function main() {
  const server = http.createServer((req,res) => {
    const pathname = new URL(req.url,'http://localhost').pathname;
    const name = pathname === '/archive-rebuild/' ? 'archive-rebuild/index.html' : pathname.slice(1);
    if (!/^(?:archive-rebuild\/index\.html|_astro\/[\w.@-]+|SITE_th\.mp3|favicon\.(?:ico|svg))$/i.test(name)) return res.writeHead(404).end();
    const file = path.resolve(dist,name);
    if (!file.startsWith(dist+path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, {'Content-Type':name.endsWith('.html')?'text/html':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const evidence = process.env.TH_SOL_EVIDENCE_DIR;
  if (evidence) fs.mkdirSync(evidence,{recursive:true});
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true, args:['--mute-audio','--disable-background-networking']});
    for (const {width,height,touch,fail} of [
      {width:1440,height:900,touch:false,fail:false},
      {width:390,height:650,touch:true,fail:false},
      {width:320,height:570,touch:true,fail:false},
      {width:1440,height:900,touch:false,fail:true},
      {width:320,height:570,touch:true,fail:true},
    ]) {
      const ctx = await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,reducedMotion:'reduce',serviceWorkers:'block'});
      const errors=[]; let releaseImage;
      const imageGate = new Promise(resolve=>releaseImage=resolve);
      try {
        await ctx.route('**/*',async route=>{
          const u = new URL(route.request().url());
          if (u.origin === origin) {
            return route.continue();
          }
          if (u.hostname === 'img.youtube.com') {
            if (fail) await imageGate;
            return route.fulfill(fail ? {status:404,body:''} : {status:200,contentType:'image/png',body:png});
          }
          if (route.request().resourceType() === 'document') return route.fulfill({status:200,contentType:'text/html',body:'local popup'});
          return route.abort();
        });
        const page=await ctx.newPage(); page.on('pageerror',e=>errors.push(e.message));
        await page.goto(origin+'/archive-rebuild/');
        await (touch?page.locator('#start-overlay').tap():page.locator('#start-overlay').click());
        await page.waitForFunction(()=>!document.body.classList.contains('is-blurred'));
        await page.waitForFunction(()=>document.body.dataset.archiveAudio==='playing',null,{timeout:15000});
        const activate = locator=>touch?locator.tap():locator.click();
        await activate(page.locator('[data-trial-panel="audio"]'));
        const audio=page.locator('#trial-audio'), heading=page.locator('.trial-audio-heading h2');
        const header=await heading.boundingBox(), play=await page.locator('#play-pause-btn').boundingBox();
        const gain=await page.locator('#vol-fader').boundingBox(), scope=await page.locator('#waveform-scope').boundingBox();
        assert(Math.abs(header.x-play.x)<2 && Math.abs(play.x-gain.x)<2,'audio text and controls share a reading column without a drawn keyline');
        assert(header.y<play.y && play.y<gain.y,'heading, action and controls have typographic order');
        assert.match(await audio.evaluate(e=>getComputedStyle(e).backgroundImage),/radial-gradient/,'audio uses a feathered field');
        assert(scope.y<height,'scope promptly visible');
        assert.equal(await audio.locator('.audio-hud').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');
        assert.equal(await page.locator('#play-pause-btn').evaluate(e=>getComputedStyle(e).borderLeftWidth),'0px');
        assert.equal(await page.locator('#waveform-scope').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px','data trace has no frame');
        if (evidence && !fail) await page.screenshot({path:path.join(evidence,`${width}-audio.png`)});
        const overflow=await audio.evaluate(el=>el.scrollHeight-el.clientHeight);
        if (width===320) assert(overflow<70,`compact drawer needs only a short native scroll, not ${overflow}px`);
        await page.locator('#doppler-status').scrollIntoViewIfNeeded();
        assert((await page.locator('#doppler-status').boundingBox()).y>=0,'real shift state reachable by native scroll');
        await page.locator('.trial-audio-close').scrollIntoViewIfNeeded();
        const close=await page.locator('.trial-audio-close').boundingBox();
        assert(close.y>=0 && close.y+close.height<=height,'close remains reachable by native scroll');
        await activate(page.locator('.trial-audio-close'));
        await activate(page.locator('[data-wheel-toggle]'));
        const station=await page.locator('[data-wheel-work].is-selected').evaluate(button=>{
          const title=button.querySelector('.archive-wheel__title');
          const b=button.getBoundingClientRect(), r=title.getBoundingClientRect();
          const x=r.x+r.width/2, y=r.y+r.height/2;
          return {id:button.dataset.workId, x,y,width:r.width, buttonWidth:b.width,
            within:r.left>=b.left-1 && r.right<=b.right+1 && r.top>=b.top-1 && r.bottom<=b.bottom+1,
            hit:button.contains(document.elementFromPoint(x,y)),
            font:parseFloat(getComputedStyle(title).fontSize),
            artist:getComputedStyle(button.querySelector('.archive-wheel__artist')).display};
        });
        assert(station.within && station.hit,'visible title stays inside its original button and owns its midpoint');
        if (touch) assert(station.font>=11 && station.width<=station.buttonWidth && station.artist==='none','compact title/year fit the original touch lane');
        if (evidence && touch && !fail) await page.screenshot({path:path.join(evidence,`${width}-wheel.png`)});
        if (touch) await page.touchscreen.tap(station.x,station.y);
        else await page.mouse.click(station.x,station.y);
        await page.waitForFunction(id=>document.querySelector('#trial-detail:not([hidden])')?.dataset.workId===id,station.id);
        await activate(page.locator('#trial-detail-close'));
        await activate(page.locator('[data-wheel-toggle]'));
        if (await page.locator('#point-preview').isVisible()) {
          if (touch) await page.touchscreen.tap(3,height-72);
          else await page.mouse.click(3,height-72);
          await page.locator('#point-preview').waitFor({state:'hidden'});
        }
        const point=page.locator('#map-target [data-point-float]').filter({visible:true});
        const index=await point.evaluateAll(nodes=>nodes.findIndex(p=>{
          const n=p.closest('[data-work]'), r=p.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
          return n.dataset.tooltipThumbnail && p.href.startsWith('https://') &&
            p.contains(document.elementFromPoint(x,y)) && x>innerWidth*.2 && x<innerWidth*.7;
        }));
        assert(index>=0,'real linked thumbnail and unobstructed Point');
        const target=point.nth(index), href=await target.getAttribute('href');
        if (!touch) {
          const p=await target.boundingBox(); await page.mouse.move(p.x+p.width/2,p.y+p.height/2);
          await page.locator('#point-preview').waitFor({state:'visible'});
          const card=page.locator('#point-preview'), cta=card.locator('[data-preview-link]');
          assert.equal(await card.evaluate(el=>getComputedStyle(el).borderTopWidth),'0px','Point card has no frame');
          assert.match(await card.evaluate(el=>getComputedStyle(el).backgroundImage),/radial-gradient/,'Point card backing is feathered');
          const before=await cta.boundingBox();
          if (fail) {
            assert.equal(await card.locator('[data-preview-thumbnail] a').count(),0,'pending image cannot navigate');
            releaseImage();
            await page.waitForFunction(()=>document.querySelector('[data-preview-thumbnail]')?.children.length===0);
            assert.equal(await card.locator('[data-preview-thumbnail] a').count(),0,'failed image cannot navigate');
            assert.deepEqual(await cta.boundingBox(),before,'failed load preserves card action position');
          } else {
            const image=card.locator('[data-preview-thumbnail] a'); await image.waitFor();
            assert.equal(await image.getAttribute('href'),href);
            assert.equal(await image.getAttribute('tabindex'),'-1');
            assert.match(await image.getAttribute('aria-label'),/^Open work: .+/);
            assert.equal(await image.getAttribute('aria-hidden'),null);
            assert.equal(await card.locator('a').count(),2);
            await target.focus(); await page.keyboard.press('Tab');
            assert(await cta.evaluate(n=>n===document.activeElement),'CTA remains the only card keyboard stop');
            const popupPromise=page.waitForEvent('popup'); await image.click();
            const popup=await popupPromise; assert.equal(popup.url(),href); await popup.close();
            await page.bringToFront();
            await image.focus(); await page.keyboard.press('Escape');
            await card.waitFor({state:'hidden'});
            assert(await target.evaluate(el=>el===document.activeElement),'Escape from image returns focus to Point');
          }
        }
        if (touch && !fail) {
          await activate(page.locator('[data-wheel-toggle]'));
          await page.locator('#archive-wheel').focus();
          await page.keyboard.press('ArrowDown');
          const cardImage=page.locator('#point-preview [data-preview-thumbnail] a');
          await cardImage.waitFor();
          const cardHref=await cardImage.getAttribute('href');
          const popupPromise=page.waitForEvent('popup'); await cardImage.tap();
          const popup=await popupPromise; assert.equal(popup.url(),cardHref); await popup.close();
          await activate(page.locator('[data-wheel-toggle]'));
          await page.touchscreen.tap(3,height-72);
          await page.locator('#point-preview').waitFor({state:'hidden'});
        }
        await activate(target);
        const detail=page.locator('#trial-detail'); await detail.waitFor({state:'visible'});
        assert.equal(await detail.evaluate(el=>getComputedStyle(el).borderTopWidth),'0px','Detail has no frame');
        assert.match(await detail.evaluate(el=>getComputedStyle(el).backgroundImage),/radial-gradient/,'Detail backing is feathered');
        assert.equal(await detail.locator('#trial-detail-link').getAttribute('href'),href);
        if (fail) {
          assert.equal(await detail.locator('#trial-detail-thumbnail a').count(),0);
        } else {
          const image=detail.locator('#trial-detail-thumbnail a'); await image.waitFor();
          assert.equal(await image.getAttribute('href'),href);
          assert.equal(await image.getAttribute('tabindex'),'-1');
          assert.match(await image.getAttribute('aria-label'),/^Open work: .+/);
          assert.equal(await image.getAttribute('aria-hidden'),null);
          const popupPromise=page.waitForEvent('popup'); await activate(image);
          const popup=await popupPromise; assert.equal(popup.url(),href); await popup.close();
          await page.bringToFront();
          assert.equal(await detail.locator('#trial-detail-link').getAttribute('href'),href);
          await image.focus(); await page.keyboard.press('Escape');
          await detail.waitFor({state:'hidden'});
          assert(await target.evaluate(el=>el===document.activeElement),'Escape from detail image restores originating Point');
        }
        if (fail) await activate(page.locator('#trial-detail-close'));
        const nextIndex=await point.evaluateAll((nodes,oldHref)=>nodes.findIndex(p=>{
          const n=p.closest('[data-work]'), r=p.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
          return n.dataset.tooltipThumbnail && p.href.startsWith('https://') && p.href!==oldHref &&
            p.contains(document.elementFromPoint(x,y)) && x>innerWidth*.2 && x<innerWidth*.7;
        }),href);
        assert(nextIndex>=0,'second real work available for stale URL check');
        const nextPoint=point.nth(nextIndex), nextHref=await nextPoint.getAttribute('href');
        await activate(nextPoint);
        await detail.waitFor({state:'visible'});
        assert.equal(await detail.locator('#trial-detail-link').getAttribute('href'),nextHref);
        if (!fail) {
          const nextImage=detail.locator('#trial-detail-thumbnail a'); await nextImage.waitFor();
          assert.equal(await nextImage.getAttribute('href'),nextHref,'work switch does not retain thumbnail URL');
        } else assert.equal(await detail.locator('#trial-detail-thumbnail a').count(),0);
        await page.locator('#trial-detail-close').focus();
        await page.keyboard.press('Tab');
        assert(await page.locator('#trial-detail-link').evaluate(el=>el===document.activeElement),'explicit detail CTA follows close without an image keyboard stop');
        assert.deepEqual(errors,[]);
        console.log(`PASS ${width}x${height} ${touch?'touch':'mouse'} ${fail?'failed image':'loaded image'} audio / station / image routes`);
      } finally { await ctx.close(); }
    }
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
