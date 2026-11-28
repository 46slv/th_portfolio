import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';

const bundle = async (entryPoints, options = {}) => build({
  entryPoints, bundle: true, platform: 'neutral', format: 'esm', write: false, metafile: true, ...options,
});
const { outputFiles, metafile } = await bundle(['src/lib/archiveSelection.ts']);
const { ArchiveSelection, decideSelection } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);

test('selection core is independent of components, browser, store and navigation adapter', () => {
  assert.deepEqual(Object.keys(metafile.inputs).filter(path =>
    /^(?:src\/pages\/|src\/components\/|src\/lib\/(?:.*Browser|.*Store|archiveNavigation)\.)/i.test(path)), []);
});

test('Point reaffirm differs from Wheel title and rendered station; preview is never a commit', () => {
  let selected = 'a';
  let reads = 0;
  const effects = [];
  const selection = new ArchiveSelection({
    selected: () => { reads++; return selected; },
    apply: command => { effects.push(command); if (command.type === 'commit') selected = command.workId; },
  });
  selection.dispatch({ kind: 'preview', workId: 'b' });
  assert.equal(reads, 0, 'hover/focus previews must not read the committed store');
  selection.dispatch({ kind: 'wheel-title', workId: 'a' });
  selection.dispatch({ kind: 'wheel-station', workId: 'a' });
  assert.deepEqual(effects, []);
  assert.equal(selection.dispatch({ kind: 'point-activate', workId: 'a' }).changed, false);
  assert.deepEqual(effects.splice(0), [{ type: 'commit', workId: 'a', reaffirm: true, fromWheel: false }]);
  selection.dispatch({ kind: 'wheel-title', workId: 'b' });
  assert.deepEqual(effects.splice(0), [{ type: 'commit', workId: 'b', reaffirm: false, fromWheel: false }]);
  selection.dispatch({ kind: 'wheel-station', workId: 'a' });
  assert.deepEqual(effects.splice(0), [
    { type: 'commit', workId: 'a', reaffirm: false, fromWheel: true },
    { type: 'wheel-selected', workId: 'a' },
  ]);
  assert.deepEqual(decideSelection({ kind: 'wheel-station', workId: null }, 'a').commands,
    [{ type: 'commit', workId: null, reaffirm: false, fromWheel: true }]);
  assert.deepEqual(decideSelection({ kind: 'wheel-title', workId: null }, 'a').commands,
    [{ type: 'commit', workId: null, reaffirm: false, fromWheel: false }],
    'a missing title ID must not become an artificial empty-string selection');
});

test('filter retains visible committed ID, clears excluded/empty ID, and never commits the visual fallback', () => {
  const visible = { kind: 'filter', visibleIds: ['a', 'b', 'c'], fallbackIndex: 9 };
  assert.deepEqual(decideSelection(visible, 'b'), { changed: false, station: { kind: 'set', index: 1 }, commands: [] });
  assert.deepEqual(decideSelection(visible, 'missing'), {
    changed: true, station: { kind: 'set', index: 2 },
    commands: [{ type: 'commit', workId: null, reaffirm: false, fromWheel: false }],
  });
  assert.deepEqual(decideSelection(visible, null), { changed: false, station: { kind: 'set', index: 2 }, commands: [] });
  assert.deepEqual(decideSelection({ ...visible, visibleIds: [] }, 'b'), {
    changed: true, station: { kind: 'keep' },
    commands: [{ type: 'commit', workId: null, reaffirm: false, fromWheel: false }],
  });
});

const { outputFiles: [portBundle] } = await bundle([], {
  stdin: {
    contents: `import { dispatchArchiveSelection, dispatchArchiveFilter, isArchiveWheelCommit } from './src/lib/archiveSelectionBrowser';
      import { getSelectedWork, subscribe } from './src/lib/workSelectionStore';
      globalThis.port = { dispatchArchiveSelection, dispatchArchiveFilter, isArchiveWheelCommit, getSelectedWork, subscribe };`,
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
  },
  platform: 'browser', format: 'iife',
});

test('real output port delivers store subscribers synchronously under origin guard, then changed-ID event', () => {
  const events = [];
  const context = vm.createContext({
    window: { dispatchEvent: event => events.push(['event', event.detail, context.port.isArchiveWheelCommit()]) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  });
  vm.runInContext(portBundle.text, context);
  const { dispatchArchiveSelection: send, dispatchArchiveFilter: filter, getSelectedWork, subscribe, isArchiveWheelCommit } = context.port;
  subscribe(id => events.push(['subscriber', id, isArchiveWheelCommit()]));
  events.length = 0;
  send({ kind: 'wheel-station', workId: 'a' });
  assert.deepEqual(events, [['subscriber', 'a', true], ['event', 'a', false]]);
  events.length = 0;
  send({ kind: 'wheel-station', workId: 'a' });
  send({ kind: 'preview', workId: 'b' });
  assert.deepEqual(events, []);
  send({ kind: 'point-activate', workId: 'a' });
  assert.deepEqual(events, [['subscriber', 'a', false]]);
  events.length = 0;
  send({ kind: 'wheel-title', workId: 'b' });
  assert.deepEqual(events, [['subscriber', 'b', false]]);
  events.length = 0;
  let station = 5;
  const applyStation = next => {
    events.push(['station', next.kind, next.kind === 'set' ? next.index : station]);
    if (next.kind === 'set') station = next.index;
  };
  filter(['a', 'b'], 5, applyStation);
  assert.equal(getSelectedWork(), 'b');
  assert.equal(station, 1);
  assert.deepEqual(events, [['station', 'set', 1]]);
  events.length = 0;
  filter([], station, applyStation);
  assert.equal(getSelectedWork(), null);
  assert.equal(station, 1);
  assert.deepEqual(events, [['station', 'keep', 1], ['subscriber', null, false]]);
  events.length = 0;
  filter(['a', 'b', 'c'], station, applyStation);
  assert.equal(getSelectedWork(), null);
  assert.equal(station, 1);
  assert.deepEqual(events, [['station', 'set', 1]], 'restore never commits a visual fallback');
  events.length = 0;
  send({ kind: 'wheel-title', workId: 'c' });
  events.length = 0;
  filter(['a'], station, applyStation);
  assert.equal(getSelectedWork(), null);
  assert.deepEqual(events, [['station', 'set', 0], ['subscriber', null, false]],
    'set the clamped station before the synchronous null subscriber');
  events.length = 0;
  send({ kind: 'wheel-station', workId: 'a' });
  events.length = 0;
  send({ kind: 'wheel-station', workId: null });
  assert.deepEqual(events, [['subscriber', null, true]], 'clearing a station cannot preview a null ID');
});
