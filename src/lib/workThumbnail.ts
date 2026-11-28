// Use only the thumbnail URL already projected by WorkNode. The slot has
// its final dimensions before the request, so asynchronous loading can never
// move a hovered card or its link. A missing URL reserves no space.
export function workThumbnail(slot: HTMLElement, present: (update: () => void) => void = update => update()) {
  let current: HTMLImageElement | null = null;
  const failed = new Set<string>();

  return function show(url?: string, workUrl?: string, workTitle?: string) {
    current = null;
    slot.replaceChildren();
    slot.hidden = true;
    if (!url || failed.has(url) || !/^https:\/\/img\.youtube\.com\/vi\/[A-Za-z0-9_-]+\/mqdefault\.jpg$/.test(url))
      return;

    const image = document.createElement('img');
    current = image;
    slot.hidden = false;
    image.hidden = true;
    image.alt = '';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    const fail = () => {
      if (current !== image) return;
      if (failed.size < 96) failed.add(url);
      image.remove();
      // Retain the slot until this card is dismissed, keeping text/link stable.
    };
    image.addEventListener('load', () => {
      image.decode().then(() => present(() => {
        if (current !== image) return;
        image.hidden = false;
        // Only a decoded image shares the explicit URL. Never add a keyboard stop.
        if (workUrl && /^https?:\/\//i.test(workUrl)) {
          const link = document.createElement('a');
          link.href = workUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.tabIndex = -1;
          link.setAttribute('aria-label', workTitle ? `Open work: ${workTitle}` : 'Open work');
          image.replaceWith(link);
          link.append(image);
        }
      })).catch(fail);
    }, { once: true });
    image.addEventListener('error', fail, { once: true });
    slot.append(image);
    image.src = url;
  };
}
