// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Zone } from './model';
import { FlickController } from './controls';

function pointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  target.dispatchEvent(event);
}

describe('flick zone targeting', () => {
  let root: HTMLElement;
  let card: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `<div id="app">
      <main data-arena>
        <section data-lane="kontext"></section>
        <section data-lane="logik"></section>
        <section data-lane="output"></section>
      </main>
      <button data-card data-player="0" data-slot="0"></button>
    </div>`;
    root = document.querySelector('#app')!;
    card = root.querySelector('[data-card]')!;
    Object.assign(root, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });
    root.querySelector<HTMLElement>('[data-arena]')!.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 300,
      }) as DOMRect;
  });

  it('returns a fixed-zone card after a flick into another zone', () => {
    const onPlay = vi.fn();
    new FlickController(root, {
      canDrag: () => true,
      playableZones: () => ['kontext'],
      onPlay,
    });

    pointer(card, 'pointerdown', 50, 200);
    pointer(card, 'pointermove', 250, 100);
    expect(root.querySelector('[data-lane="output"]')?.classList.contains('aimed')).toBe(false);
    pointer(card, 'pointerup', 250, 100);

    expect(onPlay).not.toHaveBeenCalled();
  });

  it.each<Zone>(['kontext', 'logik', 'output'])(
    'plays a wildcard card in the %s zone',
    (zone) => {
      const onPlay = vi.fn();
      new FlickController(root, {
        canDrag: () => true,
        playableZones: () => ['kontext', 'logik', 'output'],
        onPlay,
      });
      const clientX = { kontext: 50, logik: 150, output: 250 }[zone];

      pointer(card, 'pointerdown', clientX, 200);
      pointer(card, 'pointermove', clientX, 100);
      expect(root.querySelector(`[data-lane="${zone}"]`)?.classList.contains('aimed')).toBe(true);
      pointer(card, 'pointerup', clientX, 100);

      expect(onPlay).toHaveBeenCalledWith(0, 0, zone, expect.any(Number));
    },
  );
});
