// Active time for the rebuild's ambient effects only. Navigation uses wall time.
class ArchiveClock {
  private frozenAt: number | null = null;
  private lostTime = 0;
  private listeners = new Set<(stopped: boolean) => void>();

  get stopped() { return this.frozenAt !== null; }
  now(wall = performance.now()) { return (this.frozenAt ?? wall) - this.lostTime; }

  subscribe(listener: (stopped: boolean) => void) {
    this.listeners.add(listener);
  }

  setStopped(stopped: boolean) {
    if (stopped === this.stopped) return;
    const wall = performance.now();
    if (stopped) this.frozenAt = wall;
    else {
      this.lostTime += wall - this.frozenAt!;
      this.frozenAt = null;
    }
    for (const listener of this.listeners) listener(stopped);
  }
}

export const archiveClock = new ArchiveClock();

export function bindArchiveStop() {
  const content = document.getElementById('archive-content');
  const scene = document.getElementById('archive-scene');
  const button = content?.querySelector<HTMLButtonElement>('[data-archive-stop]');
  if (!content || !scene || !button) return;
  const ambient = scene.querySelector<HTMLElement>('#trial-ambient');
  const backdrops = Array.from(scene.querySelectorAll<HTMLElement>('#trial-ambient, #map-lissajous'));
  const held = new Set<Animation>();
  const filters = new Map<HTMLElement, string>();
  button.addEventListener('click', () => {
    if (content.inert) return;
    const stopped = !archiveClock.stopped;
    if (stopped) {
      // Freeze year travel, not the cards or Wheel. Preserve the sampled
      // backdrop brightness even if browsing changes the active drawer.
      for (const effect of ambient?.getAnimations() ?? []) {
        if (effect.playState !== 'running') continue;
        const time = effect.currentTime;
        effect.pause();
        if (time !== null) effect.currentTime = time;
        held.add(effect);
      }
      const poses = backdrops.map(backdrop => getComputedStyle(backdrop).filter);
      document.body.setAttribute('data-archive-stopped', '');
      backdrops.forEach((backdrop, index) => {
        filters.set(backdrop, backdrop.style.filter);
        backdrop.style.filter = poses[index];
      });
    } else {
      document.body.removeAttribute('data-archive-stopped');
      for (const [backdrop, filter] of filters) backdrop.style.filter = filter;
      filters.clear();
    }
    button.setAttribute('aria-label', stopped ? 'Resume archive' : 'Stop archive');
    archiveClock.setStopped(stopped);
    if (!stopped) {
      for (const effect of held) if (effect.playState === 'paused') effect.play();
      held.clear();
    }
  });
}
