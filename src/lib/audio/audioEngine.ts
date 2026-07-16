type AudioState = {
  context: AudioContext;
  source: AudioBufferSourceNode;
  gain: GainNode;
  delay: DelayNode;
  delayGain: GainNode;
  reverb: ConvolverNode;
  reverbGain: GainNode;
  distortion: WaveShaperNode;
  analyser: AnalyserNode;
  stereoSplitter: ChannelSplitterNode;
  leftAnalyser: AnalyserNode;
  rightAnalyser: AnalyserNode;
  meterData: Uint8Array;
  waveformData: Float32Array;
  leftWaveformData: Float32Array;
  rightWaveformData: Float32Array;
  visualFrame: {
    mono: Float32Array;
    left: Float32Array;
    right: Float32Array;
  };
  distortionAmount: number;
  reverbReady: boolean;
  isPlaying: boolean;
};

let state: AudioState | null = null;

function getAudioContext(): AudioContext {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  return new AudioCtor();
}

function createImpulse(context: AudioContext, duration: number, decay: number) {
  const rate = context.sampleRate;
  const length = rate * duration;
  const impulse = context.createBuffer(2, length, rate);

  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      data[index] =
        (Math.random() * 2 - 1) * Math.pow(1 - index / length, decay);
    }
  }

  return impulse;
}

function makeDistortionCurve(amount: number) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }

  return curve;
}

function disconnect(node: AudioNode) {
  try {
    node.disconnect();
  } catch {
    // Disconnect can throw for already-disconnected nodes in some browsers.
  }
}

function connectEffectGraph() {
  if (!state) return;

  const {
    source,
    distortion,
    delay,
    delayGain,
    reverb,
    reverbGain,
    gain,
    analyser,
    stereoSplitter,
    leftAnalyser,
    rightAnalyser,
    context,
    distortionAmount,
  } = state;

  [
    source,
    distortion,
    delay,
    delayGain,
    reverb,
    reverbGain,
    gain,
    analyser,
    stereoSplitter,
    leftAnalyser,
    rightAnalyser,
  ].forEach(disconnect);

  const effectInput: AudioNode = distortionAmount > 0 ? distortion : source;
  if (distortionAmount > 0) {
    distortion.curve = makeDistortionCurve(distortionAmount);
    distortion.oversample = "4x";
    source.connect(distortion);
  } else {
    distortion.curve = null;
  }

  effectInput.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(delay);
  delayGain.connect(gain);

  effectInput.connect(reverb);
  reverb.connect(reverbGain);
  reverbGain.connect(gain);

  effectInput.connect(gain);
  gain.connect(analyser);
  analyser.connect(context.destination);
  gain.connect(stereoSplitter);
  stereoSplitter.connect(leftAnalyser, 0);
  stereoSplitter.connect(rightAnalyser, 1);
}

export async function startAudio() {
  if (state) {
    await state.context.resume();
    state.isPlaying = true;
    return;
  }

  const context = getAudioContext();
  const response = await fetch("/SITE_th.mp3");
  const audioBuffer = await context.decodeAudioData(await response.arrayBuffer());
  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = true;

  const gain = context.createGain();
  gain.gain.value = 0.5;

  const delay = context.createDelay(2);
  delay.delayTime.value = 0.4;
  const delayGain = context.createGain();
  delayGain.gain.value = 0;

  const reverb = context.createConvolver();
  const reverbGain = context.createGain();
  reverbGain.gain.value = 0;

  const distortion = context.createWaveShaper();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;
  const stereoSplitter = context.createChannelSplitter(2);
  const leftAnalyser = context.createAnalyser();
  const rightAnalyser = context.createAnalyser();
  leftAnalyser.fftSize = 512;
  rightAnalyser.fftSize = 512;

  const waveformData = new Float32Array(analyser.fftSize);
  const leftWaveformData = new Float32Array(leftAnalyser.fftSize);
  const rightWaveformData = new Float32Array(rightAnalyser.fftSize);

  state = {
    context,
    source,
    gain,
    delay,
    delayGain,
    reverb,
    reverbGain,
    distortion,
    analyser,
    stereoSplitter,
    leftAnalyser,
    rightAnalyser,
    meterData: new Uint8Array(analyser.frequencyBinCount),
    waveformData,
    leftWaveformData,
    rightWaveformData,
    visualFrame: {
      mono: waveformData,
      left: leftWaveformData,
      right: rightWaveformData,
    },
    distortionAmount: 0,
    reverbReady: false,
    isPlaying: true,
  };

  connectEffectGraph();
  source.start(0);
  await context.resume();
}

export async function togglePlayback() {
  if (!state) return false;

  if (state.isPlaying) {
    await state.context.suspend();
    state.isPlaying = false;
  } else {
    await state.context.resume();
    state.isPlaying = true;
  }

  return state.isPlaying;
}

export function setVolume(value: number) {
  if (!state) return;
  state.gain.gain.setTargetAtTime(value, state.context.currentTime, 0.015);
}

export function setSpeed(value: number) {
  if (!state) return;
  state.source.playbackRate.setTargetAtTime(value, state.context.currentTime, 0.015);
}

export function setDistortion(value: number) {
  if (!state) return;
  const nextAmount = Math.max(0, value);
  if (state.distortionAmount === nextAmount) return;
  state.distortionAmount = nextAmount;
  connectEffectGraph();
}

export function setDelay(value: number) {
  if (!state) return;
  state.delay.delayTime.setTargetAtTime(0.4, state.context.currentTime, 0.015);
  state.delayGain.gain.setTargetAtTime(value, state.context.currentTime, 0.015);
}

export function setReverb(value: number) {
  if (!state) return;
  if (value > 0 && !state.reverbReady) {
    state.reverb.buffer = createImpulse(state.context, 2.5, 4);
    state.reverbReady = true;
  }
  state.reverbGain.gain.setTargetAtTime(value, state.context.currentTime, 0.015);
}

export function isAudioPlaying() {
  return Boolean(state?.isPlaying && state.context.state === "running");
}

export function getAudioVisualFrame() {
  if (!state || !state.isPlaying || state.context.state !== "running") return null;

  state.analyser.getFloatTimeDomainData(state.waveformData);
  state.leftAnalyser.getFloatTimeDomainData(state.leftWaveformData);
  state.rightAnalyser.getFloatTimeDomainData(state.rightWaveformData);

  return state.visualFrame;
}

export function getMeterLevel() {
  if (!state || !state.isPlaying || state.context.state !== "running") return 0;

  state.analyser.getByteTimeDomainData(state.meterData);
  let sum = 0;
  let peak = 0;
  for (const value of state.meterData) {
    const normalized = Math.abs((value - 128) / 128);
    sum += normalized * normalized;
    peak = Math.max(peak, normalized);
  }

  return Math.min(1, Math.max(Math.sqrt(sum / state.meterData.length) * 5, peak * 3));
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
