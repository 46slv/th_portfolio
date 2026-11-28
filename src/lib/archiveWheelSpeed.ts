import { clampVelocity } from './archiveWheelCoast';

export type WheelSpeedSample = { at: number; pixels: number };

// The adapter supplies the clock, raw and bounded packet deltas, backlog state
// and distance scale. This core only advances the sample window and estimates speed.
export function estimateWheelSpeed(
  previous: readonly WheelSpeedSample[], rawPixels: number, pixels: number,
  now: number, hadBacklog: boolean, wheelScrollDistance: number,
) {
  const samples = [...previous, { at: now, pixels: Math.abs(rawPixels) <= 220 ? pixels : 0 }]
    .filter(s => now - s.at <= 500);
  const span = samples.length > 1 ? samples.at(-1)!.at - samples[0].at : 0;
  // Same distance/time is independent of packet count; a tapering native
  // tail uses its latest packet, not the earlier high-speed portion.
  const taper = samples.length > 1 && Math.abs(samples.at(-1)!.pixels) < Math.abs(samples[0].pixels) * .6;
  const lastGap = samples.length > 1 ? samples.at(-1)!.at - samples.at(-2)!.at : 0;
  // The first packet fixes the window's position, not its elapsed velocity.
  const measuredPixels = taper ? samples.at(-1)!.pixels : samples.slice(1).reduce((sum, s) => sum + s.pixels, 0);
  const measuredTime = taper ? lastGap : span;
  const speed = samples.length > 1 && measuredTime >= 12 && measuredTime <= 500 && !hadBacklog
    ? clampVelocity(measuredPixels / wheelScrollDistance / measuredTime) : 0;
  return { samples, speed, lastGap };
}
