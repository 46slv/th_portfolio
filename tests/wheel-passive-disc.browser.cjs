// Built /archive-rebuild/: trusted Chrome wheel from rest on the rendered open half-disc.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const url = new URL(process.env.TH_PREVIEW_URL);
assert.equal(url.hostname, '127.0.0.1');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH, headless:true,
    chromiumSandbox:true, args:['--no-proxy-server','--disable-background-networking']});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
    await context.routeWebSocket('**/*', ws=>ws.close());
    await context.route('**/*', r=>new URL(r.request().url()).origin===url.origin?r.continue():r.abort());
    const page = await context.newPage();
    page.on('pageerror', e=>console.error('pageerror',e.message));
    await page.addInitScript(() => {
      window.discPackets=[];
      document.addEventListener('wheel', e=>{
        const packet={trusted:e.isTrusted,x:e.clientX,y:e.clientY,delta:e.deltaY,
          hit:!!e.target.closest?.('[data-trial-track],[data-wheel-work]'),
          target:e.target.tagName,prevented:false,checked:false};
        window.discPackets.push(packet);
        setTimeout(()=>{packet.prevented=e.defaultPrevented;packet.checked=true},0);
      });
    });
    await page.goto(url.href);
    await page.locator('#start-overlay').click();
    await page.waitForFunction(()=>!document.body.classList.contains('is-blurred'));
    await page.locator('[data-wheel-toggle]').click();
    await page.locator('#archive-wheel').focus();
    for(let i=0;i<15;i++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(550);
    const positions=await page.evaluate(()=>{
      const r=document.querySelector('.archive-wheel__trial-arc').getBoundingClientRect();
      const safe=(x,y)=>{
        x=Math.floor(x);y=Math.floor(y);
        const target=document.elementFromPoint(x,y);
        if (!target || target.closest('[data-trial-track],[data-wheel-work],[data-work],#point-preview,.trial-drawer,#archive-trial-controls,button,a,input')) return null;
        return {x,y,target:target.tagName};
      };
      const centre=r.top+r.height/2, radius=r.height/2;
      // Verify the actual hit target, not just the SVG's bounding rectangle.
      const find=(ys,xs)=>{for(const y of ys)for(const x of xs){const p=safe(r.right-r.width*x,centre+radius*y);if(p)return p;}return null;};
      const xs=[.37,.42,.47,.52,.57,.62,.67];
      return {middle:find([0,.03,-.03,.09,-.09],[.93,.935,.94,...xs,.22,.12]),above:find([-.47,-.48,-.49,-.79,-.80,-.81],xs),
        below:find([.47,.48,.49,.79,.80,.81],xs),outside:find([-.68,-.75], [.96,.97,.98,.99]),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
    });
    assert(positions.middle&&positions.above&&positions.below&&positions.outside,JSON.stringify(positions));
    const r=positions.rect;
    for(const key of ['middle','above','below']) {
      const p=positions[key], dx=(p.x-r.right)/(r.right-r.left), dy=(p.y-(r.top+r.bottom)/2)/((r.bottom-r.top)/2);
      assert(dx*dx+dy*dy<1,`${key} is inside the rendered disc`);
    }
    {
      const p=positions.outside, dx=(p.x-r.right)/(r.right-r.left), dy=(p.y-(r.top+r.bottom)/2)/((r.bottom-r.top)/2);
      assert(dx*dx+dy*dy>1,'negative control lies inside the bounding rectangle but beyond the true arc');
    }
    const send=async (p,delta=32)=>{
      await page.mouse.move(p.x,p.y);
      const count=await page.evaluate(()=>window.discPackets.length);
      await page.mouse.wheel(0,delta);
      await page.waitForFunction(count=>window.discPackets.length>count && window.discPackets.at(-1).checked,count);
      const packet=await page.evaluate(()=>window.discPackets.at(-1));
      assert(packet.trusted && packet.x===p.x && packet.y===p.y && packet.delta===delta,JSON.stringify(packet));
      return packet;
    };
    for(const key of ['middle','above','below']) {
      const packet=await send(positions[key]);
      assert(packet.prevented&&!packet.hit,`${key}: first passive packet consumed once: ${JSON.stringify(packet)}`);
      await page.waitForTimeout(150);
      const offset=await page.evaluate(()=>Number(document.querySelector('#archive-wheel').dataset.wheelOffset));
      assert(offset>15.03&&offset<16.1,`${key}: first packet drives continuous arc before intent gap: ${offset}`);
      await page.waitForTimeout(780);
      assert.equal(await page.locator('[data-wheel-work].is-selected').getAttribute('data-wheel-index'),'16',`${key} rests one station ahead`);
      await page.locator('#archive-wheel').focus();
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(480);
    }
    const outside=await send(positions.outside);
    assert(!outside.prevented&&!outside.hit,'bounding-rectangle corner is outside the disc: '+JSON.stringify(outside));
    const point=await page.evaluate(()=>{
      for(const n of document.querySelectorAll('#map-target [data-point-float]')){
        const b=n.getBoundingClientRect(),p={x:Math.floor(b.x+b.width/2),y:Math.floor(b.y+b.height/2)};
        if(document.elementFromPoint(p.x,p.y)?.closest('[data-work]'))return p;
      }
    });
    assert(point,'real Point is hittable');
    assert(!(await send(point)).prevented,'real Point retains wheel default');
    await page.locator('#point-preview').waitFor({state:'visible'});
    const card=await page.evaluate(()=>{
      const b=document.querySelector('#point-preview').getBoundingClientRect();
      const p={x:Math.floor(b.x+b.width/2),y:Math.floor(b.y+b.height/2)};
      return document.elementFromPoint(p.x,p.y)?.closest('#point-preview')?p:null;
    });
    assert(card,'real Card is hittable');
    assert(!(await send(card)).prevented,'real Card retains wheel default');
    await page.mouse.click(point.x,point.y);
    await page.locator('#trial-detail').waitFor({state:'visible'});
    const detail=await page.evaluate(()=>{
      const b=document.querySelector('#trial-detail').getBoundingClientRect();
      const p={x:Math.floor(b.x+b.width/2),y:Math.floor(b.y+b.height/2)};
      return document.elementFromPoint(p.x,p.y)?.closest('#trial-detail')?p:null;
    });
    assert(detail,'real Detail is hittable');
    assert(!(await send(detail)).prevented,'real Detail retains wheel default');
    await page.locator('#trial-detail-close').click();
    // An actual HTML control over the disc must win the hit test; no overlay is
    // installed by the product and this probe is removed immediately.
    const p=positions.middle;
    await page.evaluate(p=>{
      const b=document.createElement('button');b.textContent='Control';
      b.style.cssText=`position:fixed;left:${p.x-12}px;top:${p.y-12}px;width:24px;height:24px;z-index:99999`;
      document.body.append(b);window.discControl=b;
    },p);
    assert(!(await send(p)).prevented,'real control inside disc retains wheel default');
    await page.evaluate(()=>window.discControl.remove());
    await page.keyboard.down('Control');
    assert(!(await send(p)).prevented,'Ctrl-wheel/pinch remains browser-owned');
    await page.keyboard.up('Control');
    await page.locator('[data-wheel-toggle]').click();
    assert(!(await send(p)).prevented,'closed disc never acquires first packet');
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-wheel-toggle]').click();
    await page.locator('[data-trial-panel="tag"]').click();
    await page.waitForTimeout(180);
    const drawerPoint=await page.locator('#trial-tag').evaluate(el=>{
      const r=el.getBoundingClientRect();
      return {x:Math.floor(r.x+r.width/2),y:Math.floor(r.y+r.height/2)};
    });
    assert(!(await send(drawerPoint)).prevented,'portrait filter retains its native wheel default');
    assert(await page.locator('#archive-wheel').evaluate(el=>el.inert),'the portrait dock cannot steal drawer hits');
    console.log('trusted Chrome: passive side-rail gaps, continuous travel, arc and control/zoom/closed/drawer gates');
    await context.close();
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
