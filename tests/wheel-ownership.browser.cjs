// Built /archive-rebuild/: native Chrome wheel packets over a stationary title.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core');
const url=new URL(process.env.TH_PREVIEW_URL);
assert.equal(url.hostname,'127.0.0.1');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,chromiumSandbox:true,
    args:['--no-proxy-server','--disable-background-networking']});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
    await context.routeWebSocket('**/*',ws=>ws.close());
    await context.route('**/*',r=>new URL(r.request().url()).origin===url.origin?r.continue():r.abort());
    const page=await context.newPage();
    page.on('console',m=>{if(m.text().startsWith('owner-'))console.log(m.text())});
    page.on('pageerror',e=>console.error('pageerror',e.message));
    await page.addInitScript(()=>{
      window.wheelPackets=[];window.wheelFrames=[];window.sampling=false;
      document.addEventListener('wheel',e=>{
        const packet={at:performance.now(),trusted:e.isTrusted,
          x:e.clientX,y:e.clientY,delta:e.deltaY,prevented:false,checked:false,
          wheel:!!e.target.closest?.('#archive-wheel'),
          point:!!e.target.closest?.('[data-work],#point-preview,.trial-drawer,#trial-detail'),
          tag:e.target.tagName,id:e.target.id};
        window.wheelPackets.push(packet);
        // Init scripts register before the app's short-lived document bridge.
        setTimeout(()=>{packet.prevented=e.defaultPrevented;packet.checked=true},0);
      });
      const sample=()=>{
        if(window.sampling){const labels=[...document.querySelectorAll('[data-wheel-work]')];
          const label=labels.find(e=>e.classList.contains('is-selected')&&e.style.visibility==='visible');
          if(label){
            window.wheelFrames.push({at:performance.now(),offset:Number(document.querySelector('#archive-wheel').dataset.wheelOffset)});}}
        requestAnimationFrame(sample);
      };requestAnimationFrame(sample);
    });
    await page.goto(url.href);
    await page.locator('#start-overlay').click();
    await page.waitForFunction(()=>!document.body.classList.contains('is-blurred'));
    await page.locator('[data-wheel-toggle]').click();
    await page.locator('#archive-wheel').focus();
    for(let i=0;i<12;i++)await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(450);
    const title=await page.locator('[data-wheel-work].is-selected .archive-wheel__title').boundingBox();
    const p={x:Math.floor(title.x+title.width/2),y:Math.floor(title.y+title.height/2)};
    assert(await page.evaluate(p=>!!document.elementFromPoint(p.x,p.y)?.closest('[data-wheel-work]'),p),
      'selected title is a true wheel hit');
    await page.mouse.move(p.x,p.y);
    await page.evaluate(()=>{window.wheelPackets=[];window.wheelFrames=[];window.sampling=true});
    const send=async delta=>{
      const count=await page.evaluate(()=>window.wheelPackets.length);
      await page.mouse.wheel(0,delta);
      await page.waitForFunction(count=>window.wheelPackets.length>count && window.wheelPackets.at(-1).checked,count);
    };
    for(let i=0;i<12;i++){await send(8);await page.waitForTimeout(64);}
    const trace=await page.evaluate(()=>({packets:window.wheelPackets,frames:window.wheelFrames}));
    assert.equal(trace.packets.length,12,'12 trusted OS packets');
    assert(trace.packets.every(e=>e.trusted&&e.x===p.x&&e.y===p.y&&e.delta===8),
      'same stationary cursor and physical deltas');
    assert(trace.packets.every(e=>e.prevented),
      'moving title must retain all 12 packets, including those retargeted to passive backdrop: '+JSON.stringify(trace.packets));
    // Natural retarget varies with frame cadence. Force a hit-test gap in a
    // second *trusted* stream without changing visuals or generating events.
    const positions=trace.frames.filter(f=>f.at>trace.packets[0].at).slice(0,8).map(f=>f.offset);
    assert(positions.length>=4&&positions.some(v=>v>12.025)&&positions.at(-1)>positions[0]+.02,
      'first light input moves on first paints, without waiting for intent timeout');
    await page.waitForTimeout(950);
    assert.equal(await page.locator('[data-wheel-work].is-selected').getAttribute('data-wheel-index'),'13',
      '96px cumulative intent rests at adjacent station');
    // Prove the document bridge receives a real packet over passive backdrop.
    const second=await page.locator('[data-wheel-work].is-selected .archive-wheel__title').boundingBox();
    const q={x:Math.floor(second.x+second.width/2),y:Math.floor(second.y+second.height/2)};
    assert(await page.evaluate(q=>!!document.elementFromPoint(q.x,q.y)?.closest('[data-wheel-work]'),q));
    await page.mouse.move(q.x,q.y);await send(8);
    await page.evaluate(()=>{
      window.wheelGapStyle=document.createElement('style');
      window.wheelGapStyle.textContent='#archive-wheel, #archive-wheel * { pointer-events:none !important }';
      document.head.append(window.wheelGapStyle);
    });
    assert(await page.evaluate(q=>!document.elementFromPoint(q.x,q.y)?.closest('#archive-wheel'),q),
      'temporary hit-test gap exposes passive backdrop, without moving the pointer');
    await send(8);
    const bridged=await page.evaluate(()=>window.wheelPackets.at(-1));
    assert(!bridged.wheel&&!bridged.point&&bridged.prevented,
      'stationary title stream survives native passive-background retarget: '+JSON.stringify(bridged));
    await page.evaluate(q=>{
      const button=window.wheelObstacle=document.createElement('button');
      button.textContent='Interactive control';
      button.style.cssText=`position:fixed;left:${q.x-15}px;top:${q.y-15}px;width:30px;height:30px;z-index:99999;pointer-events:auto`;
      document.body.append(button);
    },q);
    assert(await page.evaluate(q=>document.elementFromPoint(q.x,q.y)===window.wheelObstacle,q));
    await send(8);
    assert.equal((await page.evaluate(()=>window.wheelPackets.at(-1))).prevented,false,
      'interactive control at original cursor is not captured');
    await page.evaluate(()=>window.wheelObstacle.remove());
    await send(8);
    assert.equal((await page.evaluate(()=>window.wheelPackets.at(-1))).prevented,true,
      'after the control leaves, a fresh passive packet inside the open disc starts rotation');
    await page.evaluate(()=>window.wheelGapStyle.remove());
    // Negative controls after ownership cancellation.
    const background={x:16,y:882};
    await page.mouse.move(background.x,background.y);await send(8);
    assert.equal((await page.evaluate(()=>window.wheelPackets.at(-1))).prevented,false,
      'moving off the title cancels ownership; page is not captured');
    const point=await page.evaluate(()=>{
      for(const n of document.querySelectorAll('#map-target [data-point-float]')){
        const r=n.getBoundingClientRect(),x=Math.floor(r.x+r.width/2),y=Math.floor(r.y+r.height/2);
        if(document.elementFromPoint(x,y)?.closest('[data-work]'))return{x,y};
      }
      return null;
    });
    assert(point,'real Point target');
    await page.mouse.move(point.x,point.y);await send(8);
    assert.equal((await page.evaluate(()=>window.wheelPackets.at(-1))).prevented,false,'Points never consumed');
    await page.locator('[data-wheel-toggle]').click();
    await page.mouse.move(q.x,q.y);await send(8);
    assert.equal((await page.evaluate(()=>window.wheelPackets.at(-1))).prevented,false,'closed Wheel has no ownership');
    console.log('stationary title 12/12 trusted packets consumed; passive retarget, first paints, rest and gates verified');
    await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
