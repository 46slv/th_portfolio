import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles: [bundle], metafile } = await build({
  entryPoints: ['src/lib/archiveWheelInput.ts'], bundle: true, platform: 'neutral', format: 'esm',
  write: false, metafile: true,
});
const core = await import(`data:text/javascript;base64,${Buffer.from(bundle.text).toString('base64')}`);
const { decideDirectWheel: direct, decideDocumentWheel: doc, resolveMeasuredWheel: measured,
  insideOpenDisc: inside, ownWheel: own, movedFromWheel: moved, continuesWheel: continues,
  lightGestureGap: gap } = core;
const p = { x: 50, y: 50, at: 1000 };
const hit = { ...p, at: 900 };
const directPacket = { ...p, lastHit: null, collapsed: false, ctrlKey: false, controlHit: false, directHit: false };
const docPacket = { ...p, lastHit: null, defaultPrevented: false, active: true,
  ctrlKey: false, protectedHit: false, directHit: false };

test('core bundle has no browser or adapter dependencies', () => {
  assert.deepEqual(Object.keys(metafile.inputs), ['src/lib/archiveWheelInput.ts']);
});

test('direct and document precedence: consumed packets cannot rearm, protected fallback beats hit and continuation', () => {
  assert.equal(direct({ ...directPacket, collapsed: true, ctrlKey: true, directHit: true }), 'pass');
  assert.equal(direct({ ...directPacket, ctrlKey: true, directHit: true }), 'clear');
  assert.equal(direct({ ...directPacket, controlHit: true, directHit: true, lastHit: hit }), 'clear');
  assert.equal(direct({ ...directPacket, directHit: true }), 'consume');
  assert.equal(direct({ ...directPacket, lastHit: hit }), 'consume');
  assert.equal(direct(directPacket), 'pass');
  // A document-protected descendant can be consumed by direct continuation;
  // its bubbling packet is then defaultPrevented and must not clear ownership.
  assert.equal(doc({ ...docPacket, defaultPrevented: true, active: false, ctrlKey: true,
    protectedHit: true, directHit: true, lastHit: hit }), 'pass');
  assert.equal(doc({ ...docPacket, active: false, directHit: true, lastHit: hit }), 'clear');
  assert.equal(doc({ ...docPacket, ctrlKey: true, directHit: true, lastHit: hit }), 'clear');
  assert.equal(doc({ ...docPacket, protectedHit: true, directHit: true, lastHit: hit }), 'clear');
  assert.equal(doc({ ...docPacket, directHit: true }), 'consume');
  assert.equal(doc({ ...docPacket, lastHit: hit }), 'consume');
  assert.equal(doc(docPacket), 'measure');
  assert.equal(measured(true), 'consume');
  assert.equal(measured(false), 'clear');
  // Direct's collapsed/pass or passive/pass flows to document's clear/measure.
  assert.equal(doc({ ...docPacket, active: false }), 'clear');
});

test('continuation boundary, stationary refresh without anchor crawl, pointer release', () => {
  const first = { x: 10, y: 20, at: 0 };
  assert.equal(gap, 420);
  assert.equal(continues(first, { x: 12.999, y: 20, at: gap }), true);
  assert.equal(continues(first, { x: 13, y: 20, at: gap }), false);
  assert.equal(continues(first, { x: 10, y: 20, at: gap + 1 }), false);
  assert.equal(doc({ ...docPacket, x: 10, y: 20, at: gap, lastHit: first }), 'consume');
  assert.equal(doc({ ...docPacket, x: 10, y: 20, at: gap + 1, lastHit: first }), 'measure');
  let anchor = first;
  for (let i = 1; i <= 5; i++) {
    anchor = own(anchor, { x: 10 + i * .5, y: 20, at: i * 40 });
    assert.equal(anchor.x, 10);
    assert.equal(anchor.at, i * 40);
  }
  assert.equal(moved(anchor, { x: 12.999, y: 20 }), false);
  assert.equal(moved(anchor, { x: 13, y: 20 }), true);
  assert.deepEqual(own(anchor, { x: 13, y: 20, at: 240 }), { x: 13, y: 20, at: 240 });
  assert.equal(moved(null, { x: 100, y: 100 }), false);
  assert.equal(continues(null, p), false);
});

test('live clipped half ellipse, viewport edges, boundary and degenerate boxes', () => {
  const viewport = { width: 200, height: 100 };
  const rect = { left: 20, right: 100, top: 10, width: 80, height: 80 };
  for (const point of [{ x: 20, y: 50 }, { x: 100, y: 10 }, { x: 100, y: 90 }, { x: 100, y: 50 }])
    assert.equal(inside(point, viewport, rect), true);
  for (const point of [{ x: 19.99, y: 50 }, { x: 100.01, y: 50 }, { x: 60, y: 10 },
    { x: -1, y: 50 }, { x: 200, y: 50 }, { x: 50, y: 100 }])
    assert.equal(inside(point, viewport, rect), false);
  assert.equal(inside({ x: 0, y: 50 }, viewport, { ...rect, left: 0, right: 80 }), true);
  assert.equal(inside({ x: 199, y: 50 }, viewport, { ...rect, left: 119, right: 199 }), true);
  assert.equal(inside({ x: 20, y: 50 }, viewport, null), false);
  assert.equal(inside({ x: 20, y: 50 }, viewport, { ...rect, width: 0 }), false);
  assert.equal(inside({ x: 20, y: 50 }, viewport, { ...rect, height: 0 }), false);
});
