let animationFrame = 0;
let baseHue = 0;
let playbackRate = 1;
let active = false;

function updateStatus() {
  const status = document.getElementById("doppler-status");
  if (!status) return;

  if (playbackRate === 0) status.innerText = "Shift: Time Frozen";
  else if (playbackRate > 1.8) status.innerText = "Shift: Critical Singularity";
  else if (playbackRate > 1.2) status.innerText = "Shift: Blue (Warping)";
  else if (playbackRate < 0.8) status.innerText = "Shift: Red (Distant)";
  else status.innerText = "Shift: Stable";
}

function frame() {
  if (!active) return;

  if (playbackRate > 0) {
    const cycleSpeed = 0.1 * Math.pow(playbackRate, 3);
    baseHue = (baseHue + cycleSpeed) % 360;
  }

  const speedDelta = playbackRate - 1;
  const shiftHue = baseHue + speedDelta * 50;
  const brightness = 0.9 + Math.pow(Math.abs(speedDelta), 1.5) * 1.5;
  const contrast = 1 + Math.abs(speedDelta) * 0.8;
  const saturation = 0.5 + playbackRate * 1.2;
  const invert = playbackRate > 1.5 ? (playbackRate - 1.5) * 0.4 : 0;

  document.body.style.filter = `hue-rotate(${shiftHue}deg) saturate(${saturation}) brightness(${brightness}) contrast(${contrast}) invert(${invert})`;
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
  document.body.style.filter = "";
}

export function setPlaybackRate(rate: number) {
  playbackRate = rate;
  updateStatus();
}
