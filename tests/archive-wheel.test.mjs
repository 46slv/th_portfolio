import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

// Run the component's actual script and selection store with deterministic
// animation frames/timers. No server, browser, audio, or network is involved.
const component = readFileSync(new URL('../src/components/works/ArchiveWheel.astro', import.meta.url), 'utf8');
const script = component.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Archive Wheel must contain its client script');
const clientScript = stripTypeScriptTypes(script.replace(
  /import \{ getSelectedWork, setSelectedWork, subscribe \} from '..\/..\/lib\/workSelectionStore';/,
  '',
));
const storeScript = stripTypeScriptTypes(readFileSync(
  new URL('../src/lib/workSelectionStore.ts', import.meta.url), 'utf8',
).replace(/\bexport /g, ''));

class Element {
  constructor(dataset = {}, classes = []) {
    this.dataset = dataset;
    this.classes = new Set(classes);
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.pointers = new Set();
    this.classList = {
      contains: (name) => this.classes.has(name),
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      toggle: (name, force = !this.classes.has(name)) => {
        if (force) this.classes.add(name);
        else this.classes.delete(name);
        return force;
      },
    };
  }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) ?? [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  dispatch(type, values = {}) {
    const event = { target: this, preventDefault() {}, ...values };
    for (const callback of this.listeners.get(type) ?? []) callback(event);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  toggleAttribute(name, force) {
    if (force) this.attributes.set(name, '');
    else this.attributes.delete(name);
  }
  closest(selector) {
    if (selector === '[data-wheel-toggle]' && 'wheelToggle' in this.dataset) return this;
    if (selector === '[data-wheel-step]' && 'wheelStep' in this.dataset) return this;
    return null;
  }
  setPointerCapture(id) { this.pointers.add(id); }
  hasPointerCapture(id) { return this.pointers.has(id); }
  releasePointerCapture(id) { this.pointers.delete(id); }
}

function createWheel() {
  const wheel = new Element({}, ['is-collapsed']);
  const toggle = new Element({ wheelToggle: '' });
  const rail = new Element();
  rail.setAttribute('inert', '');
  rail.setAttribute('aria-hidden', 'true');
  const steps = [-1, 1].map((direction) => new Element({ wheelStep: String(direction) }));
  const items = Array.from({ length: 12 }, (_, index) => new Element({ workId: `work-${index}` }));
  const mapNodes = items.map((item) => new Element({ workId: item.dataset.workId }));
  wheel.querySelector = (selector) => ({ '[data-wheel-rail]': rail, '[data-wheel-toggle]': toggle })[selector];
  wheel.querySelectorAll = (selector) => selector === '[data-wheel-step]' ? steps : [];
  const frames = new Map();
  const timers = new Map();
  let handle = 0;
  const window = new Element();
  window.innerHeight = 800;
  window.setTimeout = (callback) => { timers.set(++handle, callback); return handle; };
  window.clearTimeout = (id) => timers.delete(id);
  const document = {
    getElementById: (id) => id === 'archive-wheel' ? wheel : null,
    querySelectorAll: (selector) => selector === '[data-wheel-work]' ? items : mapNodes,
  };
  const context = vm.createContext({
    document, window,
    requestAnimationFrame: (callback) => { frames.set(++handle, callback); return handle; },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const selection = vm.runInContext(`(() => { ${storeScript}\nreturn { getSelectedWork, setSelectedWork, subscribe }; })()`, context);
  Object.assign(context, selection);
  vm.runInContext(clientScript, context, { filename: 'ArchiveWheel.astro' });
  return {
    wheel, toggle, rail, items, mapNodes, steps, window, ...selection,
    open: () => toggle.dispatch('click'),
    scroll: (deltaY, deltaMode = 0) => wheel.dispatch('wheel', { deltaY, deltaMode }),
    frame: () => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(16));
    },
    settle: () => {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((callback) => callback());
    },
    pending: () => ({ frames: frames.size, timers: timers.size }),
  };
}

test('wheel deltas accumulate before one animation frame', () => {
  const ui = createWheel();
  ui.open();
  // Ten small trackpad events total 0.8 entries and should snap to entry 1.
  for (let index = 0; index < 10; index += 1) ui.scroll(8.8);
  assert.deepEqual(ui.pending(), { frames: 1, timers: 1 });
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), 'work-1');
});

for (const afterFrame of [false, true]) test(`collapse cancels wheel selection ${afterFrame ? 'after' : 'before'} the animation frame`, () => {
  const ui = createWheel();
  ui.open();
  ui.setSelectedWork('work-2');
  ui.scroll(110);
  if (afterFrame) ui.frame();
  ui.toggle.dispatch('click');
  assert.equal(ui.getSelectedWork(), null);
  assert.deepEqual(ui.pending(), { frames: 0, timers: 0 });
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), null, 'collapsed wheel must keep map selection cleared');
  assert.deepEqual(ui.pending(), { frames: 0, timers: 0 });
  assert.equal(ui.rail.attributes.get('aria-hidden'), 'true');
  ui.open();
  assert.equal(ui.getSelectedWork(), null, 'reopening must not commit canceled scroll');
});

for (const release of ['pointerup', 'pointercancel']) test(`${release} commits an active drag but ignores a canceled drag after collapse`, () => {
  const ui = createWheel();
  ui.open();
  ui.setSelectedWork('work-2');
  ui.wheel.dispatch('pointerdown', { pointerId: 1, clientY: 200 });
  ui.wheel.dispatch('pointermove', { pointerId: 1, clientY: 100 });
  ui.wheel.dispatch(release, { pointerId: 1, clientY: 100 });
  assert.equal(ui.getSelectedWork(), 'work-3');
  ui.wheel.dispatch('pointerdown', { pointerId: 2, clientY: 200 });
  ui.wheel.dispatch('pointermove', { pointerId: 2, clientY: 100 });
  ui.toggle.dispatch('click');
  ui.wheel.dispatch(release, { pointerId: 2, clientY: 100 });
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), null);
  assert.equal(ui.wheel.classList.contains('is-dragging'), false);
});

test('reverse wheel deltas accumulate and remain bounded', () => {
  const ui = createWheel();
  ui.open();
  ui.setSelectedWork('work-2');
  for (let index = 0; index < 10; index += 1) ui.scroll(-8.8);
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), 'work-1');
  ui.scroll(-10000);
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), 'work-0');
  ui.scroll(10000);
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), 'work-11');
});

test('discrete navigation, filtering, and collapsed selection keep their existing behavior', () => {
  const ui = createWheel();
  ui.open();
  ui.steps[1].dispatch('click');
  assert.equal(ui.getSelectedWork(), 'work-1');
  ui.steps[0].dispatch('click');
  assert.equal(ui.getSelectedWork(), 'work-0');
  ui.steps[1].dispatch('click');
  ui.wheel.dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(ui.getSelectedWork(), 'work-2');
  ui.wheel.dispatch('keydown', { key: 'ArrowUp' });
  assert.equal(ui.getSelectedWork(), 'work-1');
  ui.wheel.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(ui.getSelectedWork(), 'work-2');
  ui.wheel.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(ui.getSelectedWork(), 'work-1');
  ui.items[4].dispatch('click');
  assert.equal(ui.getSelectedWork(), 'work-4');
  ui.mapNodes[4].classList.add('is-inactive');
  ui.window.dispatch('work-filters-applied');
  assert.equal(ui.items[4].classList.contains('is-hidden'), true);
  assert.equal(ui.getSelectedWork(), null);
  ui.toggle.dispatch('click');
  assert.equal(ui.getSelectedWork(), null);
});
