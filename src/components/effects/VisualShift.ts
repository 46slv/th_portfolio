const FRAME_INTERVAL = 1000 / 15;

let animationFrame = 0;
let baseHue = 0;
let playbackRate = 1;
let active = false;
let lastFrameTime = 0;
let lastFilter = "";
let targets: HTMLElement[] = [];

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function shiftTargets() {
  if (!targets.length) {
    targets = [
      document.getElementById("site-shell"),
      document.getElementById("archive-wheel"),
    ].filter((target): target is HTMLElement => Boolean(target));
  }
  return targets;
}

function updateStatus() {
  const status = document.getElementById("doppler-status");
  if (!status) return;

  if (playbackRate === 0) status.innerText = "Shift: Time Frozen";
  else if (playbackRate > 1.8) status.innerText = "Redshift: Event Horizon";
  else if (playbackRate > 1.2) status.innerText = "Redshift: Relativistic";
  else if (playbackRate < 0.8) status.innerText = "Blueshift: Receding Time";
  else status.innerText = "Shift: Stable";
}

function isNeutralRate() {
  return Math.abs(playbackRate - 1) < 0.001;
}

function clearFilter() {
  if (!lastFilter && shiftTargets().every((target) => !target.style.filter)) return;
  shiftTargets().forEach((target) => {
    target.style.filter = "";
  });
  lastFilter = "";
}

function applyFilter(advanceHue: boolean) {
  if (isNeutralRate()) {
    clearFilter();
    return;
  }

  if (advanceHue && playbackRate > 0) {
    const cycleSpeed = 0.06 * Math.pow(playbackRate, 2);
    baseHue = (baseHue + cycleSpeed) % 360;
  }

  const delta = playbackRate - 1;
  const redshift = Math.max(0, delta);
  const blueshift = Math.max(0, -delta);
  const shiftHue = baseHue + redshift * 155 - blueshift * 72;
  const brightness = 0.92 + redshift * 0.38 + blueshift * 0.12;
  const contrast = 1 + redshift * 0.48 + blueshift * 0.16;
  const saturation = 1 + redshift * 1.65 + blueshift * 0.85;
  const sepia = Math.min(0.72, redshift * 0.58);
  const invert = redshift > 0.82 ? (redshift - 0.82) * 0.12 : 0;

  const filter = `sepia(${sepia}) hue-rotate(${shiftHue}deg) saturate(${saturation}) brightness(${brightness}) contrast(${contrast}) invert(${invert})`;
  if (filter === lastFilter) return;

  shiftTargets().forEach((target) => {
    target.style.filter = filter;
  });
  lastFilter = filter;
}

function frame(timestamp: number) {
  animationFrame = 0;
  if (!active || document.hidden || isNeutralRate()) {
    if (isNeutralRate()) clearFilter();
    return;
  }

  if (reduceMotionQuery.matches || playbackRate === 0) {
    applyFilter(false);
    return;
  }

  if (timestamp - lastFrameTime >= FRAME_INTERVAL) {
    lastFrameTime = timestamp;
    applyFilter(true);
  }

  animationFrame = requestAnimationFrame(frame);
}

function syncVisualShift() {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;

  if (!active) return;
  if (isNeutralRate()) {
    clearFilter();
    return;
  }

  applyFilter(false);
  if (!document.hidden && !reduceMotionQuery.matches && playbackRate > 0) {
    lastFrameTime = 0;
    animationFrame = requestAnimationFrame(frame);
  }
}

export function startVisualShift() {
  if (active) return;
  active = true;
  updateStatus();
  syncVisualShift();
}

export function stopVisualShift() {
  active = false;
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  clearFilter();
}

export function setPlaybackRate(rate: number) {
  playbackRate = Math.max(0, rate);
  updateStatus();
  syncVisualShift();
}

document.addEventListener("visibilitychange", syncVisualShift);
reduceMotionQuery.addEventListener("change", syncVisualShift);
