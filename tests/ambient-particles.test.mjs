import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = stripTypeScriptTypes(readFileSync(new URL('../src/lib/ambientParticles.ts', import.meta.url), 'utf8'));
const { createGalaxyParticles, galaxyPose, createGalaxy } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('the seeded galaxy has bounded depth and separates ambient dust from reactive particles', () => {
  const stars = createGalaxyParticles();
  assert.deepEqual(stars, createGalaxyParticles());
  assert.equal(stars.length, 540);
  assert.equal(stars.filter(star => star.reactive).length, 72);
  for (const star of stars) {
    const quiet = galaxyPose(star, 10, 0, 300);
    const loud = galaxyPose(star, 10, .8, 300);
    assert(Number.isFinite(loud.x) && Number.isFinite(loud.y));
    assert(loud.size < 4.1 && loud.alpha < .78);
    if (!star.reactive) assert.deepEqual(loud, quiet, 'ambient stars never read the audio envelope');
    else {
      assert.equal(quiet.alpha, 0);
      assert(loud.alpha > 0 && loud.size > quiet.size);
      assert(Math.hypot(loud.x - quiet.x, loud.y - quiet.y) <= 13);
    }
  }
});

test('canvas limits its backing store, holds exact pixels and preserves the pose on the first resumed frame', () => {
  const saved = [globalThis.window, globalThis.document, globalThis.ResizeObserver];
  const callbacks = new Set();
  const motion = { matches: false, addEventListener: (_, fn) => callbacks.add(fn), removeEventListener: (_, fn) => callbacks.delete(fn) };
  let pixels = [], resize;
  const ctx = { setTransform() {}, clearRect() { pixels = []; }, fillRect(...rect) { pixels.push([this.fillStyle, this.globalAlpha, ...rect]); } };
  const canvas = { clientWidth: 1920, clientHeight: 1080, getContext: () => ctx };
  Object.assign(globalThis, {
    window: { matchMedia: () => motion, devicePixelRatio: 3 }, document: { hidden: false },
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} disconnect() {} },
  });
  try {
    const field = createGalaxy(canvas, () => {});
    resize();
    const seed = pixels;
    assert(canvas.width * canvas.height <= 1_350_000);
    field.update(1100, 1); field.update(1150, 1);
    const loud = pixels;
    assert.notDeepEqual(loud, seed);
    assert(loud.length > seed.length);
    field.freeze(true);
    field.update(2200, 0); field.silence();
    assert.equal(pixels, loud);
    field.freeze(false); field.update(12000, 0);
    assert.deepEqual(pixels, loud);
    field.update(12050, 0);
    assert.equal(pixels.length, seed.length, 'silence removes the accented population');
    motion.matches = true; callbacks.forEach(fn => fn());
    assert.deepEqual(pixels, seed);
    field.update(20000, 1);
    assert.deepEqual(pixels, seed);
    field.dispose();
    assert.equal(callbacks.size, 0);
  } finally {
    [globalThis.window, globalThis.document, globalThis.ResizeObserver] = saved;
  }
});
