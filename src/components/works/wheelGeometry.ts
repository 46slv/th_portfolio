export function stationEmphasis(absDistance: number) {
  const opacity = absDistance < 0.45 ? 1 : absDistance < 1.45 ? 0.86 : absDistance < 2.45 ? 0.68 : 0.42;
  const scale = absDistance < 0.45 ? 1 : absDistance < 1.45 ? 0.97 : absDistance < 2.45 ? 0.92 : 0.86;
  return { opacity, scale };
}

// distance is the signed, fractional station offset from centre; radius is the disc width in px.
// The result is relative to the right-hand axis, with label rotation in radians.
export function circularStationPose(distance: number, radius: number, compact: boolean, fadeEdges: boolean) {
  const abs = Math.abs(distance);
  const { opacity, scale } = stationEmphasis(abs);
  // Fan labels farther apart on smaller discs, where the spokes converge.
  const angle = distance * (compact ? .90 : .30);
  const arcLimit = 1.43;
  // Anchor titles just past the SVG's longest tick, leaving room to drag.
  const stationRadius = radius - 6;
  const x = -stationRadius * Math.cos(angle);
  const y = stationRadius * Math.sin(angle);
  const withinArc = Math.abs(angle) < arcLimit;
  const edgeFade = fadeEdges ? Math.max(0, Math.min(1, (arcLimit - Math.abs(angle)) / .19)) : 1;
  const selectable = withinArc && edgeFade >= .5 && abs < 3.6;
  return { x, y, rotation: -angle, scale, opacity: opacity * edgeFade, withinArc, selectable };
}
