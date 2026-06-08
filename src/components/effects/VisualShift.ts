let animationFrame = 0;
let baseHue = 0;
let playbackRate = 1;
let active = false;

function shiftTargets() {
  return [
    document.getElementById("site-shell"),
    document.getElementById("archive-wheel"),
  ].filter((target): target is HTMLElement => Boolean(target));
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

function frame() {
  if (!active) return;

  if (playbackRate > 0) {
    const cycleSpeed = 0.015 * Math.pow(playbackRate, 2);
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
  shiftTargets().forEach((target) => {
    target.style.filter = filter;
  });
  updateStatus();
  animationFrame = requestAnimationFrame(frame);
}

export function startVisualShift() {
  if (active) return;
  active = true;
  frame();
}

export function stopVisualShift() {
  active = false;
  cancelAnimationFrame(animationFrame);
  shiftTargets().forEach((target) => {
    target.style.filter = "";
  });
}

export function setPlaybackRate(rate: number) {
  playbackRate = rate;
  updateStatus();
}
