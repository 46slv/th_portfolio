import { createAudioHud } from '../../audio/audioHudBrowser';
import { createSceneVisuals } from '../../effects/sceneVisuals';
import { archiveClock } from '../../../lib/archiveClock';
import { applyWorkFilters } from '../../../lib/filterStore';
import { bindContactCopy, bindFilters, bindWorkSelection } from './mapInteractions';

export function bootWorksMap() {
  let isStarted = false;
  // Only /archive-rebuild/ supplies this rear layer; other routes stay unchanged.
  const galaxyCanvas = document.querySelector<HTMLCanvasElement>('#archive-galaxy');
  const archive = document.body.classList.contains('archive-rebuild');
  const clock = archive ? archiveClock : null;
  const isStopped = () => clock?.stopped ?? false;
  const visuals = createSceneVisuals(galaxyCanvas, isStopped, () => isStarted);
  const audio = createAudioHud(archive, isStopped, visuals);

  clock?.subscribe(stopped => {
    // The reading UI stays live; only filter writes and audio settings remain gated.
    document.querySelectorAll('[data-filter-tag], [data-filter-year], #play-pause-btn').forEach(control => {
      if (stopped) control.setAttribute('aria-disabled', 'true');
      else control.removeAttribute('aria-disabled');
    });
    audio.setRangesDisabled(stopped);
    visuals.freezeVisuals(stopped);
    audio.setSceneStopped(stopped);
    if (stopped) visuals.cancelMeter();
    else visuals.startMeter();
  });

  async function startExperience() {
    if (isStarted) return;
    isStarted = true;

    document.getElementById('start-overlay')?.classList.add('hidden');
    document.body.classList.remove('is-blurred');
    if (!archive) document.body.style.overflow = 'auto';
    const shell = document.getElementById('site-shell');
    shell?.style.setProperty('transition', 'none');
    shell?.style.setProperty('filter', 'none');
    const mainLayout = document.querySelector<HTMLElement>('.main-layout');
    mainLayout?.style.setProperty('transition', 'none');
    mainLayout?.style.setProperty('opacity', '1');

    visuals.startVisuals();

    await audio.initializeAudio();
  }

  function initWorksMap() {
    bindContactCopy();
    bindFilters(isStopped, startExperience);
    bindWorkSelection();
    audio.bindAudioControls();
    applyWorkFilters();
    document.getElementById('start-overlay')?.addEventListener('click', startExperience);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorksMap, { once: true });
  } else {
    initWorksMap();
  }

  visuals.bindLifecycle();
}
