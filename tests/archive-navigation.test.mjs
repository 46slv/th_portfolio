import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// The existing build tool strips TS and bundles pure imports while retaining real ESM exports.
const { outputFiles, metafile } = await build({
  entryPoints: ['src/lib/archiveNavigation.ts'],
  bundle: true, platform: 'neutral', format: 'esm', write: false, metafile: true,
});
const { ArchiveNavigation } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);

function harness() {
  const commands = [];
  const navigation = new ArchiveNavigation({ apply: command => commands.push(command) });
  const take = () => commands.splice(0);
  return { navigation, take };
}
const types = commands => commands.map(c => c.type);

test('close restores its origin; switch dismisses without returning focus; detail Point selects but Wheel label does not', () => {
  const { navigation: n, take } = harness();
  n.toggle('tag');
  assert.deepEqual(types(take()), ['dismiss-preview', 'present']);
  n.toggle('audio');
  assert.deepEqual(take(), [
    { type: 'dismiss-preview' }, { type: 'present', active: 'audio', exiting: null },
  ]);
  n.explicitClose(true);
  assert.deepEqual(take(), [
    { type: 'present', active: null, exiting: null },
    { type: 'focus', target: { kind: 'disclosure', panel: 'audio' } },
  ]);
  assert.equal(n.openWork({ kind: 'point', workId: 'w1' }, false), false);
  assert.deepEqual(take(), []);
  assert.equal(n.openWork({ kind: 'point', workId: 'w1' }, true), true);
  const opened = take();
  assert.deepEqual(types(opened), ['select-work', 'dismiss-preview', 'present', 'render-detail', 'focus']);
  assert.deepEqual(opened.filter(c => c.type === 'select-work' || c.type === 'render-detail'), [
    { type: 'select-work', workId: 'w1' }, { type: 'render-detail', workId: 'w1' },
  ]);
  n.wheelSelected('w2', true);
  assert.deepEqual(take(), [{ type: 'render-detail', workId: 'w2' }]);
  n.escape(true);
  assert.deepEqual(take(), [
    { type: 'clear-detail' }, { type: 'present', active: null, exiting: null },
    { type: 'focus', target: { kind: 'point', workId: 'w1' } },
  ]);
  n.openWork({ kind: 'wheel', workId: 'w3' }, true);
  const wheelOpened = take();
  assert.deepEqual(types(wheelOpened), ['dismiss-preview', 'present', 'render-detail', 'focus']);
  assert.deepEqual(wheelOpened[2], { type: 'render-detail', workId: 'w3' });
  n.explicitClose(true);
  assert.deepEqual(take().at(-1), { type: 'focus', target: { kind: 'wheel', workId: 'w3' } });
});

test('toggle visual-close and explicit close are semantic now; outside/filter close is instant', () => {
  const { navigation: n, take } = harness();
  n.toggle('audio'); take();
  n.toggle('audio');
  const closed = take();
  assert.equal(n.active, null);
  assert.deepEqual(types(closed), ['present', 'begin-exit']);
  assert.equal(closed[0].exiting, 'audio');
  assert.deepEqual(closed[1], { type: 'begin-exit', panel: 'audio', token: closed[1].token, cause: 'toggle' });
  n.finishExit(closed[1].token);
  assert.deepEqual(take(), [{ type: 'finish-exit', panel: 'audio', token: closed[1].token }]);
  n.openWork({ kind: 'wheel', workId: 'w' }, true); take();
  n.filtersApplied();
  assert.deepEqual(take(), [{ type: 'clear-detail' }, { type: 'present', active: null, exiting: null }]);
  n.toggle('year'); take();
  n.outsideClose();
  assert.deepEqual(take(), [{ type: 'present', active: null, exiting: null }]);
  n.toggle('year'); take();
  n.escape();
  const escaped = take();
  assert.deepEqual(types(escaped), ['present', 'begin-exit', 'focus']);
  assert.equal(escaped[1].cause, 'escape');
});

test('explicit close and Escape retain focus order but carry different exit causes', () => {
  const { navigation: n, take } = harness();
  n.toggle('audio'); take();
  n.explicitClose();
  const closed = take();
  assert.deepEqual(types(closed), ['present', 'begin-exit', 'focus']);
  assert.equal(closed[1].cause, 'explicit-close');
  assert.deepEqual(closed[2], { type: 'focus', target: { kind: 'disclosure', panel: 'audio' } });
  n.toggle('audio'); take();
  n.escape();
  const escaped = take();
  assert.deepEqual(types(escaped), types(closed));
  assert.equal(escaped[1].cause, 'escape');
  assert.deepEqual(escaped[2], closed[2]);
});

test('cancelled exit completion cannot hide a reopened or switched panel; completed exit also reopens', () => {
  const { navigation: n, take } = harness();
  n.toggle('tag'); take();
  n.escape();
  const first = take().find(c => c.type === 'begin-exit');
  n.toggle('tag');
  assert.deepEqual(types(take()), ['cancel-exit', 'dismiss-preview', 'present']);
  n.finishExit(first.token);
  assert.deepEqual(take(), []);
  assert.equal(n.active, 'tag');
  n.escape();
  const second = take().find(c => c.type === 'begin-exit');
  n.toggle('audio');
  assert.deepEqual(types(take()), ['cancel-exit', 'dismiss-preview', 'present']);
  n.finishExit(second.token);
  assert.deepEqual(take(), []);
  assert.equal(n.active, 'audio');
  n.escape();
  const third = take().find(c => c.type === 'begin-exit');
  n.finishExit(third.token);
  assert.deepEqual(take(), [{ type: 'finish-exit', panel: 'audio', token: third.token }]);
  n.toggle('audio');
  assert.deepEqual(types(take()), ['dismiss-preview', 'present']);
});

test('reopening detail during its visual exit cancels stale cleanup before new content', () => {
  const { navigation: n, take } = harness();
  n.openWork({ kind: 'point', workId: 'first' }, true); take();
  n.explicitClose();
  const exit = take().find(c => c.type === 'begin-exit');
  n.openWork({ kind: 'wheel', workId: 'second' }, true);
  assert.deepEqual(types(take()), ['cancel-exit', 'dismiss-preview', 'present', 'render-detail', 'focus']);
  n.finishExit(exit.token);
  assert.deepEqual(take(), []);
  assert.equal(n.active, 'detail');
  n.explicitClose(true);
  assert.deepEqual(take().at(-1), { type: 'focus', target: { kind: 'wheel', workId: 'second' } });
});

test('detail close retains origin only until close; filter update does not dismiss another panel', () => {
  const { navigation: n, take } = harness();
  n.openWork({ kind: 'point', workId: 'a' }, true); take();
  n.wheelSelected('b', false);
  assert.deepEqual(take(), []);
  n.toggle('tag');
  assert.deepEqual(types(take()), ['dismiss-preview', 'clear-detail', 'present']);
  n.filtersApplied();
  assert.deepEqual(take(), []);
  n.explicitClose(true);
  assert.deepEqual(take().at(-1), { type: 'focus', target: { kind: 'disclosure', panel: 'tag' } });
});

test('inner boundary does not depend on page, component, browser adapter or store modules', () => {
  const inputs = Object.keys(metafile.inputs);
  assert.ok(inputs.some(path => path.endsWith('src/lib/archiveNavigation.ts')));
  assert.deepEqual(inputs.filter(path =>
    /^(?:src\/pages\/|src\/components\/|src\/lib\/(?:.*Browser|.*Store|workThumbnail)\.)/i.test(path)
  ), []);
});
