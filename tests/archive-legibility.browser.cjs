// Built /archive-rebuild/ typography and direct-hit audit in private Chromium.
// source ../evidence/env.sh; NODE_OPTIONS="--require=$EV/mock-sheet.cjs" npm run build;
// node tests/archive-legibility.browser.cjs (CHROME_PATH + PLAYWRIGHT_CORE).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const dist = path.resolve('dist');
(async()=>{
  const server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname.replace(/^\//,'') || 'archive-rebuild/index.html';
    const file=path.resolve(dist,name==='archive-rebuild/'?'archive-rebuild/index.html':name);
    if (!file.startsWith(dist+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
    res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--mute-audio','--no-proxy-server','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
    for(const [width,height] of [[1440,900],[390,650],[320,570],[844,390]]) {
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});
      try {
        const base=`http://127.0.0.1:${server.address().port}`;
        await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
        const page=await context.newPage(),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(base+'/archive-rebuild/');
        await page.locator('#start-overlay').click();
        await page.waitForFunction(()=>!document.body.classList.contains('is-blurred'));
        const measure=async()=>page.evaluate(()=>{
          const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
          const metric=el=>{const s=getComputedStyle(el);return {font:+parseFloat(s.fontSize),color:s.color,opacity:+s.opacity,box:rect(el)};};
          const hit=el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));};
          const get=s=>metric(document.querySelector(s));
          return {axis:[...document.querySelectorAll('#map-target > .text-zinc-700')].map(metric),
            header:get('#site-shell > header p'),contact:get('.contact-link'),footer:innerWidth>760?get('#site-shell > footer'):null,
            setting:get('[data-trial-panel="audio"]'),status:get('[data-preview-audio-status]'),
            toggle:hit(document.querySelector('[data-wheel-toggle]'))};
        });
        const graph=await measure();
        assert.equal(graph.axis.length,4);
        assert(graph.axis.every(a=>a.font>=12 && a.color!=='rgb(63, 63, 70)'));
        assert(graph.contact.font>=11 && graph.status.font>=11 && graph.header.font>=11);
        if(graph.footer) assert(graph.footer.font>=11);
        await page.locator('[data-trial-panel="tag"]').click();
        const filter=await page.evaluate(()=>{
          const el=document.querySelector('#trial-tag'),s=getComputedStyle(el.querySelector('[data-filter-tag]'));
          return {font:parseFloat(s.fontSize),opacity:getComputedStyle(el.querySelector('[data-filter-tag]').parentElement).opacity,
            box:el.getBoundingClientRect().toJSON()};
        });
        assert(filter.font>=12 && +filter.opacity===1);
        await page.locator('[data-filter-tag="arranged"]').click();
        assert.equal(await page.locator('[data-filter-tag="arranged"]').getAttribute('aria-pressed'),'true');
        await page.locator('[data-filter-tag="arranged"]').focus();
        assert.equal(await page.locator('[data-filter-tag="arranged"] .line-action__word').evaluate(el=>getComputedStyle(el).textDecorationLine),'underline');
        await page.locator('[data-filter-tag="__all__"]').click();
        await page.locator('[data-trial-panel="year"]').click();
        await page.locator('[data-filter-year]').last().scrollIntoViewIfNeeded();
        assert(await page.locator('[data-filter-year]').last().evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'last year direct hit');
        await page.locator('[data-filter-year="__all__"]').click();
        await page.locator('[data-trial-panel="audio"]').click();
        await page.waitForFunction(()=>!document.querySelector('#play-pause-btn').disabled);
        const audio=await page.evaluate(()=>{
          const metric=el=>({font:parseFloat(getComputedStyle(el).fontSize),r:el.getBoundingClientRect().toJSON()});
          return {label:[...document.querySelectorAll('#trial-audio .control-label')].map(metric),
            output:[...document.querySelectorAll('#trial-audio output')].map(metric),
            header:metric(document.querySelector('#trial-audio .waveform-scope__header')),
            status:metric(document.querySelector('#doppler-status')),
            play:metric(document.querySelector('#play-pause-btn')),
            panel:document.querySelector('#trial-audio').getBoundingClientRect().toJSON()};
        });
        assert(audio.label.every(v=>v.font>=11) && audio.output.every(v=>v.font>=12));
        assert(audio.header.font>=11 && audio.status.font>=12 && audio.play.font>=12);
        assert(audio.label.every((v,i)=>v.r.right+6<=audio.output[i].r.left),'fader names and numbers do not overlap');
        assert(audio.output.every(v=>v.r.right<=audio.panel.right-10),'readouts fit Setting');
        const input=page.locator('#vol-fader');
        await page.locator('#play-pause-btn').focus();
        await page.keyboard.press('Tab');
        assert(await input.evaluate(el=>el===document.activeElement && getComputedStyle(el).outlineStyle==='solid'),
          JSON.stringify(await page.evaluate(()=>({active:document.activeElement?.outerHTML,outline:getComputedStyle(document.querySelector('#vol-fader')).outlineStyle}))));
        await page.keyboard.press('ArrowRight');
        assert.notEqual(await page.locator('#trial-audio .control-reading output').first().evaluate(el=>el.value),'0.50');
        const playing=await page.locator('body').getAttribute('data-archive-audio');
        if(playing==='playing') {
          assert.equal(await page.locator('[data-preview-audio-status]').textContent(),'');
          await page.locator('#play-pause-btn').click();
          await page.waitForFunction(()=>document.body.dataset.archiveAudio==='paused');
        }
        await page.keyboard.press('Escape');
        await page.locator('[data-wheel-toggle]').click();
        const wheel=await page.evaluate(()=>{
          const s=sel=>parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
          const center=document.querySelector('[data-wheel-work].is-selected');const r=center.getBoundingClientRect();
          return {title:s('[data-wheel-work].is-selected .archive-wheel__title'),year:s('[data-wheel-work].is-selected .archive-wheel__year'),
            artist:innerWidth>760?s('[data-wheel-work].is-selected .archive-wheel__artist'):null,
            neighbors:[...document.querySelectorAll('[data-wheel-work]')].filter(n=>n!==center && getComputedStyle(n).visibility==='visible').map(n=>({font:parseFloat(getComputedStyle(n.querySelector('.archive-wheel__title')).fontSize),opacity:parseFloat(getComputedStyle(n).opacity)})),
            hit:center.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),
            rect:r.toJSON(),atCenter:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,180)};
        });
        assert(wheel.title>=13 && wheel.year>=11 && (wheel.artist===null||wheel.artist>=11));
        assert(wheel.neighbors.every(n=>n.font<wheel.title && n.opacity<1));
        assert(wheel.hit,`center wheel is a direct-hit target: ${JSON.stringify(wheel)}`);
        if(width<=390) assert(graph.axis[3].box.bottom+8<=wheel.rect.top,
          'right axis ends above compact Wheel centre, without covering its word');
        await page.locator('[data-wheel-work].is-selected').focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        assert(await page.locator('[data-wheel-work].is-selected').evaluate(el=>el===document.activeElement && getComputedStyle(el).outlineStyle==='solid'),
          'selected station has visible keyboard focus');
        if(width>760) {
          const neighbor=page.locator('[data-wheel-work]:not(.is-selected)').filter({visible:true});
          // Hover may be transient, but it must not acquire the centre's selected state.
          if(await neighbor.count()) {
            await neighbor.first().hover();
            await page.waitForTimeout(230);
            assert.equal(await page.locator('[data-wheel-work].is-selected').count(),1);
            assert.equal(await neighbor.first().locator('.line-action__word').evaluate(el=>getComputedStyle(el).transform),'none',
              'neighbor hover does not enlarge its word');
          }
          if(width===1440) {
            await page.locator('[data-wheel-work].is-selected .line-action__word').hover();
            await page.waitForTimeout(230);
            assert.equal(await page.locator('[data-wheel-work].is-selected .line-action__word').evaluate(el=>getComputedStyle(el).transform),'none',
              'centre hover leaves text in its own lane');
          }
        }
        await page.locator('[data-wheel-work].is-selected').click();
        assert(await page.locator('#trial-detail').isVisible());
        const detail=await page.evaluate(()=>({tags:parseFloat(getComputedStyle(document.querySelector('#trial-detail-tags')).fontSize),
          meta:parseFloat(getComputedStyle(document.querySelector('.trial-detail-head')).fontSize)}));
        assert(detail.tags>=12 && detail.meta>=12);
        await page.keyboard.press('Escape');
        await page.locator('[data-wheel-toggle]').click();
        const point=page.locator('#map-target [data-point-float]').first();
        await point.focus();
        await page.locator('#point-preview').waitFor({state:'visible'});
        const preview=await page.evaluate(()=>({meta:parseFloat(getComputedStyle(document.querySelector('[data-preview-meta]')).fontSize),
          tags:parseFloat(getComputedStyle(document.querySelector('[data-preview-tags]')).fontSize),
          link:parseFloat(getComputedStyle(document.querySelector('[data-preview-link]')).fontSize)}));
        assert(preview.meta>=12 && preview.tags>=12 && preview.link>=12);
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({width,height,graph,filter,audio:{label:audio.label.map(v=>v.font),output:audio.output.map(v=>v.font),header:audio.header.font,status:audio.status.font,play:audio.play.font},playing,wheel,detail,preview}));
      } finally {await context.close();}
    }
  } finally {if(browser) await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
