import type { Species } from './model';
import { cardBackMarkup, cardFaceMarkup } from './graphics';

type PileDragSource = 'deck' | 'discard';
type PendingSource = 'draw' | 'discard';

interface ActiveDrag {
  pointerId: number;
  source: PileDragSource;
  startX: number;
  startY: number;
  moved: boolean;
  preview: HTMLElement;
}

export interface ZoffDragCallbacks {
  canDragDeck: () => boolean;
  canDragDiscard: () => boolean;
  onDrawStart: () => void;
  onTakeDiscardStart: () => void;
  onPlace: (row: number, col: number) => void;
  isPlaceable: (row: number, col: number) => boolean;
  getPendingSpecies: () => Species | null;
  getPendingSource: () => PendingSource | null;
  isDiscardRevealMode: () => boolean;
}

const MOVE_THRESHOLD = 6;
const CLICK_SUPPRESS_MS = 320;
export const ZOFF_DRAGGING_CLASS = 'zoff-root--dragging';

export class ZoffDragController {
  private drag: ActiveDrag | null = null;
  private suppressClicksUntil = 0;
  private disposed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: ZoffDragCallbacks,
  ) {
    this.root.addEventListener('pointerdown', this.onPointerDown);
  }

  get isDragging(): boolean {
    return this.drag !== null;
  }

  shouldSuppressClick(): boolean {
    return performance.now() < this.suppressClicksUntil;
  }

  cancel(): void {
    this.endDrag(false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
    this.clearDraggingClass();
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.detachWindowListeners();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.disposed || this.drag || event.button !== 0) return;
    if (this.callbacks.isDiscardRevealMode()) return;

    const deck = (event.target as HTMLElement).closest<HTMLElement>('[data-drag-deck]');
    const discard = (event.target as HTMLElement).closest<HTMLElement>('[data-drag-discard]');
    const source: PileDragSource | null = deck
      ? 'deck'
      : discard
        ? 'discard'
        : null;
    if (!source) return;

    if (source === 'deck' && !this.callbacks.canDragDeck()) return;
    if (source === 'discard' && !this.callbacks.canDragDiscard()) return;

    event.preventDefault();
    if (typeof this.root.setPointerCapture === 'function') {
      this.root.setPointerCapture(event.pointerId);
    }

    if (source === 'deck') this.callbacks.onDrawStart();
    else this.callbacks.onTakeDiscardStart();

    const preview = this.createPreview(source);
    this.root.appendChild(preview);
    this.positionPreview(preview, event.clientX, event.clientY);
    this.refreshPreviewContent(preview);

    this.drag = {
      pointerId: event.pointerId,
      source,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      preview,
    };

    this.root.classList.add(ZOFF_DRAGGING_CLASS);
    this.attachWindowListeners();
    this.updateHighlights(event.clientX, event.clientY);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.moved ||= Math.hypot(dx, dy) > MOVE_THRESHOLD;

    this.positionPreview(drag.preview, event.clientX, event.clientY);
    this.refreshPreviewContent(drag.preview);
    this.updateHighlights(event.clientX, event.clientY);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();

    const pendingSource = this.callbacks.getPendingSource();
    const sourceMatches =
      pendingSource !== null &&
      ((drag.source === 'deck' && pendingSource === 'draw') ||
        (drag.source === 'discard' && pendingSource === 'discard'));
    const target = this.dropTargetAt(event.clientX, event.clientY);
    const placeTarget =
      drag.moved &&
      target !== null &&
      sourceMatches &&
      this.callbacks.isPlaceable(target.row, target.col)
        ? target
        : null;

    if (drag.moved) this.suppressClicksUntil = performance.now() + CLICK_SUPPRESS_MS;
    this.endDrag(placeTarget !== null);

    if (placeTarget) {
      this.callbacks.onPlace(placeTarget.row, placeTarget.col);
    }
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.moved) this.suppressClicksUntil = performance.now() + CLICK_SUPPRESS_MS;
    this.endDrag(false);
  };

  private createPreview(source: PileDragSource): HTMLElement {
    const preview = document.createElement('div');
    preview.className = 'zoff-drag-preview';
    preview.setAttribute('aria-hidden', 'true');

    const species = this.callbacks.getPendingSpecies();
    if (species) {
      preview.innerHTML = cardFaceMarkup(species, { compact: true });
    } else if (source === 'deck') {
      preview.innerHTML = cardBackMarkup({ compact: true });
    }

    return preview;
  }

  private refreshPreviewContent(preview: HTMLElement): void {
    const species = this.callbacks.getPendingSpecies();
    if (!species) return;
    preview.innerHTML = cardFaceMarkup(species, { compact: true });
  }

  private positionPreview(preview: HTMLElement, clientX: number, clientY: number): void {
    preview.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;
  }

  private dropTargetAt(
    clientX: number,
    clientY: number,
  ): { row: number; col: number; element: HTMLElement } | null {
    const elements = this.elementsAt(clientX, clientY);
    for (const element of elements) {
      const placeable = (element as HTMLElement).closest<HTMLElement>('[data-place]');
      if (placeable) {
        return {
          row: Number(placeable.dataset.row),
          col: Number(placeable.dataset.col),
          element: placeable,
        };
      }
    }
    return null;
  }

  private elementsAt(clientX: number, clientY: number): Element[] {
    if (typeof document.elementsFromPoint === 'function') {
      return document.elementsFromPoint(clientX, clientY);
    }
    const hit = document.elementFromPoint(clientX, clientY);
    return hit ? [hit] : [];
  }

  private updateHighlights(clientX: number, clientY: number): void {
    const drag = this.drag;
    const pendingSource = this.callbacks.getPendingSource();
    const sourceMatches =
      drag !== null &&
      pendingSource !== null &&
      ((drag.source === 'deck' && pendingSource === 'draw') ||
        (drag.source === 'discard' && pendingSource === 'discard'));
    const target = this.dropTargetAt(clientX, clientY);

    this.root.querySelectorAll<HTMLElement>('[data-place]').forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const aimed =
        drag !== null &&
        sourceMatches &&
        this.callbacks.isPlaceable(row, col) &&
        target !== null &&
        target.row === row &&
        target.col === col;
      cell.classList.toggle('zoff-cell--drag-aimed', aimed);
    });
  }

  private clearHighlights(): void {
    this.root.querySelectorAll('.zoff-cell--drag-aimed').forEach((cell) => {
      cell.classList.remove('zoff-cell--drag-aimed');
    });
  }

  private endDrag(_placed: boolean): void {
    const drag = this.drag;
    if (!drag) return;

    drag.preview.remove();
    this.drag = null;
    this.clearHighlights();
    this.clearDraggingClass();
    this.detachWindowListeners();

    if (
      typeof this.root.hasPointerCapture === 'function' &&
      this.root.hasPointerCapture(drag.pointerId)
    ) {
      this.root.releasePointerCapture(drag.pointerId);
    }
  }

  private clearDraggingClass(): void {
    this.root.classList.remove(ZOFF_DRAGGING_CLASS);
  }

  private attachWindowListeners(): void {
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
  }

  private detachWindowListeners(): void {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
  }
}
