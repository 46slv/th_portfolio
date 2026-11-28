import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the production browser adapter and its real use case, not a copied exit handler.
const { outputFiles } = await build({
  entryPoints: ['src/lib/archiveNavigationBrowser.ts'],
  bundle: true, platform: 'neutral', format: 'esm', write: false,
});
const { bootArchiveNavigation } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);

class Element {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.hidden = true;
    this.inert = false;
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = { contains: () => false, toggle: () => {} };
    this.offsetWidth = 180;
    this.offsetHeight = 100;
  }
  addEventListener(type, callback) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }
  fire(type, event = {}) { for (const callback of this.listeners.get(type) ?? []) callback(event); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 30, right: 70, top: 30, bottom: 70, height: 40 }; }
  focus() { this.focused = true; }
  replaceChildren() {}
  before() {}
  after() {}
  closest(selector) {
    if (!this.dataset.wheelWork) return null;
    return selector === '[data-wheel-work]' || selector.includes('[data-work]') ? this : null;
  }
  contains(target) { return target === this; }
  matches() { return false; }
  animate(keyframes, options) {
    let resolve;
    const finished = new Promise(done => { resolve = done; });
    const animation = { keyframes, options, finished, resolve: () => resolve(), cancels: 0,
      cancel() { this.cancels++; } };
    this.animations ??= [];
    this.animations.push(animation);
    return animation;
  }
}

async function fixture(run) {
  const originals = Object.fromEntries(['document', 'window', 'CSS', 'HTMLElement', 'matchMedia', 'ResizeObserver', 'getComputedStyle', 'performance']
    .map(key => [key, globalThis[key]]));
  const filter = new Element();
  const audio = new Element();
  const detail = new Element();
  const filterButton = new Element({ trialPanel: 'tag' });
  const year = new Element();
  const yearButton = new Element({ trialPanel: 'year' });
  const audioButton = new Element({ trialPanel: 'audio' });
  const detailClose = new Element();
  const audioClose = new Element();
  const work = new Element({ wheelWork: '', workId: 'w1' });
  work.dataset.wheelWork = 'w1';
  const elements = {
    'trial-tag': filter, 'trial-year': year, 'trial-audio': audio, 'trial-detail': detail,
    'trial-detail-close': detailClose, 'trial-detail-thumbnail': new Element(),
    'trial-detail-link': new Element(), 'trial-detail-title': new Element(),
    'trial-detail-meta': new Element(), 'trial-detail-tags': new Element(),
  };
  const document = new Element();
  document.getElementById = id => elements[id] ?? null;
  document.querySelector = selector => selector === '.trial-audio-close' ? audioClose : null;
  document.querySelectorAll = selector => selector === '[data-trial-panel]' ? [filterButton, yearButton, audioButton]
    : selector === '[data-work][data-work-id]' ? [work] : [];
  document.documentElement = { clientWidth: 1440, clientHeight: 900 };
  document.body = new Element();
  const window = new Element();
  window.dispatchEvent = () => {};
  let reduced = false;
  window.matchMedia = query => Object.assign(new Element(), { matches: query.includes('reduced-motion') && reduced });
  let nextId = 0;
  const timers = new Map();
  let now = 0;
  const advance = ms => {
    now += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.due <= now) { timers.delete(id); timer.callback(); }
    }
  };
  window.setTimeout = (callback, delay) => {
    const id = ++nextId;
    timers.set(id, { callback, due: now + delay, delay });
    return id;
  };
  window.clearTimeout = id => { timers.delete(id); };
  try {
    Object.assign(globalThis, {
      document, window, HTMLElement: Element, CSS: { escape: value => value }, matchMedia: window.matchMedia,
      ResizeObserver: class { observe() {} },
      getComputedStyle: () => ({ opacity: '1', translate: 'none' }), performance: { now: () => now },
    });
    bootArchiveNavigation();
    const state = { filter, year, audio, detail, filterButton, yearButton, audioButton, audioClose, detailClose, work, document,
      timers, advance, reduce: value => { reduced = value; },
      escape: () => document.fire('keydown', { key: 'Escape' }),
      clickWork: () => document.fire('click', { target: work }),
    };
    await run(state);
  } finally {
    Object.assign(globalThis, originals);
  }
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const exitState = panel => {
  assert.equal(panel.hidden, false);
  assert.equal(panel.inert, true);
  assert.equal(panel.getAttribute('aria-hidden'), 'true');
  assert.equal(panel.style.pointerEvents, 'none');
};
const cleaned = panel => {
  assert.equal(panel.hidden, true);
  assert.equal(panel.inert, false);
  assert.equal(panel.getAttribute('aria-hidden'), null);
  assert.equal(panel.style.pointerEvents ?? '', '');
};

test('held Filter animation stays visible before 100ms, then the deadline hides and removes its effect', async () => fixture(async s => {
  s.filterButton.fire('click');
  s.escape();
  const animation = s.filter.animations[0];
  assert.equal(animation.options.duration, 100);
  assert.equal(animation.options.fill, 'forwards');
  assert.equal(s.filterButton.getAttribute('aria-expanded'), 'false');
  assert.equal(s.filterButton.focused, true);
  exitState(s.filter);
  assert.deepEqual([...s.timers.values()].map(t => t.delay), [100]);
  s.advance(99);
  exitState(s.filter);
  s.advance(1);
  cleaned(s.filter);
  assert.equal(animation.cancels, 1);
  assert.equal(s.timers.size, 0);
  s.filterButton.fire('click');
  animation.resolve();
  await flush();
  assert.equal(s.filter.hidden, false);
}));

test('Filter animation finishing first clears the deadline; stale timer cannot hide a reopened panel', async () => fixture(async s => {
  s.filterButton.fire('click');
  s.filterButton.fire('click');
  const stale = [...s.timers.values()][0].callback;
  const animation = s.filter.animations[0];
  animation.resolve();
  await flush();
  cleaned(s.filter);
  assert.equal(animation.cancels, 1);
  assert.equal(s.timers.size, 0);
  s.filterButton.fire('click');
  stale();
  s.advance(100);
  assert.equal(s.filter.hidden, false);
}));

test('cancel/reopen/reclose: late animation and timer callbacks cannot finish the new exit', async () => fixture(async s => {
  s.filterButton.fire('click');
  s.escape();
  const first = s.filter.animations[0];
  const stale = [...s.timers.values()][0].callback;
  s.filterButton.fire('click');
  assert.equal(first.cancels, 1);
  assert.equal(s.timers.size, 0);
  assert.equal(s.filter.hidden, false);
  assert.equal(s.filter.inert, false);
  stale();
  first.resolve();
  await flush();
  assert.equal(s.filter.hidden, false);
  s.escape();
  const second = s.filter.animations[1];
  stale();
  first.resolve();
  await flush();
  exitState(s.filter);
  assert.equal(second.cancels, 0);
  assert.equal(s.timers.size, 1);
  s.advance(100);
  cleaned(s.filter);
  assert.equal(second.cancels, 1);
  assert.equal(s.timers.size, 0);
}));

test('held Audio Escape restores focus, stays visible at 99ms, and hides with its effect removed at 100ms', async () => fixture(async s => {
  s.audioButton.fire('click');
  s.escape();
  const animation = s.audio.animations[0];
  assert.equal(animation.options.duration, 100);
  assert.equal(animation.options.fill, 'forwards');
  assert.equal(s.audioButton.getAttribute('aria-expanded'), 'false');
  assert.equal(s.audioButton.focused, true);
  exitState(s.audio);
  assert.deepEqual([...s.timers.values()].map(t => t.delay), [100]);
  s.advance(99);
  exitState(s.audio);
  s.advance(1);
  cleaned(s.audio);
  assert.equal(animation.cancels, 1);
  assert.equal(s.timers.size, 0);
  s.audioButton.fire('click');
  animation.resolve();
  await flush();
  assert.equal(s.audio.hidden, false);
}));

test('Audio Escape animation-first completion clears deadline; stale callbacks cannot hide a newer exit', async () => fixture(async s => {
  s.audioButton.fire('click');
  s.escape();
  const first = s.audio.animations[0];
  const stale = [...s.timers.values()][0].callback;
  first.resolve();
  await flush();
  cleaned(s.audio);
  assert.equal(first.cancels, 1);
  assert.equal(s.timers.size, 0);
  s.audioButton.fire('click');
  s.escape();
  const second = s.audio.animations[1];
  stale();
  first.resolve();
  await flush();
  exitState(s.audio);
  assert.equal(second.cancels, 0);
  assert.equal(s.timers.size, 1);
  s.advance(100);
  cleaned(s.audio);
  assert.equal(second.cancels, 1);
}));

test('Audio Escape cancellation on switch/reopen/reclose guards late timer and animation callbacks', async () => fixture(async s => {
  s.audioButton.fire('click');
  s.escape();
  const first = s.audio.animations[0];
  const stale = [...s.timers.values()][0].callback;
  s.filterButton.fire('click');
  cleaned(s.audio);
  assert.equal(first.cancels, 1);
  assert.equal(s.timers.size, 0);
  stale();
  first.resolve();
  await flush();
  assert.equal(s.filter.hidden, false);
  s.audioButton.fire('click');
  s.escape();
  const second = s.audio.animations[1];
  stale();
  first.resolve();
  await flush();
  exitState(s.audio);
  assert.equal(second.cancels, 0);
  assert.equal(s.timers.size, 1);
  s.audioButton.fire('click');
  assert.equal(s.timers.size, 0);
  assert.equal(second.cancels, 1);
  assert.equal(s.audio.hidden, false);
  s.escape();
  const third = s.audio.animations[2];
  second.resolve();
  stale();
  await flush();
  exitState(s.audio);
  assert.equal(third.cancels, 0);
  s.advance(100);
  cleaned(s.audio);
  assert.equal(third.cancels, 1);
}));

test('Year has an independent disclosure, horizontal exit, and its own focus return', async () => fixture(async s => {
  s.filterButton.fire('click');
  s.yearButton.fire('click');
  assert.equal(s.filter.hidden, true);
  assert.equal(s.year.hidden, false);
  assert.equal(s.filterButton.getAttribute('aria-expanded'), 'false');
  assert.equal(s.yearButton.getAttribute('aria-expanded'), 'true');
  s.escape();
  assert.equal(s.yearButton.focused, true);
  assert.equal(s.filterButton.focused, undefined);
  assert.equal(s.year.animations[0].keyframes.at(-1).translate, '-12px 0');
  s.advance(100);
  cleaned(s.year);
}));

test('Audio toggle and close button remain animation-only with their original focus behavior', async () => fixture(async s => {
  s.audioButton.fire('click');
  s.audioButton.fire('click');
  exitState(s.audio);
  assert.equal(s.audioButton.focused, undefined);
  assert.equal(s.timers.size, 0);
  s.advance(100);
  exitState(s.audio);
  s.audio.animations[0].resolve();
  await flush();
  cleaned(s.audio);
  s.audioButton.fire('click');
  s.audioClose.fire('click');
  exitState(s.audio);
  assert.equal(s.audioButton.focused, true);
  assert.equal(s.timers.size, 0);
  s.advance(100);
  exitState(s.audio);
  s.audio.animations[1].resolve();
  await flush();
  cleaned(s.audio);
}));

test('Audio outside close remains immediate, without focus restoration or an animation', async () => fixture(async s => {
  s.audioButton.fire('click');
  s.document.fire('click', { target: new Element() });
  cleaned(s.audio);
  assert.equal(s.audio.animations, undefined);
  assert.equal(s.audioButton.focused, undefined);
  assert.equal(s.timers.size, 0);
}));

test('reduced Filter and Audio Escape are immediate; Detail Escape still has no deadline', async () => fixture(async s => {
  s.reduce(true);
  s.filterButton.fire('click');
  s.escape();
  cleaned(s.filter);
  assert.equal(s.filter.animations, undefined);
  assert.equal(s.timers.size, 0);
  s.audioButton.fire('click');
  s.escape();
  cleaned(s.audio);
  assert.equal(s.audio.animations, undefined);
  assert.equal(s.audioButton.focused, true);
  assert.equal(s.timers.size, 0);
  s.reduce(false);
  s.clickWork();
  assert.equal(s.detail.hidden, false);
  s.escape();
  exitState(s.detail);
  assert.equal(s.timers.size, 0);
  s.detail.animations[0].resolve();
  await flush();
  cleaned(s.detail);
}));
