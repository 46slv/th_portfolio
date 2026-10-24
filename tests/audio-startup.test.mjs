import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

// Execute the production engine and WorksMap handlers with fake Web Audio,
// network and DOM boundaries. No MP3 is read, fetched, decoded or played.
const engineSource = readFileSync(new URL('../src/lib/audio/audioEngine.ts', import.meta.url), 'utf8');
const mapSource = readFileSync(new URL('../src/components/WorksMap.astro', import.meta.url), 'utf8');
const mapScript = stripTypeScriptTypes(mapSource.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/\bimport[\s\S]*?from ['"][^'"]+['"];\s*/g, ''));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class Element {
  constructor() {
    this.listeners = new Map();
    this.attributes = new Map();
    this.classes = new Set();
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name),
    };
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.innerText = 'Pause Transmission';
    this.disabled = false;
    this.dataset = {};
  }
  addEventListener(name, fn) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }
  dispatch(name) { return Promise.all((this.listeners.get(name) ?? []).map((fn) => fn({ target: this }))); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
}

function createAudioUI({ base = '/', responses = [], failDecode = false, failResume = false, failStart = false } = {}) {
  const contexts = [], requests = [], errors = [], frames = new Map();
  let decodes = 0, visualStarts = 0, nextFrame = 0;
  class AudioNode {
    constructor() {
      this.connections = [];
      for (const key of ['gain', 'delayTime', 'playbackRate']) {
        this[key] = { value: 0, setTargetAtTime(value) { this.value = value; } };
      }
      this.fftSize = 512;
    }
    get frequencyBinCount() { return this.fftSize / 2; }
    connect(...args) { this.connections.push(args); }
    disconnect() { this.connections = []; }
    getFloatTimeDomainData(data) { data.fill(0.1); }
    getByteTimeDomainData(data) { data.fill(140); }
    start() { if (failStart && contexts.length === 1) throw new Error('source start failed'); this.started = true; }
    stop() { this.stopped = true; }
  }
  class AudioContext {
    constructor() {
      contexts.push(this);
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = {};
      this.nodes = [];
    }
    async resume() {
      this.resumes = (this.resumes ?? 0) + 1;
      if (failResume && contexts.length === 1) throw new Error('resume failed');
      this.state = 'running';
    }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; this.closed = true; }
    async decodeAudioData() { decodes += 1; if (failDecode && contexts.length === 1) throw new Error('decode failed'); return {}; }
  }
  for (const name of ['BufferSource', 'Gain', 'Delay', 'Convolver', 'WaveShaper', 'Analyser', 'ChannelSplitter']) {
    AudioContext.prototype[`create${name}`] = function () {
      const node = new AudioNode(); this.nodes.push(node); return node;
    };
  }
  const overlay = new Element(), button = new Element(), shell = new Element(), layout = new Element();
  const tag = new Element(), year = new Element(), trigger = new Element();
  const body = new Element(); body.classes.add('is-blurred');
  const document = new Element();
  Object.assign(document, {
    body, readyState: 'complete', hidden: false,
    getElementById: (id) => ({ 'start-overlay': overlay, 'play-pause-btn': button, 'site-shell': shell })[id] ?? null,
    querySelector: (selector) => selector === '.main-layout' ? layout : null,
    querySelectorAll: (selector) => ({ '[data-filter-tag]': [tag], '[data-filter-year]': [year], '.work-trigger': [trigger] })[selector] ?? [],
  });
  const window = new Element(); window.AudioContext = AudioContext;
  const context = vm.createContext({
    window, document,
    console: { error: (error) => errors.push(error) },
    fetch: async (url) => { requests.push(url); const response = responses.shift(); if (response instanceof Error) throw response; return await response; },
    requestAnimationFrame: (fn) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
    applyWorkFilters() {}, setTag() {}, setYear() {}, subscribe() {}, setPlaybackRate() {},
    startVisualShift: () => { visualStarts += 1; },
  });
  const script = stripTypeScriptTypes(engineSource.replace(/\bexport /g, '')
    .replaceAll('import.meta.env.BASE_URL', JSON.stringify(base)));
  const engine = vm.runInContext(`(() => { ${script}\nreturn { startAudio, togglePlayback, isAudioPlaying, getAudioVisualFrame, getMeterLevel, setVolume, setSpeed, setDelay, setReverb, setDistortion }; })()`, context);
  Object.assign(context, engine);
  vm.runInContext(mapScript, context, { filename: 'WorksMap.astro' });
  return { engine, overlay, button, body, tag, year, trigger, document, contexts, requests, errors, frames,
    decodes: () => decodes, visualStarts: () => visualStarts };
}

const ok = () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(1) });
const flush = async () => { for (let count = 0; count < 20; count += 1) await Promise.resolve(); };

for (const base of ['/', '/th_portfolio/', '/th_portfolio']) {
  test(`audio uses configured base ${base} without autoplay`, async () => {
    const ui = createAudioUI({ base, responses: [ok()] });
    assert.equal(ui.contexts.length, 0);
    assert.equal(ui.requests.length, 0);
    await ui.overlay.dispatch('click');
    const path = `${base.replace(/\/$/, '')}/SITE_th.mp3`;
    assert.deepEqual(ui.requests, [path]);
    assert.equal(new URL(path, 'https://46slv.github.io/th_portfolio/').pathname, path);
    assert.equal(ui.engine.isAudioPlaying(), true);
    assert.equal(ui.decodes(), 1);
  });
}

test('HTTP failure skips body/decode, closes context and waits for explicit retry', async () => {
  let bodyReads = 0;
  const pending = deferred();
  const ui = createAudioUI({ base: '/th_portfolio/', responses: [
    { ok: false, status: 404, arrayBuffer: async () => { bodyReads += 1; return new ArrayBuffer(0); } }, pending.promise,
  ] });
  await ui.overlay.dispatch('click');
  assert.equal(bodyReads, 0);
  assert.equal(ui.decodes(), 0);
  assert.equal(ui.contexts[0].closed, true);
  assert.equal(ui.engine.isAudioPlaying(), false);
  assert.match(ui.errors[0].message, /404/);
  assert.equal(ui.button.innerText, 'Retry Transmission');
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.overlay.classList.contains('hidden'), true);
  assert.equal(ui.body.classList.contains('is-blurred'), false);
  assert.equal(ui.body.style.overflow, 'auto');
  assert.equal(ui.frames.size, 0);
  await ui.document.dispatch('visibilitychange');
  await ui.tag.dispatch('click');
  await ui.year.dispatch('click');
  await ui.overlay.dispatch('click');
  await flush();
  assert.equal(ui.requests.length, 1, 'visibility/filter/old overlay do not retry');
  const retry = ui.button.dispatch('click');
  await flush();
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.button.attributes.get('aria-busy'), 'true');
  await ui.button.dispatch('click');
  await ui.trigger.dispatch('click');
  assert.equal(ui.contexts.length, 2, 'rapid clicks cannot create another startup');
  pending.resolve(ok());
  await retry;
  assert.deepEqual(ui.requests, ['/th_portfolio/SITE_th.mp3', '/th_portfolio/SITE_th.mp3']);
  assert.equal(ui.engine.isAudioPlaying(), true);
  assert.equal(ui.button.innerText, 'Pause Transmission');
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.button.attributes.has('aria-busy'), false);
  assert.equal(ui.visualStarts(), 1);
  assert.equal(ui.frames.size, 1);
  await ui.button.dispatch('click');
  assert.equal(ui.engine.isAudioPlaying(), false);
  assert.equal(ui.button.innerText, 'Resume Transmission');
  await ui.button.dispatch('click');
  assert.equal(ui.engine.isAudioPlaying(), true);
  assert.equal(ui.requests.length, 2, 'resume reuses the decoded source');
});

test('engine coalesces concurrent starts and preserves audio graph/controls', async () => {
  const response = deferred();
  const ui = createAudioUI({ responses: [response.promise] });
  const first = ui.engine.startAudio(), second = ui.engine.startAudio();
  assert.equal(ui.contexts.length, 1);
  assert.equal(ui.contexts[0].resumes, 1, 'context is resumed synchronously in the gesture');
  await flush();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.engine.isAudioPlaying(), false);
  response.resolve(ok());
  await Promise.all([first, second]);
  assert.equal(ui.decodes(), 1);
  const [source, gain, delay, delayGain, reverb, reverbGain, distortion, analyser, splitter, left, right] = ui.contexts[0].nodes;
  assert.equal(source.started, true);
  assert.equal(source.loop, true);
  assert.equal(gain.gain.value, 0.5);
  assert.equal(delay.delayTime.value, 0.4);
  assert.equal(delayGain.gain.value, 0);
  assert.equal(reverbGain.gain.value, 0);
  assert.equal(reverb.buffer, undefined, 'reverb stays lazy');
  assert.equal(analyser.fftSize, 512);
  assert.equal(left.fftSize, 512);
  assert.equal(right.fftSize, 512);
  assert.ok(analyser.connections.some(([node]) => node === ui.contexts[0].destination));
  assert.ok(splitter.connections.some(([node, channel]) => node === left && channel === 0));
  assert.ok(splitter.connections.some(([node, channel]) => node === right && channel === 1));
  ui.engine.setVolume(0.25); ui.engine.setSpeed(1.2); ui.engine.setDelay(0.2); ui.engine.setDistortion(10);
  assert.equal(gain.gain.value, 0.25);
  assert.equal(source.playbackRate.value, 1.2);
  assert.equal(delayGain.gain.value, 0.2);
  assert.equal(distortion.curve.length, 44100);
  const frame = ui.engine.getAudioVisualFrame();
  assert.equal(frame.mono.length, 512); assert.equal(frame.left.length, 512); assert.equal(frame.right.length, 512);
  assert.ok(ui.engine.getMeterLevel() > 0);
  await ui.engine.startAudio();
  assert.equal(ui.contexts.length, 1); assert.equal(ui.requests.length, 1);
});

for (const failure of ['network', 'decode', 'resume', 'start']) {
  test(`${failure} failure releases startup and requires a new explicit call`, async () => {
    const options = { responses: [failure === 'network' ? new Error('network failed') : ok(), ok()],
      failDecode: failure === 'decode', failResume: failure === 'resume', failStart: failure === 'start' };
    const ui = createAudioUI(options);
    await assert.rejects(ui.engine.startAudio());
    assert.equal(ui.contexts.length, 1);
    assert.equal(ui.contexts[0].closed, true);
    assert.equal(ui.engine.isAudioPlaying(), false);
    assert.equal(ui.engine.getAudioVisualFrame(), null);
    assert.equal(await ui.engine.togglePlayback(), false);
    await flush();
    assert.equal(ui.contexts.length, 1, 'no automatic retry');
    await ui.engine.startAudio();
    assert.equal(ui.contexts.length, 2, 'a new explicit call may retry');
    assert.equal(ui.engine.isAudioPlaying(), true);
  });
}

test('overlay, filter and playback clicks during initial load stay single-flight', async () => {
  const response = deferred();
  const ui = createAudioUI({ responses: [response.promise] });
  const initial = ui.overlay.dispatch('click');
  await flush();
  await Promise.all([ui.overlay.dispatch('click'), ui.tag.dispatch('click'), ui.button.dispatch('click'), ui.trigger.dispatch('click')]);
  assert.equal(ui.requests.length, 1); assert.equal(ui.contexts.length, 1);
  assert.equal(ui.visualStarts(), 1); assert.equal(ui.frames.size, 0);
  response.resolve(ok()); await initial;
  assert.equal(ui.button.innerText, 'Pause Transmission');
  assert.equal(ui.frames.size, 1);
});
