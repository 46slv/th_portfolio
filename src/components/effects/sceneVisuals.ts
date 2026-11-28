import { getAudioVisualFrame, getMeterLevel, isAudioPlaying } from '../../lib/audio/audioEngine';
import { createGalaxy } from '../../lib/ambientParticles';
import { freezeVisualShift, startVisualShift } from './VisualShift';

export function createSceneVisuals(
  galaxyCanvas: HTMLCanvasElement | null,
  isStopped: () => boolean,
  hasStarted: () => boolean,
) {
  let meterFrame = 0;
  let lastMeterTime = 0;
  let lastMeterScale = -1;
  let waveformGain = 1;
  let lissajousGain = 1;
  const meterInterval = 1000 / 24;
  const ambientField = galaxyCanvas ? createGalaxy(galaxyCanvas, () => {
    if (!needsVisualFrame()) cancelMeter();
    else startMeter();
  }) : null;

  function needsVisualFrame() {
    return !isStopped() && (isAudioPlaying() || (hasStarted() && ambientField?.isAnimated()));
  }

  function prepareCanvas(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { context: canvas.getContext('2d'), width, height, dpr };
  }

  function renderWaveform(data: Float32Array | null) {
    const canvas = document.getElementById('waveform-scope') as HTMLCanvasElement | null;
    if (!canvas) return;
    const { context, width, height, dpr } = prepareCanvas(canvas);
    if (!context) return;

    context.clearRect(0, 0, width, height);
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.strokeStyle = 'rgba(34, 211, 238, 0.12)';
    context.lineWidth = Math.max(1, dpr * 0.5);
    context.stroke();
    if (!data) return;

    let peak = 0;
    for (let index = 0; index < data.length; index += 1) {
      peak = Math.max(peak, Math.abs(data[index]));
    }
    const targetGain = peak > 0.005 ? Math.min(4, 0.78 / peak) : 1;
    waveformGain += (targetGain - waveformGain) * 0.16;

    context.beginPath();
    const step = Math.max(1, Math.floor(data.length / Math.max(1, width / dpr)));
    let pointIndex = 0;
    for (let index = 0; index < data.length; index += step) {
      const x = (pointIndex / Math.max(1, Math.ceil(data.length / step) - 1)) * width;
      const y = height / 2 - data[index] * waveformGain * height * 0.42;
      if (pointIndex === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
      pointIndex += 1;
    }
    context.strokeStyle = 'rgba(103, 232, 249, 0.82)';
    context.lineWidth = Math.max(1, dpr * 0.7);
    context.stroke();
  }

  function renderLissajous(left: Float32Array | null, right: Float32Array | null) {
    const canvas = document.getElementById('map-lissajous') as HTMLCanvasElement | null;
    if (!canvas) return;
    const { context, width, height, dpr } = prepareCanvas(canvas);
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (!left || !right) return;

    const length = Math.min(left.length, right.length);
    let peak = 0;
    for (let index = 0; index < length; index += 1) {
      peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
    }
    if (peak < 0.005) return;
    const targetGain = Math.min(5, 0.82 / peak);
    lissajousGain += (targetGain - lissajousGain) * 0.12;

    const centerX = width / 2;
    const centerY = height / 2;
    const rebuildDots = document.body.classList.contains('archive-rebuild');
    // Keep the legacy canvas projection intact. On rebuild, physical X/Y use
    // the actual Graph span, not the independently viewport-capped canvas size.
    const graph = rebuildDots ? document.getElementById('map-target')?.getBoundingClientRect() : null;
    const scale = rebuildDots && graph
      ? Math.min(graph.width, graph.height) * dpr * (0.61 / 0.82) * lissajousGain
      : Math.min(width, height) * 0.43 * lissajousGain;
    const step = Math.max(1, Math.ceil(length / 512));
    if (rebuildDots) {
      // Sizes are CSS pixels, not backing-store pixels; keep the dot legible at DPR 1–2.
      // A dim tight rim gives each core separation without a full-canvas/per-dot blur.
      const core = 2.5 * dpr;
      const rim = 4.5 * dpr;
      context.fillStyle = 'rgba(103, 232, 249, 0.055)';
      for (let index = 0; index < length; index += step) {
        const x = centerX + left[index] * scale;
        const y = centerY - right[index] * scale;
        context.fillRect(x - rim / 2, y - rim / 2, rim, rim);
      }
      context.fillStyle = 'rgba(103, 232, 249, 0.58)';
      for (let index = 0; index < length; index += step) {
        const x = centerX + left[index] * scale;
        const y = centerY - right[index] * scale;
        context.fillRect(x - core / 2, y - core / 2, core, core);
      }
      return;
    }
    context.beginPath();
    let pointIndex = 0;
    for (let index = 0; index < length; index += step) {
      const x = centerX + left[index] * scale;
      const y = centerY - right[index] * scale;
      if (pointIndex === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
      pointIndex += 1;
    }
    context.strokeStyle = 'rgba(103, 232, 249, 0.34)';
    context.lineWidth = Math.max(1, dpr * 0.55);
    context.stroke();
  }

  function renderAudioScopes() {
    const frame = getAudioVisualFrame();
    renderWaveform(frame?.mono ?? null);
    renderLissajous(frame?.left ?? null, frame?.right ?? null);
  }

  function renderMeter(value: number) {
    const vBar = document.getElementById('v-bar');
    const scale = Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
    if (!vBar || scale === lastMeterScale) return;
    lastMeterScale = scale;
    vBar.style.transform = `scaleX(${scale})`;
  }

  function updateMeter(timestamp: number) {
    meterFrame = 0;
    if (document.hidden || !needsVisualFrame()) return;

    if (timestamp - lastMeterTime >= meterInterval) {
      lastMeterTime = timestamp;
      const level = getMeterLevel();
      renderMeter(level);
      renderAudioScopes();
      ambientField?.update(timestamp, level);
    }

    if (needsVisualFrame()) meterFrame = requestAnimationFrame(updateMeter);
  }

  function startMeter() {
    if (meterFrame || document.hidden || !needsVisualFrame()) return;
    lastMeterTime = 0;
    meterFrame = requestAnimationFrame(updateMeter);
  }

  function cancelMeter() {
    cancelAnimationFrame(meterFrame);
    meterFrame = 0;
  }

  function stopMeter() {
    cancelMeter();
    if (isStopped()) return;
    renderMeter(0);
    renderWaveform(null);
    renderLissajous(null, null);
    ambientField?.silence();
    startMeter();
  }

  function startVisuals() {
    startVisualShift();
    startMeter();
  }

  function freezeVisuals(stopped: boolean) {
    ambientField?.freeze(stopped);
    freezeVisualShift(stopped);
  }

  function bindLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelMeter();
        ambientField?.suspend();
      } else {
        startMeter();
      }
    });
    window.addEventListener('beforeunload', () => {
      cancelAnimationFrame(meterFrame);
      ambientField?.dispose();
    });
  }

  return { startVisuals, freezeVisuals, startMeter, cancelMeter, stopMeter, bindLifecycle };
}
