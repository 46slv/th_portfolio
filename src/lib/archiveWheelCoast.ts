// Numeric coast only. The adapter owns time, motion state, live items and publication.
const friction = .0065; // exponential decay per ms (~107 ms half-life)
const maxVelocity = .024;
const maxCoast = 2.4;

export const clampVelocity = (v: number): number => Math.max(-maxVelocity, Math.min(maxVelocity, v));

function clampStation(offset: number, count: number): number {
  if (!count) return 0;
  return Math.max(0, Math.min(offset, count - 1));
}

// inputOrigin is the delivered packet budget; renderedOrigin can already lead it.
export function projectCoast(speed: number, inputOrigin: number, renderedOrigin: number, count: number) {
  const travel = Math.max(-maxCoast, Math.min(maxCoast, clampVelocity(speed) / friction));
  const reach = clampStation(inputOrigin + travel, count);
  // Round the unrounded natural rest, without nearestIndex's tie tolerance.
  const detent = clampStation(Math.round(reach), count);
  return { reach, detent, atRest: reach === renderedOrigin && detent === renderedOrigin };
}

// elapsed is accumulated coast time in ms, supplied by the adapter (not a clock).
export function advanceCoast(origin: number, reach: number, target: number, elapsed: number, count: number) {
  // Zero-speed capture begins immediately; moving releases use cubic blending.
  const decay = -Math.expm1(-(reach === origin ? .015 : friction) * elapsed);
  const capture = reach === origin ? decay : decay * decay * decay;
  let offset = clampStation(origin + (reach - origin) * decay +
    (target - reach) * capture, count);
  const stopped = Math.abs(offset - target) < .003 || elapsed >= 1250;
  if (stopped) offset = target;
  return { offset, stopped };
}
