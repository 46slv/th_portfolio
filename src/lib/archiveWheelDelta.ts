// Convert a consumed WheelEvent at the browser boundary; pass the live window,
// not its height, so page-mode packets read the viewport only when needed.
export function wheelDeltaPixels(
  event: { readonly deltaMode: number; readonly deltaY: number },
  viewport: { readonly innerHeight: number },
): number {
  const mode = event.deltaMode;
  const multiplier = mode === 1 ? 16 : mode === 2 ? viewport.innerHeight : 1;
  return event.deltaY * multiplier;
}
