// Wheel-packet ownership only. Browser hit classification, clocks, geometry reads,
// cancellation timers and rotation belong to the ArchiveWheel adapter.
export const lightGestureGap = 420;
const anchorRadius = 3;

export type WheelHit = { x: number; y: number; at: number };
export type WheelPoint = { x: number; y: number };
export type WheelDecision = 'pass' | 'clear' | 'consume' | 'measure';

type Packet = WheelPoint & { at: number; directHit: boolean; lastHit: WheelHit | null };
export type DirectPacket = Packet & {
  collapsed: boolean;
  ctrlKey: boolean;
  controlHit: boolean;
};
export type DocumentPacket = Packet & {
  defaultPrevented: boolean;
  active: boolean; // Wheel exists, is expanded and has no inert ancestor
  ctrlKey: boolean;
  protectedHit: boolean;
};

export function continuesWheel(hit: WheelHit | null, point: WheelPoint & { at: number }): boolean {
  return hit !== null && point.at - hit.at <= lightGestureGap &&
    Math.hypot(point.x - hit.x, point.y - hit.y) < anchorRadius;
}

export function ownWheel(hit: WheelHit | null, point: WheelPoint & { at: number }): WheelHit {
  // A stationary packet refreshes time, not the coordinate anchor.
  return hit === null || Math.hypot(point.x - hit.x, point.y - hit.y) >= anchorRadius
    ? { x: point.x, y: point.y, at: point.at }
    : { ...hit, at: point.at };
}

export function movedFromWheel(hit: WheelHit | null, point: WheelPoint): boolean {
  return hit !== null && Math.hypot(point.x - hit.x, point.y - hit.y) >= anchorRadius;
}

export function decideDirectWheel(packet: DirectPacket): WheelDecision {
  // The direct listener's collapsed gate does not clear; the bubbling document
  // listener may still clear. It does not use the document's protected list.
  if (packet.collapsed) return 'pass';
  if (packet.ctrlKey || packet.controlHit) return 'clear';
  return packet.directHit || continuesWheel(packet.lastHit, packet) ? 'consume' : 'pass';
}

export function decideDocumentWheel(packet: DocumentPacket): WheelDecision {
  if (packet.defaultPrevented) return 'pass'; // never rearm a direct hit
  if (!packet.active || packet.ctrlKey || packet.protectedHit) return 'clear';
  if (packet.directHit || continuesWheel(packet.lastHit, packet)) return 'consume';
  return 'measure'; // only fresh passive space needs a live arc box
}

export type WheelViewport = { width: number; height: number };
export type WheelRect = { left: number; right: number; top: number; width: number; height: number };
export function insideWheelViewport(point: WheelPoint, viewport: WheelViewport): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < viewport.width && point.y < viewport.height;
}
export function insideOpenDisc(point: WheelPoint, viewport: WheelViewport, rect: WheelRect | null): boolean {
  if (!rect || !insideWheelViewport(point, viewport)) return false;
  // SVG renders the right half of an ellipse centred on its right edge.
  const rx = rect.width, ry = rect.height / 2;
  if (!rx || !ry || point.x < rect.left || point.x > rect.right) return false;
  const dx = (point.x - rect.right) / rx, dy = (point.y - (rect.top + ry)) / ry;
  return dx * dx + dy * dy <= 1;
}

export function resolveMeasuredWheel(inside: boolean): WheelDecision {
  return inside ? 'consume' : 'clear';
}
