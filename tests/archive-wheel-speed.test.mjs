import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles: [bundle], metafile } = await build({
  entryPoints: ['src/lib/archiveWheelSpeed.ts'], bundle: true, platform: 'neutral', format: 'esm',
  write: false, metafile: true,
});
const { estimateWheelSpeed } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.text).toString('base64')}`
);
const step = (previous, raw, at, backlog = false, distance = 110) =>
  estimateWheelSpeed(previous, raw, Math.max(-880, Math.min(880, raw)), at, backlog, distance);

test('speed core bundles with only the shared numeric clamp, not the browser adapter', () => {
  assert.deepEqual(Object.keys(metafile.inputs).sort(),
    ['src/lib/archiveWheelCoast.ts', 'src/lib/archiveWheelSpeed.ts']);
});

test('both signs and the shared signed finite velocity clamp', () => {
  for (const sign of [1, -1]) {
    const first = step([], sign * 100, 0);
    assert.equal(first.speed, 0);
    assert.equal(first.lastGap, 0);
    assert.equal(step(first.samples, sign * 40, 20).speed, sign * 40 / 110 / 20);
    assert.equal(step(first.samples, sign * 100, 12).speed, sign * .024);
  }
  assert.equal(step([{ at: 0, pixels: 1 }], 1, 12, false, 220).speed, 1 / 220 / 12);
});

test('strict taper: equality and just above use rest/span, just below uses last/gap for either sign', () => {
  for (const sign of [1, -1]) {
    const previous = [{ at: 0, pixels: sign * 100 }, { at: 20, pixels: sign * 50 }];
    for (const tail of [60, 60.001]) {
      const result = step(previous, sign * tail, 40, false, 220);
      assert.equal(result.lastGap, 20);
      assert.equal(result.speed, sign * (50 + tail) / 220 / 40);
    }
    assert.equal(step(previous, sign * 59.999, 40, false, 220).speed, sign * 59.999 / 220 / 20);
  }
});

test('first packet excluded even when eviction changes which packet is first; 500ms is retained', () => {
  const previous = [{ at: 0, pixels: 40 }, { at: 1, pixels: 90 }];
  const retained = step(previous, 100, 500);
  assert.deepEqual(retained.samples, [...previous, { at: 500, pixels: 100 }]);
  assert.equal(retained.lastGap, 499);
  assert.equal(retained.speed, (90 + 100) / 110 / 500);
  const evicted = step(previous, 100, 501);
  assert.deepEqual(evicted.samples, [{ at: 1, pixels: 90 }, { at: 501, pixels: 100 }]);
  assert.equal(evicted.lastGap, 500);
  assert.equal(evicted.speed, 100 / 110 / 500); // 90 is now the excluded first packet
  assert.deepEqual(previous, [{ at: 0, pixels: 40 }, { at: 1, pixels: 90 }]);
});

test('inclusive elapsed 12 and 500, below/above, including tapered last-gap eligibility', () => {
  const first = [{ at: 0, pixels: 20 }];
  for (const dt of [11, 12, 13, 499, 500, 501]) {
    const result = step(first, 20, dt);
    assert.equal(result.speed, dt >= 12 && dt <= 500 ? 20 / 110 / dt : 0, `dt=${dt}`);
    assert.equal(result.lastGap, dt <= 500 ? dt : 0);
    assert.equal(result.samples.length, dt <= 500 ? 2 : 1);
  }
  const previous = [{ at: 0, pixels: 100 }, { at: 488, pixels: 80 }];
  assert.equal(step(previous, 20, 499).speed, 0); // gap 11, despite span 499
  assert.equal(step(previous, 20, 500).speed, 20 / 110 / 12);
  assert.equal(step([{ at: 0, pixels: 100 }, { at: 1, pixels: 80 }], 20, 501).speed,
    20 / 110 / 500); // gap 500 and span 500 after eviction
});

test('raw +/-220 count; over threshold keeps time but contributes zero', () => {
  for (const sign of [1, -1]) {
    const first = step([], sign * 220, 0);
    assert.equal(step(first.samples, sign * 220, 100).speed, sign * 220 / 110 / 100);
    const over = step(first.samples, sign * 221, 100);
    assert.deepEqual(over.samples, [{ at: 0, pixels: sign * 220 }, { at: 100, pixels: 0 }]);
    assert.equal(over.speed, 0);
    assert.equal(over.lastGap, 100);
    const next = step(over.samples, sign * 30, 120);
    assert.equal(next.lastGap, 20);
    assert.equal(next.speed, sign * 30 / 110 / 20);
  }
  assert.deepEqual(step([], 881, 0).samples, [{ at: 0, pixels: 0 }]);
});

test('sticky backlog suppresses velocity but not window/gap; reset is supplied as empty history', () => {
  const first = step([], 50, 0);
  const blocked = step(first.samples, 50, 20, true);
  assert.deepEqual(blocked.samples, [{ at: 0, pixels: 50 }, { at: 20, pixels: 50 }]);
  assert.equal(blocked.lastGap, 20);
  assert.equal(blocked.speed, 0);
  assert.equal(step(blocked.samples, 50, 40, true).speed, 0);
  const reset = step([], 20, 1000);
  assert.equal(reset.speed, 0);
  assert.deepEqual(reset.samples, [{ at: 1000, pixels: 20 }]);
  assert.equal(step(reset.samples, 20, 1020).speed, 20 / 110 / 20);
});

test('does not mutate its input array or samples', () => {
  const previous = Object.freeze([Object.freeze({ at: 0, pixels: 50 })]);
  const result = step(previous, 30, 20);
  assert.deepEqual(previous, [{ at: 0, pixels: 50 }]);
  assert.notStrictEqual(result.samples, previous);
  assert.deepEqual(result.samples, [{ at: 0, pixels: 50 }, { at: 20, pixels: 30 }]);
});
