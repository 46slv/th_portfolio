import { applyWorkFilters, setTag, setYear } from '../../../lib/filterStore';
import { subscribe } from '../../../lib/workSelectionStore';

export function bindContactCopy() {
  document.querySelectorAll<HTMLElement>('[data-contact-copy]').forEach((button) => {
    button.addEventListener('click', () => {
      const text = button.dataset.contactCopy;
      if (!text) return;

      navigator.clipboard.writeText(text).then(() => {
        const toast = document.getElementById('copy-toast');
        toast?.classList.add('is-visible');
        setTimeout(() => toast?.classList.remove('is-visible'), 2000);
      });
    });
  });
}

export function bindFilters(isStopped: () => boolean, startExperience: () => void) {
  document.querySelectorAll<HTMLButtonElement>('[data-filter-tag]').forEach((button) => {
    button.addEventListener('click', () => {
      if (isStopped()) return;
      startExperience();
      const value = button.dataset.filterTag;
      setTag(value && value !== '__all__' ? value : null);
      applyWorkFilters();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-filter-year]').forEach((button) => {
    button.addEventListener('click', () => {
      if (isStopped()) return;
      startExperience();
      const value = button.dataset.filterYear;
      setYear(value && value !== '__all__' ? value : null);
      applyWorkFilters();
    });
  });
}

export function bindWorkSelection() {
  const workNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-work][data-work-id]'));
  const nodeById = new Map<string, HTMLElement>();
  const mapTarget = document.getElementById('map-target');
  const tooltip = document.getElementById('work-tooltip');
  const tooltipTitle = tooltip?.querySelector<HTMLElement>('[data-tooltip-title]');
  const tooltipArtist = tooltip?.querySelector<HTMLElement>('[data-tooltip-artist]');
  const tooltipYear = tooltip?.querySelector<HTMLElement>('[data-tooltip-year]');
  const tooltipTags = tooltip?.querySelector<HTMLElement>('[data-tooltip-tags]');
  const tooltipMedia = tooltip?.querySelector<HTMLElement>('[data-tooltip-media]');
  const tooltipImage = tooltip?.querySelector<HTMLImageElement>('[data-tooltip-image]');
  let selectedNode: HTMLElement | null = null;
  let previewNode: HTMLElement | null = null;

  workNodes.forEach((node) => {
    const id = node.dataset.workId;
    if (id) nodeById.set(id, node);
  });

  function positionTooltip(node: HTMLElement) {
    if (!tooltip || !mapTarget) return;
    const nodeRect = node.getBoundingClientRect();
    const mapRect = mapTarget.getBoundingClientRect();
    const tooltipWidth = 220;
    const tooltipHeight = tooltip.offsetHeight || 180;
    const preferredLeft = nodeRect.left - mapRect.left + 18;
    const left = Math.max(8, Math.min(preferredLeft, mapRect.width - tooltipWidth - 8));
    const above = nodeRect.top - mapRect.top - tooltipHeight - 10;
    const top = above >= 8 ? above : Math.min(mapRect.height - tooltipHeight - 8, nodeRect.bottom - mapRect.top + 10);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }

  function showTooltip(node: HTMLElement | null) {
    if (!node || !tooltip || node.classList.contains('is-inactive')) return;

    const title = node.dataset.tooltipTitle || 'Untitled';
    const artist = node.dataset.tooltipArtist || 'Unknown';
    const tags = node.dataset.tooltipTags || '';
    const thumbnail = node.dataset.tooltipThumbnail || '';

    if (tooltipTitle) tooltipTitle.textContent = title;
    if (tooltipArtist) tooltipArtist.textContent = `ID: ${artist}`;
    if (tooltipYear) tooltipYear.textContent = node.dataset.year || 'Unknown';
    if (tooltipTags) {
      tooltipTags.textContent = tags;
      tooltipTags.classList.toggle('hidden', !tags);
    }
    if (tooltipImage && tooltipMedia) {
      if (thumbnail) {
        if (tooltipImage.dataset.currentSrc !== thumbnail) {
          tooltipImage.src = thumbnail;
          tooltipImage.dataset.currentSrc = thumbnail;
        }
        tooltipImage.alt = `${title} thumbnail`;
        tooltipMedia.classList.remove('hidden');
      } else {
        tooltipMedia.classList.add('hidden');
        tooltipImage.removeAttribute('src');
        delete tooltipImage.dataset.currentSrc;
        tooltipImage.alt = '';
      }
    }

    positionTooltip(node);
    tooltip.classList.add('is-visible');
    tooltip.setAttribute('aria-hidden', 'false');
  }

  function hideTooltip() {
    tooltip?.classList.remove('is-visible');
    tooltip?.setAttribute('aria-hidden', 'true');
  }

  function restoreSelectedTooltip() {
    if (previewNode) return;
    if (selectedNode) showTooltip(selectedNode);
    else hideTooltip();
  }

  mapTarget?.addEventListener('pointerover', (event) => {
    const node = (event.target as HTMLElement).closest<HTMLElement>('[data-work][data-work-id]');
    if (!node || !mapTarget.contains(node) || node === previewNode) return;
    previewNode = node;
    showTooltip(node);
  });

  mapTarget?.addEventListener('pointerout', (event) => {
    const node = (event.target as HTMLElement).closest<HTMLElement>('[data-work][data-work-id]');
    if (!node || node !== previewNode) return;
    if (event.relatedTarget instanceof Node && node.contains(event.relatedTarget)) return;
    previewNode = null;
    restoreSelectedTooltip();
  });

  mapTarget?.addEventListener('focusin', (event) => {
    const node = (event.target as HTMLElement).closest<HTMLElement>('[data-work][data-work-id]');
    if (!node || !mapTarget.contains(node)) return;
    previewNode = node;
    showTooltip(node);
  });

  mapTarget?.addEventListener('focusout', (event) => {
    const node = (event.target as HTMLElement).closest<HTMLElement>('[data-work][data-work-id]');
    if (!node || node !== previewNode) return;
    if (event.relatedTarget instanceof Node && node.contains(event.relatedTarget)) return;
    previewNode = null;
    restoreSelectedTooltip();
  });

  subscribe((selectedId) => {
    const nextNode = selectedId ? nodeById.get(selectedId) ?? null : null;
    if (nextNode === selectedNode) return;
    selectedNode?.classList.remove('is-selected');
    nextNode?.classList.add('is-selected');
    selectedNode = nextNode;
    if (!previewNode) restoreSelectedTooltip();
  });
}
