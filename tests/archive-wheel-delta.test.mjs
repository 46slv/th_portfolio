import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles: [bundle], metafile } = await build({
  entryPoints: ['src/lib/archiveWheelDelta.ts'], bundle: true, platform: 'neutral', format: 'esm',
  write: false, metafile: true,
});
const { wheelDeltaPixels } = await import(`data:text/javascript;base64,${Buffer.from(bundle.text).toString('base64')}`);

test('delta converter bundles without browser or adapter dependencies', () => {
  assert.deepEqual(Object.keys(metafile.inputs), ['src/lib/archiveWheelDelta.ts']);
});

test('signed and fractional pixel, line, page and unknown-mode packets retain native multiplication', () => {
  const viewport = { innerHeight: 745.5 };
  for (const [mode, factor] of [[0, 1], [1, 16], [2, 745.5], [-1, 1], [3, 1]]) {
    for (const deltaY of [2.25, -2.25, 0, -0]) {
      const result = wheelDeltaPixels({ deltaMode: mode, deltaY }, viewport);
      assert.equal(result, deltaY * factor, `mode=${mode} deltaY=${deltaY}`);
      assert.equal(Object.is(result, -0), Object.is(deltaY * factor, -0));
    }
  }
});

test('reads mode, page height, then delta exactly once; page height is live on every packet', () => {
  const reads = [];
  let height = 400;
  const viewport = { get innerHeight() { reads.push('height'); return height; } };
  const event = {
    get deltaMode() { reads.push('mode'); return 2; },
    get deltaY() { reads.push('delta'); return -0.125; },
  };
  assert.equal(wheelDeltaPixels(event, viewport), -50);
  assert.deepEqual(reads, ['mode', 'height', 'delta']);
  height = 900;
  reads.length = 0;
  assert.equal(wheelDeltaPixels(event, viewport), -112.5);
  assert.deepEqual(reads, ['mode', 'height', 'delta']);
});

test('non-page and fallback packets never read height, and getters are not repeated', () => {
  for (const mode of [0, 1, 11]) {
    const reads = [];
    const event = {
      get deltaMode() { reads.push('mode'); return mode; },
      get deltaY() { reads.push('delta'); return 1.5; },
    };
    const viewport = { get innerHeight() { throw new Error('height was read for non-page mode'); } };
    assert.equal(wheelDeltaPixels(event, viewport), mode === 1 ? 24 : 1.5);
    assert.deepEqual(reads, ['mode', 'delta']);
  }
});
