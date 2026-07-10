import { BALANCE } from '../game/cards';
import { ZONES, type PlayerId, type Zone } from '../game/types';

interface Drag {
  pointerId: number;
  player: PlayerId;
  slot: number;
  element: HTMLElement;
  startX: number;
  startY: number;
  startedAt: number;
  moved: boolean;
}

interface FlickCallbacks {
  canDrag: (player: PlayerId, slot: number) => boolean;
  playableZones: (player: PlayerId, slot: number) => readonly Zone[];
  onPlay: (player: PlayerId, slot: number, zone: Zone, travelMs: number) => void;
}

export class FlickController {
  private readonly drags = new Map<number, Drag>();
  private suppressClicksUntil = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: FlickCallbacks,
  ) {
    root.addEventListener('pointerdown', this.pointerDown);
    root.addEventListener('pointermove', this.pointerMove);
    root.addEventListener('pointerup', this.pointerUp);
    root.addEventListener('pointercancel', this.pointerCancel);
  }

  get isDragging(): boolean {
    return this.drags.size > 0;
  }

  shouldSuppressClick(): boolean {
    return performance.now() < this.suppressClicksUntil;
  }

  private readonly pointerDown = (event: PointerEvent): void => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-card]');
    if (!element || event.button !== 0) return;
    const player = Number(element.dataset.player) as PlayerId;
    const slot = Number(element.dataset.slot);
    if (!this.callbacks.canDrag(player, slot)) return;

    event.preventDefault();
    this.root.setPointerCapture(event.pointerId);
    element.classList.add('dragging');
    this.drags.set(event.pointerId, {
      pointerId: event.pointerId,
      player,
      slot,
      element,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      moved: false,
    });
  };

  private readonly pointerMove = (event: PointerEvent): void => {
    const drag = this.drags.get(event.pointerId);
    if (!drag) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.moved ||= Math.hypot(dx, dy) > 5;
    const localX = drag.player === 1 ? -dx : dx;
    const localY = drag.player === 1 ? -dy : dy;
    drag.element.style.transform = `translate3d(${localX}px, ${localY}px, 0) rotate(${localX * 0.04}deg) scale(1.06)`;

    const lane = this.laneAt(event.clientX);
    const playableZones = this.callbacks.playableZones(drag.player, drag.slot);
    this.root.querySelectorAll('[data-lane]').forEach((item) => {
      const itemLane = (item as HTMLElement).dataset.lane as Zone;
      item.classList.toggle('aimed', itemLane === lane && playableZones.includes(itemLane));
    });
  };

  private readonly pointerUp = (event: PointerEvent): void => {
    const drag = this.drags.get(event.pointerId);
    if (!drag) return;
    event.preventDefault();
    const dy = event.clientY - drag.startY;
    const elapsed = Math.max(16, performance.now() - drag.startedAt);
    const towardCenter = drag.player === 0 ? -dy : dy;
    const velocity = towardCenter / elapsed;
    const validFlick = towardCenter >= BALANCE.minFlickDistance || velocity >= 0.35;

    this.clearDrag(drag);
    if (drag.moved) this.suppressClicksUntil = performance.now() + 300;

    if (validFlick) {
      const zone = this.laneAt(event.clientX);
      if (!this.callbacks.playableZones(drag.player, drag.slot).includes(zone)) return;
      const travelMs = Math.round(BALANCE.maxTravelMs - Math.min(1.4, Math.max(0, velocity)) * 120);
      this.callbacks.onPlay(drag.player, drag.slot, zone, travelMs);
    }
  };

  private readonly pointerCancel = (event: PointerEvent): void => {
    const drag = this.drags.get(event.pointerId);
    if (drag) this.clearDrag(drag);
  };

  private clearDrag(drag: Drag): void {
    drag.element.classList.remove('dragging');
    drag.element.style.transform = '';
    this.drags.delete(drag.pointerId);
    this.root.querySelectorAll('[data-lane].aimed').forEach((item) => item.classList.remove('aimed'));
    if (this.root.hasPointerCapture(drag.pointerId)) this.root.releasePointerCapture(drag.pointerId);
  }

  private laneAt(clientX: number): Zone {
    const arena = this.root.querySelector<HTMLElement>('[data-arena]');
    if (!arena) return 'logik';
    const rect = arena.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.999, (clientX - rect.left) / Math.max(1, rect.width)));
    return ZONES[Math.floor(ratio * ZONES.length)]!;
  }
}
