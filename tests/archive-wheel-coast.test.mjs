import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles: [bundle], metafile } = await build({
  entryPoints: ['src/lib/archiveWheelCoast.ts'], bundle: true, platform: 'neutral', format: 'esm',
  write: false, metafile: true,
});
const { clampVelocity, projectCoast, advanceCoast } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.text).toString('base64')}`
);
const project = (speed, input, drawn = input, count = 10) => projectCoast(speed, input, drawn, count);
const frame = (origin, reach, target, elapsed, count = 10) => advanceCoast(origin, reach, target, elapsed, count);

test('coast core bundles without browser/adapter dependencies', () => {
  assert.deepEqual(Object.keys(metafile.inputs), ['src/lib/archiveWheelCoast.ts']);
});

test('both directions, capped measured velocity and capped travel', () => {
  assert.equal(clampVelocity(100), .024);
  assert.equal(clampVelocity(-100), -.024);
  assert.equal(clampVelocity(.01), .01);
  assert.deepEqual(project(.0065, 3), { reach: 4, detent: 4, atRest: false });
  assert.deepEqual(project(-.0065, 3), { reach: 2, detent: 2, atRest: false });
  assert.deepEqual(project(100, 3), { reach: 5.4, detent: 5, atRest: false });
  assert.deepEqual(project(-100, 3), { reach: .6000000000000001, detent: 1, atRest: false });
  assert.deepEqual(project(.016, 3), project(100, 3));
  assert.deepEqual(project(-.016, 3), project(-100, 3));
});

test('zero speed, integer and fractional rest; input budget is not the drawn arc', () => {
  assert.deepEqual(project(0, 3), { reach: 3, detent: 3, atRest: true });
  assert.deepEqual(project(0, 3.2), { reach: 3.2, detent: 3, atRest: false });
  assert.deepEqual(project(0, 3.2, 3), { reach: 3.2, detent: 3, atRest: false });
  assert.deepEqual(project(0, 3, 3.2), { reach: 3, detent: 3, atRest: false });
  assert.deepEqual(project(0, 2.2, 2.8), { reach: 2.2, detent: 2, atRest: false });
  assert.deepEqual(project(.0065, 2, 2.8), { reach: 3, detent: 3, atRest: false });
  const decay = -Math.expm1(-.0065 * 100);
  assert.deepEqual(frame(2.8, 3, 3, 100), { offset: 2.8 + (3 - 2.8) * decay, stopped: false });
  // Matching the rendered station is insufficient when natural reach is elsewhere.
  assert.deepEqual(project(-.0065, 3, 2), { reach: 2, detent: 2, atRest: true });
});

test('natural reach rounds plainly below, at and above half (including negative travel)', () => {
  for (const [input, detent] of [[2.499, 2], [2.5, 3], [2.501, 3],
    [.499, 0], [.5, 1], [.501, 1]]) {
    assert.equal(project(0, input).detent, detent);
  }
  assert.deepEqual(project(.00325, 2), { reach: 2.5, detent: 3, atRest: false });
  assert.equal(project(-.00325, 3).detent, 3); // 2.5 is an upward tie, not directional
  assert.equal(project(0, 2.5 - Number.EPSILON * 2).detent, 2);
});

test('live range clamps empty, single and endpoints on projection and frames', () => {
  for (const count of [0, 1]) {
    assert.deepEqual(project(100, 0, 0, count), { reach: 0, detent: 0, atRest: true });
    assert.deepEqual(project(-100, 0, 0, count), { reach: 0, detent: 0, atRest: true });
    assert.deepEqual(frame(0, 2, 0, 0, count), { offset: 0, stopped: true });
  }
  assert.deepEqual(project(-100, .1, .1, 4), { reach: 0, detent: 0, atRest: false });
  assert.deepEqual(project(100, 2.9, 2.9, 4), { reach: 3, detent: 3, atRest: false });
  assert.deepEqual(frame(2, 5, 3, 100, 4), { offset: 3, stopped: true });
  assert.deepEqual(frame(1, -2, 0, 100, 4), { offset: 0, stopped: true });
});

test('moving release uses cubic magnetic capture; stationary release uses immediate capture', () => {
  const elapsed = 100;
  const movingDecay = -Math.expm1(-.0065 * elapsed);
  const stillDecay = -Math.expm1(-.015 * elapsed);
  const moving = frame(2, 3, 4, elapsed);
  const still = frame(2, 2, 4, elapsed);
  assert.deepEqual(moving, { offset: 2 + movingDecay + movingDecay * movingDecay * movingDecay, stopped: false });
  assert.deepEqual(still, { offset: 2 + 2 * stillDecay, stopped: false });
  assert.ok(still.offset > moving.offset);
  assert.deepEqual(frame(2, 3, 4, 0), { offset: 2, stopped: false });
});

test('strict early stop and inclusive time limit snap to exact target', () => {
  assert.deepEqual(frame(.003, .003, 0, 0), { offset: .003, stopped: false });
  assert.deepEqual(frame(.003 - Number.EPSILON, .003 - Number.EPSILON, 0, 0),
    { offset: 0, stopped: true });
  assert.deepEqual(frame(.003 + Number.EPSILON, .003 + Number.EPSILON, 0, 0),
    { offset: .003 + Number.EPSILON, stopped: false });
  assert.deepEqual(frame(0, 1, 2, 1249), { offset: 2, stopped: true });
  assert.deepEqual(frame(0, 1, 2, 1250), { offset: 2, stopped: true });
  const beforeLimit = frame(0, 100, 100, 1249, 101);
  assert.equal(beforeLimit.stopped, false);
  assert.ok(beforeLimit.offset < 100 - .003);
  assert.deepEqual(frame(0, 100, 100, 1250, 101), { offset: 100, stopped: true });
});
