// Keep in sync with the archive-portrait.css media query. Shared components
// opt in only on the rebuild route, not on the legacy archive.
export function archivePortraitMedia() {
  return window.matchMedia('(max-width: 600px) and (orientation: portrait)');
}
