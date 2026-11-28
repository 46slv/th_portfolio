// Trusted Chrome wheel gates on the private built rebuild (no DOM-generated wheel).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const url = new URL(process.env.TH_PREVIEW_URL);
assert.equal(url.hostname, '127.0.0.1');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH, headless:true,
    chromiumSandbox:true, args:['--no-proxy-server','--disable-background-networking']});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
    await context.routeWebSocket('**/*', ws=>ws.close());
    await context.route('**/*', route=>new URL(route.request().url()).origin===url.origin?route.continue():route.abort());
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.gates=[];
      document.addEventListener('wheel', e=>{
        const packet={trusted:e.isTrusted,prevented:false,checked:false,
          point:!!e.target.closest?.('[data-work],#point-preview,.trial-drawer'),
          target:e.target.closest?.('[data-trial-track],[data-wheel-work]')?'wheel':
            e.target.closest?.('[data-wheel-toggle],[data-wheel-step]')?'control':
            e.target.closest?.('#archive-wheel')?'wheel-background':'outside', zoom:e.ctrlKey};
        window.gates.push(packet);
        setTimeout(()=>{packet.prevented=e.defaultPrevented;packet.checked=true},0);
      });
    });
    await page.goto(url.href);
    await page.locator('#start-overlay').click();
    await page.waitForFunction(()=>!document.body.classList.contains('is-blurred'));
    const last=()=>page.evaluate(()=>window.gates.at(-1));
    const send=async pixels=>{const count=await page.evaluate(()=>window.gates.length);
      await page.mouse.wheel(0,pixels);
      await page.waitForFunction(count=>window.gates.length>count && window.gates.at(-1).checked,count);
    }; 
    await page.locator('[data-wheel-toggle]').hover();
    await send(32);
    assert.deepEqual([ (await last()).trusted,(await last()).prevented ],[true,false],'closed wheel does not consume');
    await page.locator('[data-wheel-toggle]').click();
    await page.locator('[data-wheel-toggle]').hover();
    await send(32);
    assert.equal((await last()).prevented,false,'open right-edge control does not scroll wheel');
    // Use integer CDP wheel coordinates after hover has settled, not a
    // floating SVG location that may hit an adjacent Point when rounded.
    let track;
    for(let i=12;i<88;i+=3) {
      const p=await page.evaluate(i=>{const t=document.querySelector('[data-trial-track]');
        const q=t.getPointAtLength(t.getTotalLength()*i/100).matrixTransform(t.getScreenCTM());
        return {x:Math.floor(q.x),y:Math.floor(q.y)};},i);
      await page.mouse.move(p.x,p.y);
      await page.waitForTimeout(35);
      if(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.hasAttribute('data-trial-track'),p)) {track=p;break;}
    }
    assert(track,'visible track after hover');
    await send(32);
    assert.equal((await last()).prevented,true,'exposed track consumes trusted wheel');
    await page.waitForTimeout(140);
    await send(8); // fixed cursor while the selected label moves past the arc
    const follow=await last();
    assert.equal(follow.prevented,!follow.point,
      'stationary cursor retains local hits or passive backdrop, never Points: '+JSON.stringify(follow));
    const titleHit=await page.evaluate(()=>{
      const item=document.querySelector('[data-wheel-work].is-selected .archive-wheel__title');
      const r=item.getBoundingClientRect();
      const p={x:Math.floor(r.x+r.width/2),y:Math.floor(r.y+r.height/2)};
      return document.elementFromPoint(p.x,p.y)?.closest('[data-wheel-work]')?p:null;
    });
    assert(titleHit,'expanded selected title is hittable');
    {
      await page.mouse.move(titleHit.x,titleHit.y);
      await send(32); await page.waitForTimeout(130); await send(8);
      const packet=await last();
      assert(packet.prevented && !packet.point && packet.target!=='control',
        'title stream remains owned over Wheel or passive backdrop: '+JSON.stringify(packet));
    }
    await page.mouse.move(15,830);
    await send(8);
    assert.equal((await last()).prevented,false,'page outside Wheel remains scrollable: '+JSON.stringify(await last()));
    await page.mouse.move(track.x,track.y);
    await page.keyboard.down('Control');
    await send(8);
    await page.keyboard.up('Control');
    assert.equal((await last()).prevented,false,'pinch-zoom modifier is not captured');
    const data=await page.evaluate(()=>window.gates);
    assert(data.every(e=>e.trusted),'all gates use trusted OS input');
    console.log('wheel gates: closed, controls, track/title stream, page and zoom verified');
    await context.close();
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
