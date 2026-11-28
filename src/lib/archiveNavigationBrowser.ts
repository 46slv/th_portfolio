import { ArchiveNavigation, type NavigationCommand, type Panel, type Disclosure, type FocusTarget } from './archiveNavigation';
import { workThumbnail } from './workThumbnail';
import { dispatchArchiveSelection } from './archiveSelectionBrowser';
import { getTag, getYear } from './filterStore';
import { archivePortraitMedia } from './archivePortrait';

// Page-scoped browser adapter. No browser, store or layout dependency crosses into the use case.
export function bootArchiveNavigation() {
  const tagDrawer = document.getElementById('trial-tag');
  const yearDrawer = document.getElementById('trial-year');
  const audioDrawer = document.getElementById('trial-audio');
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-trial-panel]'));
  const entrance = document.getElementById('start-overlay');
  const archiveContent = document.getElementById('archive-content');
  document.addEventListener('click', event => {
    // Let the entrance's own handler start the fade/audio, including clicks on its label.
    if (!archiveContent || !entrance?.contains(event.target as Node) || !entrance.classList.contains('hidden')) return;
    entrance.inert = true;
    archiveContent.inert = false;
  });
  const portrait = archivePortraitMedia();
  const wheel = document.getElementById('archive-wheel');
  const isDisclosure = (panel: unknown): panel is Disclosure => panel === 'tag' || panel === 'year' || panel === 'audio';
  function syncDisclosureDock(active: Panel | null) {
    if (!wheel) return;
    const blocked = portrait.matches && isDisclosure(active);
    if (blocked) {
      if (wheel.contains(document.activeElement)) {
        buttons.find(button => button.dataset.trialPanel === active)?.focus({ preventScroll: true });
      }
      wheel.dispatchEvent(new Event('archive-wheel-collapse'));
    }
    wheel.inert = blocked;
  }

  const details = document.getElementById('trial-detail');
  const detailClose = document.getElementById('trial-detail-close');
  const detailLink = document.getElementById('trial-detail-link') as HTMLAnchorElement | null;
  const detailTitle = document.getElementById('trial-detail-title');
  const detailThumbnail = document.getElementById('trial-detail-thumbnail')!;
  const showDetailThumbnail = workThumbnail(detailThumbnail);
  const detailMeta = document.getElementById('trial-detail-meta');
  const detailTags = document.getElementById('trial-detail-tags');
  const nodes = new Map(Array.from(document.querySelectorAll<HTMLElement>('[data-work][data-work-id]')).map(n => [n.dataset.workId, n]));
  const drawers = { tag: tagDrawer, year: yearDrawer, audio: audioDrawer, detail: details };
  const motionReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const margin = 12;
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));
  function placeDisclosure(name: Disclosure) {
    const panel = drawers[name];
    const trigger = buttons.find(b => b.dataset.trialPanel === name);
    if (!panel || !trigger || panel.hidden) return;
    // Clear previous resize constraints before measuring the real current content.
    panel.style.width = '';
    panel.style.maxHeight = '';
    if (portrait.matches) {
      // The portrait reading lane is sized by CSS, including safe-area overrides.
      panel.style.left = '';
      panel.style.top = '';
      return;
    }
    const r = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const lane = wheel?.getBoundingClientRect().left ?? vw;
    if (name !== 'audio') {
      const x = r.right + 8;
      panel.style.width = `${Math.min(panel.offsetWidth, Math.max(96, lane - x - margin))}px`;
      panel.style.left = `${x}px`;
      panel.style.top = `${r.top}px`;
    } else {
      // Error feedback can extend the launcher; keep the reading panel in
      // the graph lane and away from the persistent Stop button.
      const x = r.right + 12;
      panel.style.width = `${Math.min(panel.offsetWidth, Math.max(1, lane - x - margin))}px`;
      panel.style.maxHeight = `${Math.max(44, vh - 2 * margin)}px`;
      panel.style.left = `${x}px`;
      panel.style.top = `${clamp(r.top + r.height / 2 - panel.offsetHeight / 2,
        margin, Math.max(margin, vh - margin - panel.offsetHeight))}px`;
    }
  }
  const restoreFocus = (target: FocusTarget) => {
    if (target.kind === 'detail-close') {
      detailClose?.focus({ preventScroll: true });
      return;
    }
    let origin: HTMLElement | null | undefined = target.kind === 'disclosure'
      ? buttons.find(b => b.dataset.trialPanel === target.panel)
      : target.kind === 'point'
        ? nodes.get(target.workId)?.querySelector<HTMLElement>('[data-point-float]')
        : document.querySelector<HTMLElement>(`[data-wheel-work][data-work-id="${CSS.escape(target.workId)}"]`);
    if (origin?.closest('#archive-wheel') && (origin.closest('[inert]') || getComputedStyle(origin).visibility === 'hidden')) {
      origin = (portrait.matches && document.querySelector<HTMLElement>('#archive-wheel:not(.is-collapsed) [data-wheel-work][aria-current="true"]')) ||
        document.querySelector<HTMLElement>('[data-wheel-toggle]');
    }
    if (origin?.matches('[data-point-float]')) {
      window.dispatchEvent(new CustomEvent('archive-preview-restore-focus', { detail: origin }));
    }
    origin?.focus({ preventScroll: true });
  };
  function renderDetail(node: HTMLElement) {
    if (!details || !detailTitle || !detailMeta || !detailTags || !detailLink) return;
    if (portrait.matches) details.scrollTop = 0;
    details.dataset.workId = node.dataset.workId ?? '';
    detailTitle.textContent = node.dataset.tooltipTitle || 'Untitled';
    detailMeta.textContent = [node.dataset.tooltipArtist, node.dataset.year].filter(Boolean).join(' / ');
    detailTags.textContent = node.dataset.tooltipTags || '';
    const href = node.querySelector<HTMLAnchorElement>('a[href]')?.href;
    detailLink.hidden = !href || !/^https?:\/\//i.test(href);
    if (href && !detailLink.hidden) detailLink.href = href;
    else detailLink.removeAttribute('href');
    showDetailThumbnail(node.dataset.tooltipThumbnail, detailLink.hidden ? undefined : detailLink.href, detailTitle.textContent || undefined);
  }
  function arrangeDetail() {
    if (!detailTitle || !detailLink) return;
    // Keep text and the real work link together; a slow thumbnail must not
    // reserve the most important reading space on short phones.
    if (portrait.matches) detailLink.after(detailThumbnail);
    else detailTitle.before(detailThumbnail);
  }
  arrangeDetail();
  const available = (node: HTMLElement | undefined) => !!node &&
    !node.closest('[inert]') && !node.classList.contains('is-hidden') && !node.classList.contains('is-inactive');

  // The token is owned by the use case; these maps hold only browser exit effects.
  const exits = new Map<number, Animation>();
  const exitDeadlines = new Map<number, number>();
  const clearExitDeadline = (token: number) => {
    window.clearTimeout(exitDeadlines.get(token));
    exitDeadlines.delete(token);
  };
  const resetExitPanel = (panel: HTMLElement) => {
    panel.inert = false;
    panel.removeAttribute('aria-hidden');
    panel.style.pointerEvents = '';
  };
  const navigation = new ArchiveNavigation({ apply(command: NavigationCommand) {
    switch (command.type) {
      case 'dismiss-preview':
        window.dispatchEvent(new Event('archive-preview-dismiss'));
        break;
      case 'cancel-exit': {
        const old = drawers[command.panel];
        clearExitDeadline(command.token);
        if (old) old.hidden = true;
        exits.get(command.token)?.cancel();
        exits.delete(command.token);
        if (old) resetExitPanel(old);
        if (command.panel === 'detail') showDetailThumbnail();
        break;
      }
      case 'present':
        for (const name of Object.keys(drawers) as Panel[]) {
          const panel = drawers[name];
          if (panel) panel.hidden = name !== command.active && name !== command.exiting;
        }
        for (const b of buttons) b.setAttribute('aria-expanded', String(b.dataset.trialPanel === command.active));
        if (isDisclosure(command.active)) placeDisclosure(command.active);
        document.body.classList.toggle('trial-has-drawer', Boolean(command.active));
        syncDisclosureDock(command.active);
        break;
      case 'begin-exit': {
        const departing = drawers[command.panel];
        if (!departing) break;
        departing.inert = true;
        departing.setAttribute('aria-hidden', 'true');
        departing.style.pointerEvents = 'none';
        const offset = command.panel === 'detail' && portrait.matches ? '0 12px' : '-12px 0';
        const { opacity, translate } = getComputedStyle(departing);
        const animation = departing.animate([
          { opacity, translate }, { opacity: 0, translate: offset },
        ], { duration: 100, easing: 'ease-in', fill: 'forwards' });
        exits.set(command.token, animation);
        animation.finished.then(() => navigation.finishExit(command.token)).catch(() => { /* Cancelled by newer navigation. */ });
        // WAAPI completion can stall with frame delivery; bound Filter and Audio Escape exits.
        if (command.panel === 'tag' || command.panel === 'year' || (command.panel === 'audio' && command.cause === 'escape')) {
          exitDeadlines.set(command.token, window.setTimeout(() => navigation.finishExit(command.token), 100));
        }
        break;
      }
      case 'finish-exit': {
        clearExitDeadline(command.token);
        const departing = drawers[command.panel];
        if (departing) {
          departing.hidden = true;
          // Remove a forwards effect only after hiding: no flash on reopen.
          exits.get(command.token)?.cancel();
          resetExitPanel(departing);
        }
        exits.delete(command.token);
        if (command.panel === 'detail') showDetailThumbnail();
        break;
      }
      case 'clear-detail': showDetailThumbnail(); break;
      case 'render-detail': {
        const node = nodes.get(command.workId);
        if (node) renderDetail(node);
        break;
      }
      case 'select-work': dispatchArchiveSelection({ kind: 'point-activate', workId: command.workId }); break;
      case 'focus': restoreFocus(command.target); break;
      default: {
        const unhandled: never = command;
        throw new Error(`Unhandled archive navigation command: ${JSON.stringify(unhandled)}`);
      }
    }
  }});
  const placeActive = () => { if (isDisclosure(navigation.active)) placeDisclosure(navigation.active); };
  portrait.addEventListener('change', () => {
    arrangeDetail();
    placeActive();
    syncDisclosureDock(navigation.active);
  });
  window.addEventListener('resize', placeActive);
  const panelObserver = new ResizeObserver(placeActive);
  for (const b of buttons) panelObserver.observe(b);

  const close = () => navigation.explicitClose(motionReduced());
  detailClose?.addEventListener('click', close);
  document.addEventListener('click', e => {
    const element = e.target as Element;
    if (archiveContent?.inert || element.closest('[inert]')) return;
    const item = element.closest<HTMLElement>('[data-wheel-work]');
    if (item) {
      const id = item.dataset.workId ?? '';
      navigation.openWork({ kind: 'wheel', workId: id }, available(nodes.get(id)));
      return;
    }
    const point = element.closest<HTMLElement>('[data-point-float]');
    const owner = point?.closest<HTMLElement>('[data-work]');
    if (point && owner) {
      if ((e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey) return;
      const id = owner.dataset.workId ?? '';
      if (!available(owner)) return;
      e.preventDefault();
      navigation.openWork({ kind: 'point', workId: id }, true);
    }
  });
  window.addEventListener('archive-wheel-selected', e => {
    const id = (e as CustomEvent<string>).detail;
    navigation.wheelSelected(id, available(nodes.get(id)));
  });
  function syncPointInert() {
    document.querySelectorAll<HTMLElement>('#map-target [data-work]').forEach(node => {
      node.inert = node.classList.contains('is-inactive') || node.classList.contains('is-hidden');
    });
  }
  function syncFilterPressed() {
    const appliedTag = getTag();
    const appliedYear = getYear();
    const tag = appliedTag ?? '__all__';
    const year = appliedYear ?? '__all__';
    for (const [panel, label, applied] of [['tag', 'Tag', appliedTag], ['year', 'Year', appliedYear]]) {
      const disclosure = buttons.find(b => b.dataset.trialPanel === panel);
      const value = disclosure?.querySelector<HTMLElement>('[data-trial-filter-value]');
      if (!disclosure || !value) continue;
      value.textContent = applied ?? '';
      value.hidden = !applied;
      if (applied) disclosure.setAttribute('aria-label', `${label}: ${applied}`);
      else disclosure.removeAttribute('aria-label');
    }
    document.querySelectorAll<HTMLButtonElement>('[data-filter-tag]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.filterTag === tag));
    });
    document.querySelectorAll<HTMLButtonElement>('[data-filter-year]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.filterYear === year));
    });
  }
  window.addEventListener('work-filters-applied', () => {
    syncPointInert();
    syncFilterPressed();
    navigation.filtersApplied();
  });
  syncPointInert();
  syncFilterPressed();
  buttons.forEach(b => b.addEventListener('click', () => {
    const name = b.dataset.trialPanel;
    if (!archiveContent?.inert && isDisclosure(name)) navigation.toggle(name, motionReduced());
  }));
  document.querySelector('.trial-audio-close')?.addEventListener('click', close);
  document.querySelectorAll('.trial-filter-close').forEach(b => b.addEventListener('click', close));
  document.addEventListener('click', e => {
    const active = navigation.active;
    if (!active) return;
    const target = e.target as Element;
    if (drawers[active]?.contains(target) || buttons.some(b => b.contains(target)) ||
        target.closest('#point-preview,#archive-wheel,[data-work],[data-archive-stop]')) return;
    navigation.outsideClose();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && navigation.active) navigation.escape(motionReduced());
  });
}
