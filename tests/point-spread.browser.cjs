// Rebuild-only geometry regression against the previous shell and coordinate gutters.
// Run with TH_PREVIEW_URL, CHROME_PATH, PLAYWRIGHT_CORE and a loopback dev server.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const url = process.env.TH_PREVIEW_URL || 'http://127.0.0.1:4279/archive-rebuild/';
const sizes = [[320,570],[390,650],[430,932],[600,900],[760,900],[761,900],[1098,1249],[1440,900],[1920,1080]];

(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || undefined, headless:true});
  try {
    let nearBreakpoint;
    for (const [width,height] of sizes) {
      const page = await browser.newPage({viewport:{width,height}, reducedMotion:'reduce'});
      await page.goto(url);
      await page.locator('#start-overlay').click();
      await page.waitForFunction(() => !document.body.classList.contains('is-blurred'));
      const measure = () => page.evaluate(() => {
        const rect = el => {const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
        const graph = rect(document.querySelector('#map-target'));
        const plane = rect(document.querySelector('.work-coordinate-plane'));
        const points = [...document.querySelectorAll('#map-target [data-work]')].map(n => {
          const r = n.querySelector('[data-point-float]').getBoundingClientRect();
          return {id:n.dataset.workId,x:r.x+r.width/2,y:r.y+r.height/2, left:parseFloat(n.style.left),bottom:parseFloat(n.style.bottom),r:{x:r.x,y:r.y,right:r.right,bottom:r.bottom}};
        });
        const setting=document.querySelector('.trial-audio-launcher');
        const wheel=document.querySelector('[data-wheel-toggle]');
        return {graph,plane,points,setting:rect(setting),wheel:rect(wheel),
          settingLine:rect(setting.querySelector('.line-action')),
          wheelWord:rect(wheel.querySelector('.archive-wheel__quiet-open')),
          wheelRule:getComputedStyle(wheel,'::before').content};
      });
      const m = await measure();
      assert.equal(m.points.length,96);
      assert.ok(Math.abs(m.graph.width-m.graph.height)<1, 'square graph');
      assert.ok(Math.abs(m.graph.x+m.graph.width/2-width/2)<1 && Math.abs(m.graph.y+m.graph.height/2-height/2)<1,'fixed graph center');
      assert.ok(Math.abs(m.plane.width-m.plane.height)<1, 'equal-scale plane');
      const oldSize = Math.min((width<=760?.68:.70)*height, (width<=760?.84:.46)*width);
      // The original 1px chart border is outside the inset coordinate plane.
      const oldSpan = oldSize - (width>=640?192:128) - 2;
      const xs = m.points.map(p=>p.x), ys=m.points.map(p=>p.y);
      const oldX=(Math.max(...m.points.map(p=>p.left))-Math.min(...m.points.map(p=>p.left)))*oldSpan/100;
      const oldY=(Math.max(...m.points.map(p=>p.bottom))-Math.min(...m.points.map(p=>p.bottom)))*oldSpan/100;
      const ratioX=(Math.max(...xs)-Math.min(...xs))/oldX;
      const ratioY=(Math.max(...ys)-Math.min(...ys))/oldY;
      if(width===600) {
        // 1.7x would require a >636px plane in a 600px viewport.
        assert.ok(m.plane.width>=width-40,'600px plot uses almost the full safe viewport');
        assert.ok(ratioX>=1.45 && ratioY>=1.45,'both dimensions expand despite geometric cap');
      } else {
        assert.ok(m.plane.width/oldSpan>=1.7,`${width}: real plane span ${m.plane.width} / ${oldSpan}`);
        assert.ok(ratioX>=1.7, '96 work centres spread in X');
        assert.ok(ratioY>=1.7, '96 work centres spread in Y');
      }
      assert.ok(Math.min(...xs)>8 && Math.max(...xs)<width-8 && Math.min(...ys)>8 && Math.max(...ys)<height-8,'glyphs within viewport');
      for(const p of m.points) {
        assert.ok(Math.abs(p.x - (m.plane.x + p.left*m.plane.width/100))<.2, 'unchanged X mapping');
        assert.ok(Math.abs(p.y - (m.plane.bottom - p.bottom*m.plane.height/100))<.2, 'unchanged Y mapping');
      }
      if (width<=760) {
        const intersects = (p,r) => p.r.x < r.right && p.r.right > r.x && p.r.y < r.bottom && p.r.bottom > r.y;
        const covered = m.points.filter(p=>intersects(p,m.setting)||intersects(p,m.wheel));
        assert.deepEqual(covered.map(p=>p.id),[],`${width}: collapsed terminals must not cover work glyphs`);
        assert.ok(m.setting.width>=44 && m.wheel.width>=44,'native terminal targets');
        assert.ok(m.settingLine.x>=0 && m.settingLine.right<=width, 'complete standalone Setting word');
        assert.ok(m.wheelWord.x>=0 && m.wheelWord.right<=width && m.wheelRule==='none','complete frameless Wheel word');
      }
      if(width===760) nearBreakpoint=m;
      if(width===761) assert.ok(Math.abs(m.plane.width-nearBreakpoint.plane.width)<20,'no abrupt breakpoint size jump');
      // Neither opening a drawer nor filtering may translate or resize the plane.
      await page.locator('[data-trial-panel="tag"]').click();
      await page.locator('[data-filter-tag="arranged"]').click();
      const after = await measure();
      assert.deepEqual(after.plane,m.plane);
      assert.deepEqual(after.points.map(p=>[p.id,p.left,p.bottom]),m.points.map(p=>[p.id,p.left,p.bottom]));
      if(width<=760) {
        await page.locator('[data-trial-panel="tag"]').click();
        await page.locator('[data-wheel-toggle]').click();
        const access = await page.evaluate(() => {
          const wheel=document.querySelector('#archive-wheel');
          const track=document.querySelector('[data-trial-track]');
          const samples=[...document.querySelectorAll('#map-target [data-work]:not(.is-inactive) [data-point-float]')]
            .flatMap(point=>{const r=point.getBoundingClientRect();return [.2,.5,.8].flatMap(x=>[.2,.5,.8].map(y=>[r.x+x*r.width,r.y+y*r.height]));});
          const hit=([x,y])=>document.elementFromPoint(x,y);
          wheel.style.visibility='hidden';
          const onPoint=samples.map(s=>Boolean(hit(s)?.closest('[data-work]')));
          wheel.style.visibility='';
          const occluded=samples.filter((s,i)=>onPoint[i] && hit(s)?.closest('#archive-wheel')).length;
          const dock=matchMedia('(max-width:600px) and (orientation:portrait)').matches;
          const selected=wheel.querySelector('[aria-current="true"]'), box=selected?.getBoundingClientRect();
          const path=dock ? Boolean(box && selected.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2))) : Array.from({length:101},(_,i)=>i/100).some(f=>{
            const pt=track.getPointAtLength(track.getTotalLength()*f).matrixTransform(track.getScreenCTM());
            return pt.x>12 && pt.x<innerWidth-12 && document.elementFromPoint(pt.x,pt.y)===track;
          });
          return {occluded,path};
        });
        assert.equal(access.occluded,0,'open Wheel does not steal real Point hitboxes');
        assert.ok(access.path,'exposed Wheel line still accepts drag/hover');
      }
      console.log(`${width}x${height}: plane ${m.plane.width.toFixed(1)}px / old ${oldSpan.toFixed(1)}px; ratio ${(m.plane.width/oldSpan).toFixed(2)}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
