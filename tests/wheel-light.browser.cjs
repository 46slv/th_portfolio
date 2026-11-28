// Built local fixture, installed sandboxed Chrome, trusted wheel packets only.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const cases = require('./fixtures/wheel-light.cjs');
const url = new URL(process.env.TH_PREVIEW_URL || 'http://127.0.0.1:4287/archive-rebuild/');
assert.equal(url.hostname,'127.0.0.1');
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
(async () => {
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,chromiumSandbox:true,
    args:['--no-proxy-server','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
  try {
    for (const reduce of [false,true]) {
      const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:reduce?'reduce':'no-preference',serviceWorkers:'block'});
      await context.routeWebSocket('**/*', socket => socket.close());
      await context.route('**/*', route => new URL(route.request().url()).origin===url.origin?route.continue():route.abort());
      try {
        const page=await context.newPage();
        await page.addInitScript(() => {
          window.lightInputs=[]; window.lightFrames=[]; window.lightSampling=false;
          document.addEventListener('wheel', e => window.lightInputs.push({at:performance.now(),trusted:e.isTrusted,pixels:e.deltaY,mode:e.deltaMode,
            target:!!e.target.closest?.('[data-trial-track],[data-wheel-work]'),prevented:e.defaultPrevented}));
          const frame=()=>{
            if(window.lightSampling){
              const labels=[...document.querySelectorAll('[data-wheel-work]')];
              const label=labels.find(n=>n.classList.contains('is-selected') && n.style.visibility==='visible');
              if(label){
                window.lightFrames.push({at:performance.now(),offset:Number(document.querySelector('#archive-wheel').dataset.wheelOffset),
                  id:label.dataset.workId,point:document.querySelector('#map-target [data-work].is-selected')?.dataset.workId,
                  card:document.querySelector('#point-preview-title')?.textContent,
                  title:document.querySelector(`#map-target [data-work][data-work-id="${label.dataset.workId}"]`)?.dataset.tooltipTitle});
              }
            }
            requestAnimationFrame(frame);
          };requestAnimationFrame(frame);
        });
        await page.goto(url.href);
        await page.locator('#start-overlay').click();
        await page.waitForFunction(()=>!document.body.classList.contains('is-blurred'));
        await page.locator('[data-wheel-toggle]').click();
        await page.locator('#archive-wheel').focus();
        let at=0;
        for(let i=0;i<30;i++) {await page.keyboard.press('ArrowDown');at++;}
        const pos=await page.evaluate(()=>{
          const track=document.querySelector('[data-trial-track]');
          for(let i=10;i<90;i++){
            const p=track.getPointAtLength(track.getTotalLength()*i/100).matrixTransform(track.getScreenCTM());
            if(document.elementFromPoint(p.x,p.y)===track)return {x:p.x,y:p.y};
          }
        });
        assert(pos,'visible open track');
        await page.mouse.move(pos.x,pos.y);
        const names=reduce?['single','belowEight','belowSixteen','belowNegative','four','eight','sparse','reverse','jitter','speck','spacedSpecks','notch','large']
          : Object.keys(cases);
        for(const name of names){
          const {pixels,gap,step}=cases[name];
          // Keyboard is a direct, debt-free start; no legacy target is carried in.
          while(at<30){await page.keyboard.press('ArrowDown');at++;}
          while(at>30){await page.keyboard.press('ArrowUp');at--;}
          await page.evaluate(()=>{window.lightFrames=[];window.lightInputs=[];window.lightSampling=true;});
          for(const pixel of pixels){await page.mouse.wheel(0,pixel);if(gap)await sleep(gap);}
          await sleep(name==='large'?1350:1020);
          const data=await page.evaluate(()=>{window.lightSampling=false;return {inputs:window.lightInputs,frames:window.lightFrames};});
          assert.equal(data.inputs.length,pixels.length,name+' trusted packet count');
          assert(data.inputs.every((e,i)=>e.trusted&&e.target&&e.prevented&&e.mode===0&&e.pixels===pixels[i]),name+' trusted, normalized, consumed on track');
          assert(data.frames.length>8 && data.frames.every(s=>s.id===s.point && s.card?.trim()===s.title?.trim()),name+' Point/Card coherent');
          const tail=data.frames.slice(-7).map(s=>s.offset);
          assert(Math.max(...tail)-Math.min(...tail)<.025,name+' rests without bounce');
          const rest=tail.at(-1);
          assert(Math.abs(rest-(30+step))<.025,`${reduce?'reduced':'normal'} ${name}: ${rest}`);
          if(['single','four','eight','sparse','reverse','sparseReverse'].includes(name))
            assert(data.frames.every(s=>Math.abs(s.offset-30)<1.05),name+' no two-station ratchet');
          if(!reduce && ['single','belowEight','belowSixteen','belowNegative','four','eight'].includes(name)) {
            const first=data.inputs[0].at, sign=Math.sign(pixels[0]);
            const firstTwo=data.frames.filter(s=>s.at>=first).slice(0,2);
            assert(firstTwo.length===2 && firstTwo.some(s=>sign*(s.offset-30)>.025),name+' first two paints show fractional movement');
            if(name.startsWith('below')) {
              const early=data.frames.filter(s=>s.at>first+12 && s.at<first+285);
              assert(early.length>=5 && sign*(early.at(-1).offset-early[0].offset)>.018,
                name+' keeps travelling in the first 285ms, not hanging for the 420ms intent gap');
              assert(early.slice(1).every((s,i)=>sign*(s.offset-early[i].offset)>-.025),
                name+' does not twitch before quiet');
            }
            if(name==='single') {
              const moving=data.frames.filter(s=>s.at>first+30 && s.at<first+185).map(s=>s.offset);
              assert(moving.length>=4 && moving.at(-1)>.70 && new Set(moving.map(n=>n.toFixed(2))).size>=4,
                '32px crosses midpoint and continues within frames, not after 420ms');
              assert(moving.slice(1).every((s,i)=>s>=moving[i]-.025),'32px no delayed rewind');
            }
          }
          if(!reduce && ['four','eight','sparse'].includes(name)) {
            const path=data.frames.map(s=>s.offset);
            const rewinds=path.slice(1).flatMap((s,i)=>s<path[i]-.025?[{i,from:path[i],to:s,at:data.frames[i+1].at-data.inputs[0].at}]:[]);
            assert(!rewinds.length,name+' no inter-packet magnet reversal '+JSON.stringify(rewinds.slice(0,3)));
          }
          console.log(`${reduce?'reduced':'normal'} ${name}: 30 -> ${rest.toFixed(3)} (${data.inputs.length} trusted)`);
          at=30+step;
        }
      } finally {await context.close();}
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
