import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

test('work thumbnails link only decoded images and isolate late load/error from current cards', async () => {
  const script = readFileSync(new URL('../src/lib/workThumbnail.ts', import.meta.url), 'utf8');
  const slot = {
    hidden: true, children: [],
    replaceChildren() { this.children = []; },
    append(image) { this.children.push(image); },
  };
  class ImageFixture extends EventTarget {
    decode() { return Promise.resolve(); }
    remove() { slot.children = slot.children.filter((image) => image !== this); }
    replaceWith(link) { slot.children = slot.children.map(child => child === this ? link : child); }
  }
  const create = vm.runInNewContext(stripTypeScriptTypes(script.replace('export function', 'function')) + '\nworkThumbnail',
    { document: { createElement: tag => tag === 'img' ? new ImageFixture() : {
      children: [], setAttribute(key,value) { this[key] = value; }, append(child) { this.children.push(child); },
    } } });
  const show = create(slot);
  show();
  show('https://other.example/thumbnail.png');
  assert.equal(slot.hidden, true);
  assert.deepEqual(slot.children, []);

  const firstUrl = 'https://img.youtube.com/vi/first_id/mqdefault.jpg';
  const secondUrl = 'https://img.youtube.com/vi/second_id/mqdefault.jpg';
  show(firstUrl);
  const [first] = slot.children;
  assert.equal(first.hidden, true);
  assert.equal(slot.hidden, false, 'reserve space before async load');
  show(secondUrl, 'https://example.org/work', 'Example title');
  const [second] = slot.children;
  first.dispatchEvent(new Event('load'));
  first.dispatchEvent(new Event('error'));
  assert.deepEqual(slot.children, [second]);
  assert.equal(second.hidden, true);
  second.dispatchEvent(new Event('load'));
  assert.equal(second.hidden, true, 'load before decode has no pointer link');
  await Promise.resolve();
  assert.equal(second.hidden, false);
  assert.equal(second.src, secondUrl);
  const [link] = slot.children;
  assert.equal(link.href, 'https://example.org/work');
  assert.equal(link.tabIndex, -1);
  assert.equal(link['aria-label'], 'Open work: Example title');
  assert.equal(link['aria-hidden'], undefined);
  assert.deepEqual(link.children, [second]);

  show(firstUrl);
  const [next] = slot.children;
  next.dispatchEvent(new Event('error'));
  assert.deepEqual(slot.children, []);
  assert.equal(slot.hidden, false, 'do not move the current card or link on failure');
  show();
  show(firstUrl);
  assert.deepEqual(slot.children, []);
  assert.equal(slot.hidden, true, 'a known failure is text-only on the next open');
  const badDecode = 'https://img.youtube.com/vi/bad_decode/mqdefault.jpg';
  show(badDecode,'https://example.org/work');
  const [bad] = slot.children;
  bad.decode = () => Promise.reject(new Error('decode failed'));
  bad.dispatchEvent(new Event('load'));
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(slot.children, [], 'undecodable image never becomes a link');
  const noWorkUrl = 'https://img.youtube.com/vi/unlinked/mqdefault.jpg';
  show(noWorkUrl);
  const [unlinked] = slot.children;
  unlinked.dispatchEvent(new Event('load'));
  await Promise.resolve();
  assert.deepEqual(slot.children,[unlinked], 'an image without a real work URL is not clickable');
});
