// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, transition } from './reducer';
import { ZoffDragController, ZOFF_DRAGGING_CLASS } from './controls';

function dispatchPointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  target: EventTarget,
  init: PointerEventInit,
): void {
  const event = new PointerEvent(type, { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
}

describe('zoff drag controls', () => {
  let root: HTMLElement;
  let controller: ZoffDragController | null = null;
  const onDrawStart = vi.fn();
  const onTakeDiscardStart = vi.fn();
  const onPlace = vi.fn();

  beforeEach(() => {
    transition(createGame(21), { type: 'start' });
    document.body.innerHTML = `<div id="root" data-theme="zoff-in-the-sky">
      <div class="zoff-pile zoff-pile--deck" data-drag-deck></div>
      <div class="zoff-pile zoff-pile--discard" data-drag-discard></div>
      <button type="button" class="zoff-cell" data-place data-row="0" data-col="0"></button>
    </div>`;
    root = document.querySelector('#root')!;
    root.setPointerCapture = vi.fn();
    root.releasePointerCapture = vi.fn();
    root.hasPointerCapture = vi.fn(() => true);
    document.elementsFromPoint = (() => []) as typeof document.elementsFromPoint;
    onDrawStart.mockClear();
    onTakeDiscardStart.mockClear();
    onPlace.mockClear();
    controller = new ZoffDragController(root, {
      canDragDeck: () => true,
      canDragDiscard: () => true,
      onDrawStart,
      onTakeDiscardStart,
      onPlace,
      isPlaceable: () => true,
      getPendingSpecies: () => 'fox',
      getPendingSource: () => 'draw',
      isDiscardRevealMode: () => false,
    });
  });

  afterEach(() => {
    controller?.dispose();
    controller = null;
    document.body.innerHTML = '';
  });

  it('dispatches draw at deck gesture start and places on legal drop', () => {
    const deck = root.querySelector('[data-drag-deck]')!;
    const target = root.querySelector('[data-place]') as HTMLElement;
    const elementsFromPoint = vi
      .spyOn(document, 'elementsFromPoint')
      .mockReturnValue([target]);

    dispatchPointer('pointerdown', deck, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    expect(onDrawStart).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.zoff-drag-preview')).not.toBeNull();

    dispatchPointer('pointermove', window, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });
    dispatchPointer('pointerup', window, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });

    expect(onPlace).toHaveBeenCalledWith(0, 0);
    expect(root.querySelector('.zoff-drag-preview')).toBeNull();
    expect(target.classList.contains('zoff-cell--drag-aimed')).toBe(false);
    expect(target.classList.contains('zoff-cell--drag-target')).toBe(false);
    elementsFromPoint.mockRestore();
  });

  it('keeps pending state when released outside a target', () => {
    const deck = root.querySelector('[data-drag-deck]')!;

    dispatchPointer('pointerdown', deck, { pointerId: 2, clientX: 8, clientY: 8, button: 0 });
    dispatchPointer('pointermove', window, { pointerId: 2, clientX: 30, clientY: 30, button: 0 });
    dispatchPointer('pointerup', window, { pointerId: 2, clientX: 5, clientY: 5, button: 0 });

    expect(onPlace).not.toHaveBeenCalled();
  });

  it('appends the drag preview inside the themed root with Lit card content', () => {
    const deck = root.querySelector('[data-drag-deck]')!;
    dispatchPointer('pointerdown', deck, { pointerId: 6, clientX: 10, clientY: 10, button: 0 });
    const preview = root.querySelector('.zoff-drag-preview');
    expect(preview).not.toBeNull();
    expect(root.contains(preview)).toBe(true);
    expect(preview?.querySelector('.zoff-card-face--compact, .zoff-card-back--compact')).not.toBeNull();
    dispatchPointer('pointerup', window, { pointerId: 6, clientX: 10, clientY: 10, button: 0 });
  });

  it('suppresses click after a drag gesture', () => {
    const deck = root.querySelector('[data-drag-deck]')!;

    dispatchPointer('pointerdown', deck, { pointerId: 3, clientX: 10, clientY: 10, button: 0 });
    dispatchPointer('pointermove', window, { pointerId: 3, clientX: 30, clientY: 30, button: 0 });
    dispatchPointer('pointerup', window, { pointerId: 3, clientX: 30, clientY: 30, button: 0 });

    expect(controller!.shouldSuppressClick()).toBe(true);
  });

  it('cleans up preview and highlights on cancel', () => {
    const discard = root.querySelector('[data-drag-discard]')!;

    dispatchPointer('pointerdown', discard, { pointerId: 4, clientX: 12, clientY: 12, button: 0 });
    dispatchPointer('pointermove', window, { pointerId: 4, clientX: 28, clientY: 28, button: 0 });
    dispatchPointer('pointercancel', window, { pointerId: 4, clientX: 28, clientY: 28, button: 0 });

    expect(root.querySelector('.zoff-drag-preview')).toBeNull();
  });

  it('starts discard take from the discard pile', () => {
    const discard = root.querySelector('[data-drag-discard]')!;
    dispatchPointer('pointerdown', discard, { pointerId: 5, clientX: 10, clientY: 10, button: 0 });
    expect(onTakeDiscardStart).toHaveBeenCalledTimes(1);
  });

  it('highlights only the aimed legal cell during drag', () => {
    document.body.innerHTML = `<div id="root" data-theme="zoff-in-the-sky">
      <div class="zoff-pile zoff-pile--deck" data-drag-deck></div>
      <button type="button" class="zoff-cell zoff-cell--placeable" data-place data-row="0" data-col="0"></button>
      <button type="button" class="zoff-cell zoff-cell--placeable" data-place data-row="0" data-col="1"></button>
    </div>`;
    root = document.querySelector('#root')!;
    root.setPointerCapture = vi.fn();
    root.releasePointerCapture = vi.fn();
    root.hasPointerCapture = vi.fn(() => true);
    controller?.dispose();
    controller = new ZoffDragController(root, {
      canDragDeck: () => true,
      canDragDiscard: () => true,
      onDrawStart,
      onTakeDiscardStart,
      onPlace,
      isPlaceable: () => true,
      getPendingSpecies: () => 'fox',
      getPendingSource: () => 'draw',
      isDiscardRevealMode: () => false,
    });

    const deck = root.querySelector('[data-drag-deck]')!;
    const first = root.querySelector('[data-place][data-col="0"]') as HTMLElement;
    const second = root.querySelector('[data-place][data-col="1"]') as HTMLElement;
    const elementsFromPoint = vi
      .spyOn(document, 'elementsFromPoint')
      .mockReturnValue([second]);

    dispatchPointer('pointerdown', deck, { pointerId: 10, clientX: 10, clientY: 10, button: 0 });
    dispatchPointer('pointermove', window, { pointerId: 10, clientX: 40, clientY: 40, button: 0 });

    expect(first.classList.contains('zoff-cell--drag-aimed')).toBe(false);
    expect(second.classList.contains('zoff-cell--drag-aimed')).toBe(true);
    expect(first.classList.contains('zoff-cell--drag-target')).toBe(false);
    expect(second.classList.contains('zoff-cell--drag-target')).toBe(false);

    dispatchPointer('pointerup', window, { pointerId: 10, clientX: 40, clientY: 40, button: 0 });
    elementsFromPoint.mockRestore();
  });

  it('toggles the root dragging class for the full drag lifetime', () => {
    const deck = root.querySelector('[data-drag-deck]')!;

    dispatchPointer('pointerdown', deck, { pointerId: 7, clientX: 10, clientY: 10, button: 0 });
    expect(root.classList.contains(ZOFF_DRAGGING_CLASS)).toBe(true);

    dispatchPointer('pointermove', window, { pointerId: 7, clientX: 30, clientY: 30, button: 0 });
    expect(root.classList.contains(ZOFF_DRAGGING_CLASS)).toBe(true);

    dispatchPointer('pointerup', window, { pointerId: 7, clientX: 30, clientY: 30, button: 0 });
    expect(root.classList.contains(ZOFF_DRAGGING_CLASS)).toBe(false);
  });

  it('removes the dragging class on cancel and dispose', () => {
    const deck = root.querySelector('[data-drag-deck]')!;

    dispatchPointer('pointerdown', deck, { pointerId: 8, clientX: 10, clientY: 10, button: 0 });
    dispatchPointer('pointercancel', window, { pointerId: 8, clientX: 10, clientY: 10, button: 0 });
    expect(root.classList.contains(ZOFF_DRAGGING_CLASS)).toBe(false);

    dispatchPointer('pointerdown', deck, { pointerId: 9, clientX: 10, clientY: 10, button: 0 });
    controller!.dispose();
    controller = null;
    expect(root.classList.contains(ZOFF_DRAGGING_CLASS)).toBe(false);
  });
});
