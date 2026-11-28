// Built rebuild; check measured anchors, timing, close races and physical hit lanes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const dist = path.resolve(process.env.TH_DIST || 'dist');
const server = http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const name=pathname==='/archive-rebuild/'?'archive-rebuild/index.html':pathname.slice(1);
  if (!/^(archive-rebuild\/index\.html|_astro\/[\w.@-]+|SITE_th\.mp3|favicon\.(?:ico|svg))$/i.test(name)) return res.writeHead(404).end();
  const file=path.resolve(dist,name);
  if (!file.startsWith(dist+path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});

async function launch() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--mute-audio']});
  try {
    for (const [width,height,motion] of [[1264,1254,'no-preference'],[1440,900,'reduce'],[844,390,'no-preference'],[390,650,'no-preference'],[320,570,'reduce']]) {
      const context=await browser.newContext({viewport:{width,height},reducedMotion:motion,serviceWorkers:'block'});
      await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      const page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin+'/archive-rebuild/');
      await page.locator('#start-overlay').click();
      const trigger=kind=>page.locator(`[data-trial-panel="${kind}"]`);
      const panel=kind=>page.locator(`#trial-${kind}`);
      const hit = locator => locator.evaluate(el=>{
        const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      });
      const portrait=width<=600&&height>width;
      for (const kind of ['tag','year','audio']) {
        await trigger(kind).click();
        const name = kind==='audio'?'trial-audio-enter':'archive-filter-slide';
        const target=panel(kind);
        if (motion==='reduce') assert.equal(await target.evaluate(el=>getComputedStyle(el).animationName),'none');
        else {
          const handle=await target.elementHandle();
          const keyframes=await handle.evaluate((el,name)=>el.getAnimations().find(a=>a.animationName===name)?.effect.getKeyframes(),name);
          assert.match(keyframes[0].translate,/^-\d+px/,'entry slides horizontally');
          await page.waitForFunction(({el,name})=>el.getAnimations().some(a=>a.animationName===name&&a.playState==='finished'),{el:handle,name});
        }
        const r=await target.boundingBox(), t=await trigger(kind).boundingBox();
        assert(r.x>=8 && r.y>=8 && r.x+r.width<=width-8 && r.y+r.height<=height-8);
        if (portrait) assert(r.y>=t.y+t.height && r.y<height/2);
        else if (kind==='audio') assert(r.x>=t.x+t.width+8 && r.x<=t.x+t.width+16);
        else assert(Math.abs(r.x-t.x-t.width-8)<1 && Math.abs(r.y-t.y)<1);
        assert(await hit(trigger(kind)),'active launcher remains separately clickable');
        assert(await hit(page.locator('[data-archive-stop]')),'Stop keeps its physical hit lane');
        if(kind!=='audio') {
          const option=target.locator(`[data-filter-${kind}]`).last();
          await option.scrollIntoViewIfNeeded();
          assert(await hit(option),'native horizontal scroll exposes the final choice');
        }
        await page.keyboard.press('Escape');
        assert(await trigger(kind).evaluate(el=>el===document.activeElement));
        assert(await target.evaluate(el=>el.hidden || (el.inert && el.getAttribute('aria-hidden')==='true' && getComputedStyle(el).pointerEvents==='none')));
        await target.waitFor({state:'hidden'});
      }
      await trigger('tag').click(); await trigger('year').click();
      assert(await panel('tag').isHidden() && await panel('year').isVisible());
      await page.keyboard.press('Escape');
      await trigger('tag').click();
      await page.waitForTimeout(180);
      assert(await panel('year').isHidden() && await panel('tag').isVisible(),'a stale close cannot hide the new panel');
      await page.keyboard.press('Escape');
      await panel('tag').waitFor({state:'hidden'});
      await page.locator('[data-wheel-toggle]').click();
      await page.locator('[data-wheel-work].is-selected').click();
      const detail=panel('detail');
      await detail.waitFor({state:'visible'});
      await page.waitForTimeout(motion==='reduce'?0:200);
      const r=await detail.boundingBox();
      const rail=await page.locator('#archive-wheel').boundingBox();
      assert(portrait ? r.y+r.height<rail.y : r.x+r.width<rail.x,'reading surface cannot intercept the Wheel lane');
      assert(await hit(page.locator('[data-wheel-toggle]')));
      assert.deepEqual(errors,[]);
      console.log(`${width}x${height} ${motion}: panel anchor, horizontal motion, focus, close race and separate hit regions`);
      await context.close();
    }
  } finally { await browser.close(); }
}
launch().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{server.closeAllConnections();server.close();});
