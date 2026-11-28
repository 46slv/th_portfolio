import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const { outputFiles } = await build({entryPoints:['src/lib/archiveClock.ts'], bundle:true, platform:'neutral', format:'esm', write:false});
const { archiveClock, bindArchiveStop } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('Stop holds ambient time and backdrop effects without blocking archive navigation', () => {
  const saved = [globalThis.performance, globalThis.document, globalThis.getComputedStyle];
  let wall = 550, click, label;
  const transitions = [], attributes = new Set();
  const effect = playState => ({
    playState, currentTime: 120,
    pause() { this.playState = 'paused'; this.currentTime += 5; },
    play() { this.playState = 'running'; },
  });
  const travel = effect('running');
  const alreadyPaused = effect('paused');
  const enteringCard = effect('running');
  const ambient = { style: { filter: '' }, computedFilter: 'brightness(0.65)', getAnimations: () => [travel, alreadyPaused] };
  const scope = { style: { filter: 'brightness(0.9)' }, computedFilter: 'brightness(0.8)' };
  const scene = { inert: false, querySelector: () => ambient, querySelectorAll: () => [ambient, scope] };
  const button = { addEventListener: (_, callback) => { click = callback; }, setAttribute: (_, value) => { label = value; } };
  const content = { inert: true, querySelector: () => button };
  globalThis.performance = { now: () => wall };
  globalThis.getComputedStyle = node => ({ filter: node.computedFilter });
  globalThis.document = {
    getElementById: id => ({ 'archive-content': content, 'archive-scene': scene }[id]),
    getAnimations: () => [travel, alreadyPaused, enteringCard],
    body: { setAttribute: name => attributes.add(name), removeAttribute: name => attributes.delete(name) },
  };
  try {
    archiveClock.subscribe(stopped => transitions.push(stopped));
    bindArchiveStop();
    click();
    assert.equal(archiveClock.stopped, false, 'startup inert still guards Stop');
    content.inert = false;
    wall += 35;
    click();
    assert.equal(content.inert, false);
    assert.equal(scene.inert, false);
    assert.equal(enteringCard.playState, 'running');
    assert.equal(travel.playState, 'paused');
    assert.equal(travel.currentTime, 120);
    assert.equal(ambient.style.filter, 'brightness(0.65)');
    assert.equal(scope.style.filter, 'brightness(0.8)');
    assert.equal(attributes.has('data-archive-stopped'), true);
    assert.equal(label, 'Resume archive');
    wall += 2000;
    assert.equal(archiveClock.now(), 585);
    click();
    wall += 65;
    assert.equal(archiveClock.now(), 650);
    assert.equal(ambient.style.filter, '');
    assert.equal(scope.style.filter, 'brightness(0.9)');
    assert.equal(travel.playState, 'running');
    assert.equal(alreadyPaused.playState, 'paused');
    assert.equal(attributes.has('data-archive-stopped'), false);
    assert.equal(label, 'Stop archive');
    assert.deepEqual(transitions, [true, false]);
  } finally {
    archiveClock.setStopped(false);
    [globalThis.performance, globalThis.document, globalThis.getComputedStyle] = saved;
  }
});
