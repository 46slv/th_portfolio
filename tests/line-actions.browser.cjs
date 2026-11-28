// Built archive route, private loopback and native commands under normal/forced colors.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const dist = path.resolve(process.env.TH_DIST || 'dist');
const server = http.createServer((req,res) => {
  const name = new URL(req.url,'http://localhost').pathname.replace(/^\//,'');
  const file = path.resolve(dist,name === 'archive-rebuild/' ? 'archive-rebuild/index.html' : name);
  if (!file.startsWith(dist+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.writeHead(200,{'content-type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
const underline = locator => locator.evaluate(el => getComputedStyle(el.querySelector(':scope .line-action__word')).textDecorationLine);
const activate = (locator,touch) => touch ? locator.tap() : locator.click();

async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,chromiumSandbox:true});
  try {
    for(const [width,touch,reducedMotion,forcedColors] of [[1440,false,'no-preference','none'],[390,true,'reduce','none'],[320,true,'reduce','active']]) {
      const context=await browser.newContext({viewport:{width,height:720},isMobile:touch,hasTouch:touch,reducedMotion,forcedColors,serviceWorkers:'block'});
      try {
        await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
        const page=await context.newPage(), errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(origin+'/archive-rebuild/');
        const boot=page.locator('#start-overlay');
        // This check measures the final caret; the early activation and typing stages
        // are covered separately. Wait for the finite type-on, not the dismissal.
        await boot.evaluate(el=>Promise.all(el.querySelector('.start-overlay__command').getAnimations({subtree:true}).map(a=>a.finished)));
        const entry = await boot.evaluate(el=>{
          const command=el.querySelector(':scope > .start-overlay__command'), cursor=command.querySelector(':scope > .start-overlay__cursor');
          const box=cursor.getBoundingClientRect(), range=document.createRange();
          range.setStart(command,0); range.setEndBefore(cursor);
          return {text:el.innerText,count:el.children.length, thin:box.width===1&&box.height>=12,
            trailing:box.left>=range.getBoundingClientRect().right, decorative:cursor.getAttribute('aria-hidden')==='true',
            generated:[el,command,cursor].flatMap(node=>['::before','::after'].map(pseudo=>getComputedStyle(node,pseudo).content))};
        });
        assert.equal(entry.text,'boot'); assert.equal(entry.count,1);
        assert(entry.thin && entry.trailing && entry.decorative && entry.generated.every(s=>s==='none'||s==='normal'));
        assert.match(await boot.getAttribute('aria-label'),/boot.*audio/i);
        await activate(boot,touch);
        const put = kind => page.locator(`[data-trial-panel="${kind}"]`);
        for(const kind of ['tag','year','audio']) {
          const trigger=put(kind);
          const rect=await trigger.boundingBox();
          assert(rect.width>=44 && rect.height>=44);
          assert.equal(await trigger.evaluate(el=>getComputedStyle(el.querySelector('.line-action')??el,'::before').content),'none');
          await trigger.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
          assert.match(await underline(trigger),/underline/);
          await activate(trigger,touch);
          if(kind!=='audio') {
            const panel=page.locator(`#trial-${kind}`), first=panel.locator(`[data-filter-${kind}="__all__"]`);
            await first.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
            assert.equal(await first.getAttribute('aria-pressed'),'true');
            assert.match(await underline(first),/underline/);
            assert.equal(await first.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
            if(forcedColors==='active') {
              assert.notEqual(await first.evaluate(el=>getComputedStyle(el).color),await panel.locator(`[data-filter-${kind}]`).nth(1).evaluate(el=>getComputedStyle(el).color));
            }
          } else {
            const inputs=await page.locator('#trial-audio input[type="range"]').evaluateAll(nodes=>nodes.map(el=>({labels:el.labels?.length,value:el.parentElement.querySelector('output')?.value})));
            assert.equal(inputs.length,5); assert(inputs.every(input=>input.labels&&input.value));
            await page.waitForFunction(()=>['playing','retry'].includes(document.body.dataset.archiveAudio),null,{timeout:15000});
            const state=await page.locator('body').getAttribute('data-archive-audio');
            assert.equal(await page.locator('[data-preview-audio-status]').textContent(),state==='retry'?'Audio unavailable':'');
          }
          await page.keyboard.press('Escape'); await page.locator(`#trial-${kind}`).waitFor({state:'hidden'});
          assert(await trigger.evaluate(el=>el===document.activeElement));
        }
        const wheel=page.locator('[data-wheel-toggle]');
        const outlines = () => wheel.evaluate(el=>[getComputedStyle(el).outlineStyle,getComputedStyle(el).boxShadow]);
        await activate(wheel,touch);
        assert.deepEqual(await outlines(),['none','none']);
        assert.equal(await wheel.locator('.line-action__word:visible').innerText(),'Close');
        await wheel.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        assert.match(await wheel.locator('.line-action__word:visible').evaluate(el=>getComputedStyle(el).textDecorationLine),/underline/);
        assert.deepEqual(await outlines(),['none','none']);
        const selected=page.locator('[data-wheel-work][aria-current="true"]');
        const title=selected.locator('.archive-wheel__title .line-action__word');
        assert.equal(await title.evaluate(el=>getComputedStyle(el).transform),'none','title never expands into another hit lane');
        await activate(selected,touch);
        assert(await page.locator('#trial-detail').isVisible());
        assert.equal(await page.locator('#trial-detail-link .line-action__word').textContent(),'Open work');
        await activate(page.locator('#trial-detail-close'),touch);
        assert(await selected.evaluate(el=>el===document.activeElement));
        assert.equal(await page.locator('[data-wheel-work]').count(),96);
        assert.deepEqual(errors,[]);
        console.log(`${width}px ${forcedColors}: boot/words, native focus, persistent selection, audio fallback and unboxed Wheel`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.closeAllConnections();server.close();});
