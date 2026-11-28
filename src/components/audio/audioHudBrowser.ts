import {
  setDelay,
  setAudioSceneStopped,
  setDistortion,
  setReverb,
  setSpeed,
  setVolume,
  startAudio,
  togglePlayback,
} from '../../lib/audio/audioEngine';
import { setPlaybackRate } from '../effects/VisualShift';

export function createAudioHud(
  archive: boolean,
  isStopped: () => boolean,
  { startMeter, stopMeter }: { startMeter: () => void; stopMeter: () => void },
) {
  let isAudioStarting = false;
  let isAudioReady = false;

  function setRangesDisabled(stopped: boolean) {
    document.querySelectorAll<HTMLInputElement>('#trial-audio input[type="range"]').forEach(input => {
      input.disabled = stopped;
    });
  }

  function setSceneStopped(stopped: boolean) {
    // Invoke resume inside the native button gesture, not from a later frame.
    void setAudioSceneStopped(stopped).then(() => { if (!isStopped()) startMeter(); }, error => {
      if (!isStopped()) updateAudioStatus('Retry');
      console.error(error);
    });
  }

  function updateAudioStatus(status: string, presentButton?: () => void) {
    const indicator = document.querySelector('[data-preview-audio-status]');
    if (archive) document.body.dataset.archiveAudio = status.toLowerCase();
    if (indicator) indicator.textContent = status === 'Retry' ? 'Audio unavailable' : '';
    presentButton?.();
  }

  async function initializeAudio() {
    if (isAudioStarting || isAudioReady) return;
    isAudioStarting = true;
    updateAudioStatus('Starting');
    const button = document.getElementById('play-pause-btn') as HTMLButtonElement | null;
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      if (archive) button.querySelector('.line-action__word')!.textContent = 'Starting';
      else button.innerText = 'Initializing Transmission';
    }
    try {
      await startAudio();
      isAudioReady = true;
    } catch (error) {
      console.error(error);
    } finally {
      // Settle engine state now, but present the startup result as one UI update.
      isAudioStarting = false;
      const label = isAudioReady ? 'Pause' : 'Retry';
      const presentButton = () => {
        if (!button) return;
        if (archive) button.querySelector('.line-action__word')!.textContent = label;
        else button.innerText = `${label} Transmission`;
        button.disabled = false;
        button.removeAttribute('aria-busy');
      };
      updateAudioStatus(isAudioReady ? 'Playing' : 'Retry', archive ? presentButton : undefined);
      if (!archive) presentButton();
    }
    if (isAudioReady) startMeter();
  }

  function bindAudioControls() {
    const playPauseButton = document.getElementById('play-pause-btn');
    let toggling = false;
    const toggleAudio = async () => {
      if (isStopped() || isAudioStarting || toggling) return;
      if (!isAudioReady) {
        await initializeAudio();
        return;
      }
      toggling = true;
      try {
        const playing = await togglePlayback();
        updateAudioStatus(playing ? 'Playing' : 'Paused');
        if (playPauseButton) {
          if (archive) playPauseButton.querySelector('.line-action__word')!.textContent = playing ? 'Pause' : 'Play';
          else playPauseButton.innerText = playing ? 'Pause Transmission' : 'Resume Transmission';
        }
        if (playing) startMeter();
        else stopMeter();
      } catch (error) {
        updateAudioStatus('Retry');
        console.error(error);
      } finally { toggling = false; }
    };
    playPauseButton?.addEventListener('click', toggleAudio);
    // On the rebuild, Points inspect works; only explicit Audio controls change playback.
    if (!document.body.classList.contains('archive-rebuild')) {
      document.querySelectorAll('.work-trigger').forEach((trigger) => {
        trigger.addEventListener('click', toggleAudio);
      });
    }

    document.getElementById('vol-fader')?.addEventListener('input', (event) => {
      setVolume(Number((event.target as HTMLInputElement).value));
    });
    document.getElementById('speed-fader')?.addEventListener('input', (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      setSpeed(value);
      setPlaybackRate(value);
    });
    document.getElementById('dist-fader')?.addEventListener('input', (event) => {
      setDistortion(Number((event.target as HTMLInputElement).value));
    });
    document.getElementById('delay-fader')?.addEventListener('input', (event) => {
      setDelay(Number((event.target as HTMLInputElement).value));
    });
    document.getElementById('reverb-fader')?.addEventListener('input', (event) => {
      setReverb(Number((event.target as HTMLInputElement).value));
    });
  }

  return { initializeAudio, bindAudioControls, setRangesDisabled, setSceneStopped };
}
