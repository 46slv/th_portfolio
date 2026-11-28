import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { outsideScope } from '../scripts/check-edit-scope.mjs';

// Layout can observe the root's disclosure state to reserve space. Its sheets
// must never paint wheel internals, including tokens that can change the shape.
const root = new URL('../src/',import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const observesOpenWheel = ':has(#archive-wheel:not(.is-collapsed))';
// Complete selectors, not fragments. Add an entry here only for a new page-layout contract.
const layoutObservers = new Set([
  `body.archive-rebuild${observesOpenWheel}`,
  'body.archive-rebuild:not(:has(#archive-wheel:not(.is-collapsed), #trial-detail:not([hidden]))) .main-layout > div:first-child',
  `body.archive-trial.archive-rebuild${observesOpenWheel}`,
  `body.archive-trial.archive-rebuild${observesOpenWheel} .contact-bar`,
]);
function foreignWheelRule(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@import\s+[^;]+;/g,'')
    .replace(/([^{};]+)\{/g,(full,selector)=>layoutObservers.has(selector.trim().replace(/\s+/g,' '))?'{':full)
    .replace(/var\(\s*--archive-wheel-radius\s*\)/g,'');
  return /#archive-wheel\b|\.archive-wheel(?:__|\b)|\.line-action-wheel\b|\[data-(?:wheel-|trial-track\b)|--(?:archive-wheel-radius|archive-rail|th-open-dock)\s*:/.test(text);
}
function sources(dir='') {
  return readdirSync(new URL(dir,root),{withFileTypes:true}).flatMap(e=>e.isDirectory()?sources(dir+e.name+'/'):[dir+e.name]);
}

test('page composition may observe the wheel slot but cannot style its internals',()=>{
  for (const path of sources()) {
    if (['components/works/ArchiveWheel.astro','styles/archive/wheel-desktop.css','styles/archive/wheel-portrait-dock.css','styles/archive/wheel-disclosure.css'].includes(path)) continue;
    const sheets=path.endsWith('.css')?[read(path)]:path.endsWith('.astro')?[...read(path).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]):[];
    for(const sheet of sheets) assert.equal(foreignWheelRule(sheet),false,'Wheel-owned rule in '+path);
  }
});
test('guard rejects the original failure modes, without blocking map/card layout',()=>{
  assert.ok(foreignWheelRule('body #archive-wheel.is-collapsed .archive-wheel__trial-arc{opacity:0}'));
  assert.ok(foreignWheelRule('body [data-wheel-toggle]::before{content:""}'));
  assert.ok(foreignWheelRule('body{--archive-wheel-radius:0px}'));
  assert.ok(foreignWheelRule(':is(#archive-wheel:not(.is-collapsed)) > svg {display:none}'));
  assert.ok(foreignWheelRule(`body.archive-rebuild${observesOpenWheel}, :is(#archive-wheel:not(.is-collapsed)) > svg {display:none}`));
  assert.ok(foreignWheelRule('body:has(#archive-wheel:not(.is-collapsed)) svg{display:none}'));
  assert.ok(!foreignWheelRule(`body.archive-rebuild${observesOpenWheel}{--archive-lane:var(--archive-wheel-radius)}`));
  assert.ok(!foreignWheelRule('body.archive-rebuild:not(:has(#archive-wheel:not(.is-collapsed), #trial-detail:not([hidden]))) .main-layout > div:first-child {left:50%}'));
  assert.ok(!foreignWheelRule('body.archive-trial.archive-rebuild:has(#archive-wheel:not(.is-collapsed)) .contact-bar {display:none}'));
});
test('browsing adapters and wheel geometry do not depend on audio playback or the ambient clock',()=>{
  for(const path of ['components/works/ArchiveWheel.astro','components/works/PointPreview.astro','components/works/wheelGeometry.ts','lib/archiveNavigationBrowser.ts','lib/archiveSelection.ts']) {
    assert.doesNotMatch(read(path), /(?:from\s*|import\s*\()\s*['"][^'"]*(?:archiveClock|audioEngine)['"]/,path);
  }
});
test('audio-only and map-only tickets reject an unrelated wheel edit',()=>{
  const wheel='components/works/ArchiveWheel.astro', audio='lib/audio/audioEngine.ts',map='styles/archive-rebuild.css';
  for(const file of [audio,map]) assert.deepEqual(outsideScope([file,wheel],[file]),[wheel]);
  assert.deepEqual(outsideScope([map],[map]),[]);
});
