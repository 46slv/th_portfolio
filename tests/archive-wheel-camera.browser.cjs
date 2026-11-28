// No server needed: replay the built site, or verify the same behaviour on TH_PREVIEW_URL.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const live = process.env.TH_PREVIEW_URL;
const url = new URL(live || 'http://candidate.test/archive-rebuild/');
const dist = path.resolve(__dirname, '../dist');
const out = process.env.TH_CAMERA_EVIDENCE;
const round = n => Math.round(n * 100) / 100;
async function measure(page) {
  return page.evaluate(() => {
    const $ = s => document.querySelector(s);
    const box = e => { const r=e.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; };
    const visible = e => e.checkVisibility({opacityProperty:true,visibilityProperty:true}) && getComputedStyle(e).display !== 'none';
    const controls=['.trial-audio-launcher','[data-trial-panel="tag"]','[data-trial-panel="year"]','[data-archive-stop]','#site-shell > header','.contact-bar','#site-shell > footer'];
    return {map:box($('#map-target')),sky:box($('#archive-galaxy')),ui:controls.map(s=>box($(s))),
      ticks:[...document.querySelectorAll('.archive-wheel__trial-arc line')].filter(visible).length,
      arc:box($('.archive-wheel__trial-arc')),rim:visible($('.archive-wheel__arc-rim')),id:$('[data-wheel-work].is-selected')?.dataset.workId,
      mapId:$('#map-target [data-work].is-selected')?.dataset.workId,
      tracks:document.querySelectorAll('[data-trial-track]').length};
  });
}
function delta(a,b){return Math.max(...a.flat(Infinity).map((x,i)=>Math.abs(x-b.flat(Infinity)[i])));}
async function exercise(browser,width,height,reducedMotion,stop=false){
  const phone=width===390;
  const context=await browser.newContext({viewport:{width,height},reducedMotion,serviceWorkers:'block',hasTouch:phone});
  try {
    await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==url.origin)return r.abort();if(live)return r.continue();const f=path.resolve(dist,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));return f.startsWith(dist+path.sep)&&fs.existsSync(f)?r.fulfill({path:f}):r.abort();});
    const p=await context.newPage();p.setDefaultTimeout(6000);
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    const resp=await p.goto(url.href);const html=createHash('sha256').update(await resp.body()).digest('hex');
    await p.locator('#start-overlay').click();await p.locator('#start-overlay').waitFor({state:'hidden'});await p.waitForTimeout(1550);
    if(stop)await p.locator('[data-archive-stop]').click();
    const toggle=p.locator('[data-wheel-toggle]');const idle=await measure(p);
    if(!phone)assert.ok(idle.ticks>0,'idle wheel has ticks');
    await toggle.click(); const samples=[]; for(let i=0;i<8;i++){samples.push(await measure(p));await p.waitForTimeout(42);}
    await p.waitForTimeout(500);const open=await measure(p);
    assert.equal(open.ticks,0,'open wheel must have no tick marks');assert.equal(open.rim,false,'open wheel must not draw the decorative rim');
    // The existing phone dock hides Contact while open. Do not count a hidden box as motion.
    const fixed=ui=>phone?ui.slice(0,5):ui;
    const drift=Math.max(...[...samples,open].map(s=>delta(fixed(idle.ui),fixed(s.ui))));
    assert.ok(drift<.5,`fixed controls drifted ${drift}px`);
    assert.ok(Math.abs(idle.map[0]+idle.map[2]/2-width/2)<.5,'idle graph must be centred');
    if(phone){assert.match(await toggle.innerText(),/Close/i);assert.ok(delta(idle.map,open.map)<.5&&delta(idle.sky,open.sky)<.5,'portrait dock must not move the world');}
    else {
      assert.ok(open.map[2]>idle.map[2]+1,'map close-up');assert.ok(open.sky[2]>idle.sky[2]+1,'sky close-up');
      const cx=b=>b[0]+b[2]/2;assert.ok(cx(open.map)<cx(idle.map)-1 && cx(open.sky)<cx(idle.sky)-1,'world pans left toward right wheel');
      if(reducedMotion==='no-preference'&&!stop) for(const key of ['sky','map']) assert.ok(samples.some(s=>s[key][2]>idle[key][2]+.3&&s[key][2]<open[key][2]-.3),`missing intermediate ${key} zoom`);
      if(reducedMotion==='reduce'||stop)assert.ok(delta(samples[0].sky,open.sky)<.5 && delta(samples[0].map,open.map)<.5,'no camera tween on Reduce/Stop');
      // First packet over blank space in the half-disc, never over a label or track.
      const xy=await p.evaluate(()=>{const r=document.querySelector('.archive-wheel__trial-arc').getBoundingClientRect();for(const fy of [-.62,.62,0])for(const fx of [.32,.44,.57,.64]){const x=Math.floor(r.right-r.width*fx),y=Math.floor(r.y+r.height*(1+fy)/2);const e=document.elementFromPoint(x,y);if(e&&!e.closest('[data-work],button,a,[data-trial-track],[data-wheel-work],.trial-drawer,#point-preview'))return{x,y};}});
      assert.ok(xy,'no passive hit point');await p.mouse.move(xy.x,xy.y);await p.mouse.wheel(0,120);
      await p.waitForFunction(id=>document.querySelector('[data-wheel-work].is-selected')?.dataset.workId!==id,open.id);
      await p.waitForTimeout(500);const moved=await measure(p);assert.equal(moved.id,moved.mapId);
    }
    const station=p.locator('[data-wheel-work].is-selected');const id=await station.getAttribute('data-work-id');await station.click();
    const card=p.locator('#trial-detail');await card.waitFor({state:'visible'});assert.equal(await card.getAttribute('data-work-id'),id);
    await p.waitForTimeout(500);const cardLink=p.locator('#trial-detail-link');assert.ok(await cardLink.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'card link must be hittable');
    if(!phone){
      const withCard=async()=>{const scene=await measure(p);const rect=await card.boundingBox();assert.ok(rect,'card must stay open');return {...scene,card:[rect.x,rect.y,rect.width,rect.height]};};
      const cardOpen=await withCard();await toggle.click();await p.waitForTimeout(450);const cardClosed=await withCard();
      assert.ok(delta(cardOpen.card,cardClosed.card)<.5,'wheel must not reposition the open card');
      assert.ok(cardOpen.map[2]>cardClosed.map[2]+1&&cardOpen.map[0]+cardOpen.map[2]/2<cardClosed.map[0]+cardClosed.map[2]/2-1,'map must still pan and zoom with a card');
      await toggle.click();await p.waitForTimeout(450);const again=await withCard();assert.ok(delta(again.card,cardOpen.card)<.5&&delta(again.map,cardOpen.map)<.5,'card open+wheel open must be reversible');
    }
    await p.locator('#trial-detail-close').click();await card.waitFor({state:'hidden'});if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();await p.waitForTimeout(800);
    const closed=await measure(p);assert.ok(delta(idle.map,closed.map)<.5 && delta(idle.sky,closed.sky)<.5,'close must restore world bounds');assert.equal(idle.ticks,closed.ticks);assert.deepEqual(errors,[]);
    return {width,height,reducedMotion,stop,html,idle,open,mid:samples.map(s=>[round(s.map[2]),round(s.sky[2])]),closed,drift};
  }finally{await context.close();}
}
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-proxy-server','--mute-audio']});try{const records=[];for(const args of [[1192,1255,'no-preference'],[1440,900,'reduce'],[1024,768,'no-preference',true],[1200,500,'no-preference'],[800,1000,'reduce'],[390,844,'no-preference']]){const s=await exercise(b,...args);records.push(s);console.log(...args,'ticks',s.idle.ticks,s.open.ticks,s.closed.ticks,'zoom map/sky',round(s.open.map[2]/s.idle.map[2]),round(s.open.sky[2]/s.idle.sky[2]),'UI drift',s.drift);}if(out)fs.writeFileSync(out,JSON.stringify(records,null,2));}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
