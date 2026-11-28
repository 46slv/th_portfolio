import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import test from 'node:test';
import vm from 'node:vm';

// Run the component's actual script and selection store with deterministic
// animation frames/timers. No server, browser, audio, or network is involved.
const component = readFileSync(new URL('../src/components/works/ArchiveWheel.astro', import.meta.url), 'utf8');
const script = component.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Archive Wheel must contain its client script');
// Bundle the real Wheel, selection decision, output port and store. Only expose
// the store's public API to this VM fixture; no literal import rewriting.
const { outputFiles } = await build({
  stdin: { contents: script, loader: 'ts', sourcefile: 'ArchiveWheel.ts',
    resolveDir: fileURLToPath(new URL('../src/components/works/', import.meta.url)) },
  bundle: true, platform: 'browser', format: 'iife', write: false,
  plugins: [{ name: 'expose-test-store', setup(bundler) {
    bundler.onLoad({ filter: /workSelectionStore\.ts$/ }, args => ({
      contents: readFileSync(args.path, 'utf8') +
        '\n globalThis.__testSelection = { getSelectedWork, setSelectedWork, subscribe };',
      loader: 'ts',
    }));
  } }],
});
const clientScript = outputFiles[0].text;

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
    if (selector === '[data-trial-track]' && 'trialTrack' in this.dataset) return this;
    if (selector === '[data-trial-track],[data-wheel-work]' && 'workId' in this.dataset) return this;
    return null;
  }
  setPointerCapture(id) { this.pointers.add(id); }
  hasPointerCapture(id) { return this.pointers.has(id); }
  releasePointerCapture(id) { this.pointers.delete(id); }
  querySelector() { return null; }
}

function createWheel(clean = false, { centred = false, rebuild = false, radius = 310, compact = false } = {}) {
  const wheel = new Element({ cleanTrial: String(clean), centredTrial: String(centred) }, ['is-collapsed']);
  wheel.clientWidth = radius;
  const track = new Element({ trialTrack: '' });
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
  const snapDelays = [];
  let handle = 0;
  let time = 0;
  const media = new Element();
  media.matches = false;
  const compactMedia = new Element();
  compactMedia.matches = compact;
  const portraitMedia = new Element();
  portraitMedia.matches = false;
  const window = new Element();
  window.matchMedia = (query) => query === '(max-width:760px)' ? compactMedia
    : query === '(max-width: 600px) and (orientation: portrait)' ? portraitMedia : media;
  window.innerHeight = 800;
  window.dispatchEvent = (event) => window.dispatch(event.type, event);
  window.setTimeout = (callback, delay) => { snapDelays.push(delay); timers.set(++handle, callback); return handle; };
  window.clearTimeout = (id) => timers.delete(id);
  const document = new Element();
  document.body = new Element({}, rebuild ? ['archive-rebuild'] : []);
  document.getElementById = (id) => id === 'archive-wheel' ? wheel : null;
  document.querySelectorAll = (selector) => selector === '[data-wheel-work]' ? items : mapNodes;
  const context = vm.createContext({
    document, window, HTMLElement: Element, ResizeObserver: class { observe() {} },
    requestAnimationFrame: (callback) => { frames.set(++handle, callback); return handle; },
    cancelAnimationFrame: (id) => frames.delete(id),
    performance: { now: () => time },
    CustomEvent: class { constructor(type, options) { this.type=type; this.detail=options?.detail; } },
  });
  vm.runInContext(clientScript, context, { filename: 'ArchiveWheel.astro' });
  const selection = context.__testSelection;
  return {
    wheel, track, toggle, rail, items, mapNodes, steps, window, document, media, snapDelays, ...selection,
    open: () => toggle.dispatch('click'),
    // This minimal DOM has no bubbling: deliver clean packets at its document
    // handler, while the regular route still listens on the wheel itself.
    scroll: (deltaY, deltaMode = 0) => (clean ? document : wheel).dispatch('wheel',
      { target:clean ? items[5] : wheel, clientX:40, clientY:300, deltaY, deltaMode }),
    frame: (elapsed = 16) => {
      time += elapsed;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(time));
    },
    wait: (elapsed) => { time += elapsed; },
    drain: (count = 120) => { for(let i=0;i<count && (frames.size || timers.size);i++) {
      time += 16;
      const callbacks=[...timers.values()]; timers.clear(); callbacks.forEach(cb=>cb());
      const pending=[...frames.values()]; frames.clear(); pending.forEach(cb=>cb(time));
    } },
    settle: () => {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((callback) => callback());
    },
    pending: () => ({ frames: frames.size, timers: timers.size }),
  };
}

function readArcPose(item) {
  const match = /^translate3d\(([^,]+)px, ([^,]+)px, 0\) translateY\(-50%\) rotate\(([^)]+)rad\) scale\(([^)]+)\)$/.exec(item.style.transform);
  assert.ok(match, `expected a radial transform for ${item.dataset.workId}, got ${item.style.transform}`);
  const [x, y, rotation, scale] = match.slice(1).map(Number);
  return { x, y, rotation, scale };
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);
}

function assertArcPose(item, stationRadius, rotation, scale) {
  const pose = readArcPose(item);
  near(pose.x, -stationRadius * Math.cos(rotation));
  near(pose.y, -stationRadius * Math.sin(rotation));
  near(pose.rotation, rotation);
  assert.equal(pose.scale, scale);
}

function beginTrackDrag(ui) {
  const start = { target: ui.track, pointerId: 1, clientY: 200 };
  ui.wheel.dispatch('pointerdown', start);
  return (delta) => {
    ui.wheel.dispatch('pointermove', { ...start, clientY: start.clientY + delta });
    ui.frame();
  };
}

test('rebuild opens on the reference desktop arc and commits its visual station without a preview event', () => {
  const ui = createWheel(true, { centred: true, rebuild: true });
  const previewIds = [];
  ui.window.addEventListener('archive-wheel-selected', (event) => previewIds.push(event.detail));
  assert.equal(ui.getSelectedWork(), null);
  ui.open();
  assert.equal(ui.getSelectedWork(), 'work-0');
  assert.equal(ui.items[0].attributes.get('aria-current'), 'true');
  assert.deepEqual(previewIds, []);

  // The 310px disc at 1192×1255 in center-fix/reference-open.json.
  const visible = ui.items.filter(({ style }) => style.visibility === 'visible' && +style.opacity > .1);
  assert.deepEqual(visible.map((item) => Math.round(readArcPose(item).rotation * 180 / Math.PI)), [0, -17, -34, -52, -69]);
  const rotations = [0, -.30, -.60, -.90, -1.20];
  const scales = [1, .97, .92, .86, .86];
  visible.forEach((item, i) => assertArcPose(item, 304, rotations[i], scales[i]));
  assert.deepEqual(visible.map(({ style }) => +style.opacity), [1, .86, .68, .42, .42]);
  assert.equal(visible[3].style.pointerEvents, 'auto');
  assert.equal(visible[4].style.pointerEvents, 'none', 'visible stations past the hit range stay passive');

  ui.setSelectedWork('work-5');
  beginTrackDrag(ui)(-19); // 19px / 76px per station = one quarter station
  near(+ui.wheel.dataset.wheelOffset, 5.25);
  assertArcPose(ui.items[4], 304, .375, .97);
  assertArcPose(ui.items[5], 304, .075, 1);
  assertArcPose(ui.items[6], 304, -.225, .97);
});

test('compact radial stations keep their wider angular step, edge fade and hit limits', () => {
  const ui = createWheel(true, { centred: true, rebuild: true, radius: 96, compact: true });
  ui.open();
  assertArcPose(ui.items[1], 90, -.90, .97);
  const edge = ui.items[2];
  assert.equal(edge.style.visibility, 'hidden');
  assert.equal(+edge.style.opacity, 0);

  const drag = beginTrackDrag(ui);
  drag(-38); // half a station: the second neighbour is now 1.5 stations away
  assertArcPose(edge, 90, -1.35, .92);
  assert.equal(edge.style.visibility, 'visible');
  near(+edge.style.opacity, .68 * .08 / .19);
  assert.equal(edge.style.pointerEvents, 'none');
  assert.equal(edge.tabIndex, -1);
  drag(-46);
  assert.equal(edge.style.pointerEvents, 'auto');
  assert.equal(edge.tabIndex, 0);
});

test('centred legacy trial keeps radial poses without rebuild edge fading or an opening commit', () => {
  const ui = createWheel(false, { centred: true });
  ui.open();
  assert.equal(ui.getSelectedWork(), null);
  assertArcPose(ui.items[0], 304, 0, 1);
  beginTrackDrag(ui)(-38);
  const edge = ui.items[5];
  assertArcPose(edge, 304, -1.35, .86);
  assert.equal(edge.style.visibility, 'visible');
  assert.equal(+edge.style.opacity, .42);
  assert.equal(edge.style.pointerEvents, 'none');
});

test('rebuild geometry follows an existing ID and only commits a fallback on a nonempty opening', () => {
  const ui = createWheel(true, { centred: true, rebuild: true });
  ui.setSelectedWork('work-5');
  ui.open();
  assert.equal(ui.getSelectedWork(), 'work-5');
  assertArcPose(ui.items[5], 304, 0, 1);
  ui.toggle.dispatch('click');

  ui.mapNodes.forEach((node) => node.classList.add('is-inactive'));
  ui.window.dispatch('work-filters-applied');
  ui.open();
  assert.equal(ui.rail.attributes.get('data-empty'), 'true');
  assert.equal(ui.getSelectedWork(), null);
  ui.mapNodes.forEach((node) => node.classList.remove('is-inactive'));
  ui.window.dispatch('work-filters-applied');
  assert.equal(ui.getSelectedWork(), null, 'restoring a list while open does not commit');
  assertArcPose(ui.items[5], 304, 0, 1);
  ui.toggle.dispatch('click');
  ui.open();
  assert.equal(ui.getSelectedWork(), 'work-5', 'opening commits the displayed station, not the first row');
});

test('browser wheel boundaries leave passes unread and normalize consumed packets in ownership order', () => {
  const clean = createWheel(true);
  const reads = [];
  let height = 500;
  Object.defineProperty(clean.window, 'innerHeight', { get() { reads.push('height'); return height; } });
  const timeout = clean.window.setTimeout;
  clean.window.setTimeout = (...args) => { reads.push('own-or-motion-timer'); return timeout(...args); };
  const event = () => ({
    target: clean.items[5], clientX: 40, clientY: 300, ctrlKey: false,
    defaultPrevented: false,
    preventDefault() { reads.push('prevent'); },
    get deltaMode() { reads.push('mode'); return 2; },
    get deltaY() { reads.push('delta'); return -0.125; },
  });
  const direct = clean.wheel.listeners.get('wheel')[0];
  const fallback = clean.document.listeners.get('wheel')[0];
  direct(event()); // collapsed: direct passes
  fallback(event()); // collapsed: document clears
  assert.deepEqual(reads, []);
  clean.open();
  direct(event());
  assert.deepEqual(reads.slice(0, 5), ['own-or-motion-timer', 'prevent', 'mode', 'height', 'delta']);
  reads.length = 0;
  height = 900;
  fallback(event());
  assert.deepEqual(reads.slice(0, 5), ['prevent', 'own-or-motion-timer', 'mode', 'height', 'delta']);
  reads.length = 0;
  const pass = event();
  pass.ctrlKey = true;
  fallback(pass); // protected from normalization even when open
  assert.deepEqual(reads, []);

  const legacy = createWheel();
  const legacyReads = [];
  Object.defineProperty(legacy.window, 'innerHeight', { get() { legacyReads.push('height'); return 750; } });
  legacy.wheel.listeners.get('wheel')[0]({
    target: legacy.wheel, clientX: 40, clientY: 300,
    preventDefault() { legacyReads.push('prevent'); },
    get deltaMode() { legacyReads.push('mode'); return 2; },
    get deltaY() { legacyReads.push('delta'); return 0.25; },
  });
  assert.deepEqual(legacyReads, ['prevent', 'mode', 'height', 'delta']);
});

test('clean Wheel measures recent release velocity rather than a one-packet target', () => {
  const fast = createWheel(true), slow = createWheel(true), isolated = createWheel(true);
  for (const ui of [fast, slow, isolated]) { ui.open(); ui.setSelectedWork('work-3'); }
  for(let i=0;i<4;i++) { fast.scroll(55); fast.wait(45); }
  for(let i=0;i<4;i++) { slow.scroll(55); slow.wait(185); }
  isolated.scroll(220);
  for(const ui of [fast,slow,isolated]) ui.drain();
  assert(Number(fast.getSelectedWork().slice(5)) > 5, 'fast release coasts beyond entered two stations');
  assert.equal(slow.getSelectedWork(),'work-5');
  assert.equal(isolated.getSelectedWork(),'work-5', 'isolated packet has no invented velocity');
});

test('clean Wheel gently captures held fractional mouse/touch drags to the nearest visible station on both sides', () => {
  const offset = ui => {
    const index=ui.items.findIndex(item=>item.classList.contains('is-selected'));
    return index - Number(ui.items[index].style.transform.split(',')[1].trim().replace('px','')) / 48;
  };
  for(const sign of [-1,1]) for(const fraction of [.34,.66]) for(const pointerType of ['mouse','touch']) {
    const ui=createWheel(true), start=sign>0?3:8, id=pointerType==='touch'?2:1;
    ui.open(); ui.setSelectedWork(`work-${start}`);
    ui.wheel.dispatch('pointerdown',{pointerId:id,pointerType,clientY:300,clientX:40});
    ui.wait(25);
    ui.wheel.dispatch('pointermove',{pointerId:id,pointerType,clientY:300-sign*fraction*76,clientX:40});
    ui.wait(190); // previous high velocity must have expired
    ui.wheel.dispatch('pointerup',{pointerId:id,pointerType,clientY:300-sign*fraction*76,clientX:40});
    const target=Math.round(start+sign*fraction), before=offset(ui);
    assert(Math.abs(before-(start+sign*fraction))<.002);
    const distances=[];
    for(let i=0;i<7;i++) { ui.frame(); distances.push(Math.abs(target-offset(ui))); }
    assert(distances[0]>distances[1] && distances[1]>distances[2] && distances[2]>distances[3],
      `${pointerType} ${sign} ${fraction} captures on successive frames`);
    assert(distances[0]<Math.abs(target-before) && distances[3]>.005,'no dwell or instant jump');
    ui.drain();
    assert.equal(ui.getSelectedWork(),`work-${target}`);
    assert.deepEqual(ui.pending(),{frames:0,timers:0});
  }
});

test('clean Wheel captures gentle fractional wheel input without a delayed stride or directional detent', () => {
  const offset = ui => {
    const index=ui.items.findIndex(item=>item.classList.contains('is-selected'));
    return index - Number(ui.items[index].style.transform.split(',')[1].trim().replace('px','')) / 48;
  };
  for(const sign of [-1,1]) for(const fraction of [.34,.66]) {
    const ui=createWheel(true), start=sign>0?3:8;
    ui.open(); ui.setSelectedWork(`work-${start}`);
    // Inverse of the light-wheel distance curve, preserving the exact
    // fractional stations tested here rather than relaxing the capture check.
    const pixels=fraction<=.60 ? fraction*32/.60 : 32+(fraction-.60)*78/.40;
    ui.scroll(sign*pixels);
    const target=Math.round(start+sign*fraction);
    ui.frame();
    const first=offset(ui);
    assert(sign*(first-start)>.03 && sign*(first-start)<1, 'first paint exposes real fractional travel');
    if (fraction>.5) {
      const distances=[];
      for(let i=0;i<6;i++) { ui.frame(); distances.push(Math.abs(target-offset(ui))); }
      assert(distances[0]<Math.abs(target-first) && distances[0]>distances[1] && distances[1]>distances[2],
        'above-midpoint input continues before the intent gap');
      assert(distances[3]>.005, 'not an instant jump');
    }
    ui.settle(); // association expires; sub-midpoint input now captures downward
    const before=offset(ui), distances=[];
    for(let i=0;i<6;i++) { ui.frame(); distances.push(Math.abs(target-offset(ui))); }
    assert(distances[1]<distances[0] || Math.abs(before-target)<.005);
    ui.drain(); assert.equal(ui.getSelectedWork(),`work-${target}`);
  }
});

test('clean Wheel chooses the nearest predicted natural rest, even when recent speed crosses a midpoint', () => {
  for(const sign of [-1,1]) for(const [tail,expectedStep] of [[1.1,1],[4.4,2]]) {
    const ui=createWheel(true), start=sign>0?3:8;
    ui.open(); ui.setSelectedWork(`work-${start}`);
    ui.scroll(sign*110); ui.scroll(sign*37.4); ui.wait(40);
    ui.scroll(sign*tail);
    // Above 110px the mapping rejoins physical 110px/station. A tapered
    // tail predicts only its latest interval, without counting the peak twice.
    const natural=1+(37.4+tail)/110+tail/110/40/.0065;
    assert.equal(Math.round(natural),expectedStep);
    ui.drain();
    assert.equal(ui.getSelectedWork(),`work-${start+sign*expectedStep}`);
  }
});

const drawnClean = ui => {
  const index=ui.items.findIndex(item=>item.classList.contains('is-selected'));
  return index - Number(ui.items[index].style.transform.split(',')[1].trim().replace('px',''))/48;
};

for (const sign of [-1,1]) for (const reduced of [false,true]) {
  test(`clean light wheel ${sign} reduced=${reduced}: physical distance, partition, modes, sparse gap and silence`, () => {
    const start=sign>0?3:8;
    for (const [packets,gap,mode] of [
      [[32],0,0],[Array(4).fill(8),75,0],[Array(8).fill(4),75,0],
      [Array(3).fill(12),350,0],[Array(4).fill(8),75,1],[[32],0,2],
    ]) {
      const ui=createWheel(true); ui.open(); ui.setSelectedWork(`work-${start}`); ui.media.matches=reduced;
      for(const pixel of packets) { ui.scroll(sign*pixel/(mode===1?16:mode===2?800:1),mode); ui.wait(gap); ui.frame(0); }
      const before=drawnClean(ui);
      assert(sign*(before-start) >= (reduced ? .99 : packets.length===1 ? .03 : .08),
        `first paint is fractional before capture ${packets} mode=${mode}`);
      ui.drain();
      assert.equal(ui.getSelectedWork(),`work-${start+sign}`,`${packets} mode=${mode}`);
    }
  });
}

test('clean weak packets hold a continuous arc without magnet twitch, while noise, reset and reversal have no credit', () => {
  const ui=createWheel(true); ui.open(); ui.setSelectedWork('work-5');
  for(let i=0;i<3;i++) {
    ui.scroll(8); ui.frame(); const before=drawnClean(ui);
    ui.wait(320); for(let j=0;j<5;j++) ui.frame();
    assert(drawnClean(ui)>=before-.001,'sparse packets cannot be pulled back between events');
  }
  ui.scroll(8); ui.drain(); assert.equal(ui.getSelectedWork(),'work-6');
  ui.setSelectedWork('work-5');
  for(const pixel of [1,-1,2,-2,1,-1]) { ui.scroll(pixel); ui.wait(70); ui.frame(); }
  ui.drain(); assert.equal(ui.getSelectedWork(),'work-5');
  ui.scroll(12); ui.wait(900); ui.drain();
  ui.scroll(12); ui.wait(900); ui.drain();
  assert.equal(ui.getSelectedWork(),'work-5','separated incidental packets do not bank distance');
  for(let i=0;i<16;i++) {ui.scroll(2); ui.wait(350); ui.frame();}
  ui.drain(); assert.equal(ui.getSelectedWork(),'work-5','sparse sensor specks cannot ratchet forever');
  ui.scroll(8); ui.scroll(8);
  ui.frame(); const before=drawnClean(ui); ui.scroll(-8); ui.frame();
  assert(drawnClean(ui)<before,'reversal starts at drawn arc, not an old target');
  ui.drain(); assert.equal(ui.getSelectedWork(),'work-5');
  ui.scroll(12); ui.toggle.dispatch('click'); ui.open();
  ui.scroll(12); ui.drain(); assert.equal(ui.getSelectedWork(),'work-5','close clears light credit');
  ui.scroll(12); ui.window.dispatch('work-filters-applied');
  ui.scroll(12); ui.drain(); assert.equal(ui.getSelectedWork(),'work-5','filter clears light credit');
  ui.setSelectedWork('work-11'); ui.scroll(12); ui.drain();
  assert.equal(ui.getSelectedWork(),'work-11','endpoint cannot retain light overscroll');
  ui.scroll(-32); ui.drain(); assert.equal(ui.getSelectedWork(),'work-10');
});

test('clean Wheel estimates a taper from its latest interval, not the prior peak', () => {
  for(const sign of [-1,1]) {
    const ui=createWheel(true),start=sign>0?3:8;
    ui.open(); ui.setSelectedWork(`work-${start}`);
    for(const pixels of [110,55,25,10]) { ui.scroll(sign*pixels); ui.frame(35); }
    ui.drain();
    assert.equal(ui.getSelectedWork(),`work-${start+sign*2}`);
  }
});

test('clean Wheel coasts with the sign of trusted negative packets and credits projected travel', () => {
  const readOffset = (ui, index) => index - Number(ui.items[index].style.transform.split(',')[1].trim().replace('px','')) / 48;
  for (const direction of [-1,1]) {
    const ui=createWheel(true), start=direction>0?3:8;
    ui.open(); ui.setSelectedWork(`work-${start}`);
    for(let i=0;i<4;i++) {
      ui.scroll(direction*55);
      ui.frame(40);
    }
    const during=readOffset(ui,start);
    assert(direction*(during-start)>0 && direction*(during-start)<3, 'drawn motion follows input');
    ui.drain();
    const end=Number(ui.getSelectedWork().slice(5));
    assert(direction*(end-(start+2))>=.5, 'coast extends past signed direct budget');
    assert(direction*(end-start)<=5, 'coast is bounded, not added twice');
  }
});

test('clean Wheel reconciles cumulative signed input without rewinding on any same-sign packet', () => {
  const drawn = (ui) => {
    const index=ui.items.findIndex(item=>item.classList.contains('is-selected'));
    return index - Number(ui.items[index].style.transform.split(',')[1].trim().replace('px','')) / 48;
  };
  for(const [start,packets] of [[2,Array(8).fill(55)],[9,Array(8).fill(-55)],
      [2,[110,110,84,62,42,29,18,12,7,4,2,1]]]) {
    const ui=createWheel(true),direction=Math.sign(packets[0]);
    ui.open(); ui.setSelectedWork(`work-${start}`);
    for(const pixels of packets) {
      ui.wait(45); ui.frame(); // allow projection between actual inputs
      const before=drawn(ui);
      ui.scroll(pixels);
      assert(direction*(drawn(ui)-before)>=-1e-9,`${pixels}px packet cannot erase already drawn coast`);
    }
    ui.drain();
    assert(direction*(Number(ui.getSelectedWork().slice(5))-start)>0);
  }
});

test('clean Wheel caps an isolated oversized packet, reverses from drawn position and leaves no endpoint debt', () => {
  const ui=createWheel(true); ui.open(); ui.setSelectedWork('work-2');
  ui.scroll(1e7); ui.frame();
  const drawn=Number(ui.items[2].style.transform.split(',')[1].trim().replace('px',''));
  assert(drawn<0 && drawn>-48,'bounded first frame shows continuous travel, not an instant endpoint');
  ui.scroll(-110); ui.drain();
  assert(Number(ui.getSelectedWork().slice(5))<=2,'reverse cancels queued forward travel');
  ui.setSelectedWork('work-11'); ui.scroll(1e7); ui.drain();
  assert.equal(ui.getSelectedWork(),'work-11');
  ui.scroll(-110); ui.drain();
  assert.equal(ui.getSelectedWork(),'work-10','endpoint cannot bank overscroll');
});

test('clean Wheel retains a nonzero station through empty filters and restores it without a selection', () => {
  const ui = createWheel(true);
  ui.media.matches = true;
  ui.open();
  for (let i = 0; i < 5; i++) ui.wheel.dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(ui.getSelectedWork(), 'work-5');
  const observed = [];
  ui.subscribe(id => observed.push({ id, visible: ui.items.findIndex(item => item.classList.contains('is-selected')) }));
  observed.length = 0;
  ui.mapNodes.forEach(node => node.classList.add('is-inactive'));
  ui.window.dispatch('work-filters-applied');
  assert.equal(ui.getSelectedWork(), null);
  assert.deepEqual(observed.map(event => event.id), [null]);
  assert.equal(ui.items.findIndex(item => item.classList.contains('is-selected')), -1);
  ui.mapNodes.forEach(node => node.classList.remove('is-inactive'));
  ui.window.dispatch('work-filters-applied');
  assert.equal(ui.getSelectedWork(), null);
  assert.equal(ui.items.findIndex(item => item.classList.contains('is-selected')), 5);
  assert.equal(observed.length, 1, 'restoring the visual station must not publish a new selection');
});

test('clean Wheel discards motion on close, filter and reduced-motion toggle', () => {
  for(const stop of ['close','filter','reduce']) {
    const ui=createWheel(true); ui.open(); ui.setSelectedWork('work-3');
    ui.scroll(55); ui.wait(40); ui.scroll(55);
    ui.settle(); ui.frame();
    if(stop==='close') ui.toggle.dispatch('click');
    if(stop==='filter') {
      ui.mapNodes[4].classList.add('is-inactive');
      ui.window.dispatch('work-filters-applied');
    }
    if(stop==='reduce') { ui.media.matches=true; ui.media.dispatch('change'); }
    assert.deepEqual(ui.pending(),{frames:0,timers:0},stop);
    const id=ui.getSelectedWork(); ui.drain();
    assert.equal(ui.getSelectedWork(),id, stop+' cannot resurrect a delayed selection');
  }
});

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

for (const direction of [1, -1]) {
for (const frameEvery of [0, 1, 10]) test(`equal signed pixel totals (${direction}) select the same work with a frame every ${frameEvery} tiny events`, () => {
  const compact = createWheel();
  const fragmented = createWheel();
  for (const ui of [compact, fragmented]) {
    ui.open();
    ui.setSelectedWork(`work-${direction > 0 ? 2 : 9}`);
  }
  compact.scroll(direction * 110);
  for (let index = 1; index <= 100; index += 1) {
    fragmented.scroll(direction * 1.1);
    if (frameEvery && index % frameEvery === 0) fragmented.frame();
  }
  for (const ui of [compact, fragmented]) {
    ui.frame();
    ui.settle();
  }
  assert.equal(compact.getSelectedWork(), `work-${direction > 0 ? 3 : 8}`);
  assert.equal(fragmented.getSelectedWork(), compact.getSelectedWork());
});
}

for (const [endpoint, direction] of [[0, 1], [11, -1]]) test(`opposite overscroll cancels at endpoint ${endpoint} across animation frames`, () => {
  const ui = createWheel();
  ui.open();
  ui.setSelectedWork(`work-${endpoint}`);
  ui.scroll(-direction * 440);
  ui.frame();
  assert.equal(ui.items.findIndex((item) => item.classList.contains('is-selected')), endpoint,
    'visible preview stays clamped while signed overscroll remains pending');
  ui.scroll(direction * 440);
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), `work-${endpoint}`);
  ui.scroll(direction * 110);
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), `work-${endpoint + direction}`,
    'settling starts the next gesture from the committed index');
});

for (const pixels of [100, 120, -100, -120]) {
  for (const mode of [0, 1, 2]) test(`${pixels}px ordinary notch retains its effect in deltaMode ${mode}`, () => {
    const ui = createWheel();
    ui.open();
    ui.setSelectedWork('work-5');
    const multiplier = mode === 1 ? 16 : mode === 2 ? ui.window.innerHeight : 1;
    ui.scroll(pixels / multiplier, mode);
    assert.deepEqual(ui.pending(), { frames: 1, timers: 1 });
    assert.deepEqual(ui.snapDelays, [170]);
    ui.frame();
    ui.settle();
    assert.equal(ui.getSelectedWork(), `work-${5 + Math.sign(pixels)}`);
  });
}

for (const afterFrame of [false, true]) test(`collapse resets cumulative overscroll ${afterFrame ? 'after' : 'before'} RAF and reopen starts fresh`, () => {
  const ui = createWheel();
  ui.open();
  ui.setSelectedWork('work-5');
  ui.scroll(2200);
  if (afterFrame) ui.frame();
  ui.toggle.dispatch('click');
  assert.deepEqual(ui.pending(), { frames: 0, timers: 0 });
  ui.frame();
  ui.settle();
  ui.open();
  assert.equal(ui.getSelectedWork(), null);
  assert.equal(ui.items.findIndex((item) => item.classList.contains('is-selected')), 5);
  ui.scroll(110);
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), 'work-6');
});

for (const [start, signedPixels, belowIndex] of [[2, 55, 2], [9, -55, 8]]) {
  for (const frameEvery of [0, 1, 10]) {
    for (const thresholdDifference of [-0.000001, 0, 0.000001]) test(`half-step fragmentation from ${start}, ${signedPixels} plus ${thresholdDifference}px, RAF every ${frameEvery}`, () => {
      const pixels = signedPixels + thresholdDifference;
      const expected = belowIndex + (thresholdDifference < 0 ? 0 : 1);
      for (const fragments of [1, 100]) {
        const ui = createWheel();
        ui.open();
        ui.setSelectedWork(`work-${start}`);
        for (let index = 1; index <= fragments; index += 1) {
          ui.scroll(pixels / fragments);
          if (frameEvery && index % frameEvery === 0) ui.frame();
        }
        ui.frame();
        assert.equal(ui.items.findIndex((item) => item.classList.contains('is-selected')), expected,
          `${fragments} fragments must choose the same preview center`);
        const shiftY = Number(ui.items[start].style.transform.split(',')[1].trim().replace('px', ''));
        assert.ok(Math.abs(shiftY - (-pixels / 110 * 48)) < 1e-9,
          'index rounding must leave the continuous visual offset intact');
        ui.settle();
        assert.equal(ui.getSelectedWork(), `work-${expected}`,
          `${fragments} fragments must preserve Math.round's upward half-step tie`);
      }
    });
  }
}

function checkLongFragmentedHalfStep(start, signedPixels, fragments, frameEvery, reversal = false) {
  for (const difference of [-0.000001, 0, 0.000001]) {
    const pixels = signedPixels + difference;
    const expected = (start === 2 ? 2 : 8) + (difference < 0 ? 0 : 1);
    const ui = createWheel();
    ui.open();
    ui.setSelectedWork(`work-${start}`);
    const inputs = Array(fragments).fill(pixels / fragments);
    if (reversal) inputs.push(-Math.sign(signedPixels) * 1e16);
    if (reversal) inputs.unshift(Math.sign(signedPixels) * 1e16);
    inputs.forEach((input, index) => {
      ui.scroll(input);
      if (frameEvery && (index + 1) % frameEvery === 0) ui.frame();
    });
    ui.frame();
    assert.equal(ui.items.findIndex((item) => item.classList.contains('is-selected')), expected,
      `preview for ${fragments} fragments, threshold difference ${difference}px`);
    const shiftY = Number(ui.items[start].style.transform.split(',')[1].trim().replace('px', ''));
    assert.ok(Math.abs(shiftY - (-pixels / 110 * 48)) < 1e-9,
      'long gestures retain continuous visual offsets, including sub-threshold differences');
    ui.settle();
    assert.equal(ui.getSelectedWork(), `work-${expected}`);
  }
}

for (const [start, pixels, fragments] of [[2, 55, 500], [9, -55, 1000]]) {
  for (const frameEvery of [0, 1, 10]) test(`reported long half-step from ${start}, ${fragments} fragments, RAF every ${frameEvery}`, () => {
    checkLongFragmentedHalfStep(start, pixels, fragments, frameEvery);
  });
}

for (const [start, pixels] of [[2, 55], [9, -55]]) {
  for (const frameEvery of [0, 1, 10]) {
    test(`bounded 10000-fragment half-step from ${start}, RAF every ${frameEvery}`, () => {
      checkLongFragmentedHalfStep(start, pixels, 10000, frameEvery);
    });
    test(`signed overscroll reversal retains tiny half-step input from ${start}, RAF every ${frameEvery}`, () => {
      checkLongFragmentedHalfStep(start, pixels, 1000, frameEvery, true);
    });
  }
}

for (const afterFrame of [false, true]) test(`collapse clears pixel expansion and anchor ${afterFrame ? 'after' : 'before'} RAF`, () => {
  const ui = createWheel();
  ui.open();
  ui.setSelectedWork('work-5');
  for (let index = 0; index < 1000; index += 1) ui.scroll(0.055);
  if (afterFrame) ui.frame();
  ui.toggle.dispatch('click');
  ui.frame();
  ui.settle();
  ui.open();
  ui.scroll(110);
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), 'work-6');
});

test('settling discards pixel expansion and anchors the next gesture at its selected work', () => {
  const ui = createWheel();
  ui.open();
  ui.setSelectedWork('work-2');
  for (let index = 0; index < 1000; index += 1) ui.scroll(0.055);
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), 'work-3');
  ui.scroll(55);
  ui.frame();
  ui.settle();
  assert.equal(ui.getSelectedWork(), 'work-4');
});
