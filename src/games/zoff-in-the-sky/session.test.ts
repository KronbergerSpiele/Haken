// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionContext } from '../../engine/contracts';
import { createSeededRandom } from '../../engine/random';
import { createEffectService } from '../../graphics/effects';
import { createFeedbackService } from '../../graphics/feedback';
import { createGraphicsService } from '../../graphics/primitives';
import { createInputService } from '../../engine/input';
import { RuntimeClock } from '../../engine/runtime';
import { ZoffSession } from './session';
import type { GameEvent } from './model';

function dispatchPointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  target: EventTarget,
  init: PointerEventInit,
): void {
  const event = new PointerEvent(type, { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
}

function mountPlayableSession(root: HTMLElement, seed = 7): ZoffSession {
  const session = new ZoffSession(createContext(seed)) as ZoffSession;
  session.mount(root);
  root.querySelector<HTMLButtonElement>('[data-start]')!.click();
  root.setPointerCapture = vi.fn();
  root.releasePointerCapture = vi.fn();
  root.hasPointerCapture = vi.fn(() => true);
  document.elementsFromPoint = (() => []) as typeof document.elementsFromPoint;
  return session;
}

function createContext(seed = 42): SessionContext {
  return {
    seed,
    clock: new RuntimeClock(),
    random: createSeededRandom(seed),
    input: createInputService(),
    graphics: createGraphicsService(),
    effects: createEffectService(),
    feedback: createFeedbackService(),
    announce: vi.fn(),
    requestExit: vi.fn(),
  };
}

describe('zoff session', () => {
  let root: HTMLElement;
  let session: ZoffSession | null = null;

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div>';
    root = document.querySelector('#game-root')!;
  });

  afterEach(() => {
    session?.dispose();
    session = null;
  });

  it('mounts with theme scope and collection exit', () => {
    session = new ZoffSession(createContext()) as ZoffSession;
    session.mount(root);
    expect(root.dataset.theme).toBe('zoff-in-the-sky');
    expect(root.querySelector('[data-start]')).not.toBeNull();
    expect(root.querySelector('[data-exit-collection]')).not.toBeNull();
  });

  it('shows the board directly after start without confirmation', () => {
    session = new ZoffSession(createContext()) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();
    expect(root.querySelector('.zoff-game')).not.toBeNull();
    expect(root.querySelector('[data-confirm-handoff]')).toBeNull();
    expect(root.classList.contains('zoff-root--turn-flip')).toBe(true);
    expect(root.querySelector('[data-draw]')).not.toBeNull();
  });

  it('shows a turn toast and auto-flips after 1.2 seconds on active-player change', () => {
    vi.useFakeTimers();
    session = mountPlayableSession(root, 12);
    const internal = session as unknown as {
      game: { activePlayer: 0 | 1 };
      handleEvents(events: GameEvent[], previousActive: 0 | 1): void;
      draw(): void;
    };
    internal.game.activePlayer = 1;
    internal.handleEvents([], 0);
    internal.draw();

    expect(root.querySelector('.zoff-turn-toast')).not.toBeNull();
    expect(root.textContent).toContain('Spieler 2 ist dran');
    expect(root.querySelector('[data-draw]')).toBeNull();
    expect(root.classList.contains('zoff-root--turn-toast')).toBe(true);

    vi.advanceTimersByTime(1_199);
    expect(root.querySelector('.zoff-turn-toast')).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(root.querySelector('.zoff-turn-toast')).toBeNull();
    expect(root.classList.contains('zoff-root--turn-flip')).toBe(true);
    expect(root.querySelector('[data-draw]')).not.toBeNull();
    vi.useRealTimers();
  });

  it('exposes draggable pile sources after start', () => {
    session = new ZoffSession(createContext()) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();
    expect(root.querySelector('[data-drag-deck]')).not.toBeNull();
    expect(root.querySelector('[data-drag-discard]')).not.toBeNull();
  });

  it('does not expose misleading keyboard semantics on draggable piles', () => {
    session = mountPlayableSession(root);
    const deck = root.querySelector('[data-drag-deck]')!;
    const discard = root.querySelector('[data-drag-discard]')!;
    expect(deck.getAttribute('role')).toBeNull();
    expect(deck.getAttribute('tabindex')).toBeNull();
    expect(discard.getAttribute('role')).toBeNull();
    expect(discard.getAttribute('tabindex')).toBeNull();
  });

  it('renders place targets on drag start and completes deck drag placement', () => {
    session = mountPlayableSession(root, 7);
    const deck = root.querySelector('[data-drag-deck]')!;

    dispatchPointer('pointerdown', deck, { pointerId: 11, clientX: 10, clientY: 10, button: 0 });

    expect(root.querySelectorAll('[data-place]').length).toBeGreaterThan(0);
    const privateDecision = root.querySelector('.zoff-private-decision');
    expect(privateDecision).not.toBeNull();
    expect(root.querySelector('.zoff-game__piles')?.contains(privateDecision!)).toBe(true);
    const preview = root.querySelector('.zoff-drag-preview');
    expect(preview).not.toBeNull();
    expect(root.contains(preview)).toBe(true);

    const placeTarget = root.querySelector('[data-place]') as HTMLElement;
    const elementsFromPoint = vi.spyOn(document, 'elementsFromPoint').mockReturnValue([placeTarget]);

    dispatchPointer('pointermove', window, { pointerId: 11, clientX: 40, clientY: 40, button: 0 });
    expect(placeTarget.classList.contains('zoff-cell--drag-aimed')).toBe(true);
    expect(placeTarget.classList.contains('zoff-cell--drag-target')).toBe(false);

    dispatchPointer('pointerup', window, { pointerId: 11, clientX: 40, clientY: 40, button: 0 });

    expect(root.querySelector('.zoff-private-decision')).toBeNull();
    expect(root.querySelector('.zoff-drag-preview')).toBeNull();
    elementsFromPoint.mockRestore();
  });

  it('keeps pending decision after drag release outside a legal target', () => {
    session = mountPlayableSession(root, 7);
    const deck = root.querySelector('[data-drag-deck]')!;

    dispatchPointer('pointerdown', deck, { pointerId: 12, clientX: 10, clientY: 10, button: 0 });
    dispatchPointer('pointermove', window, { pointerId: 12, clientX: 40, clientY: 40, button: 0 });
    dispatchPointer('pointerup', window, { pointerId: 12, clientX: 0, clientY: 0, button: 0 });

    expect(root.querySelector('.zoff-private-decision')).not.toBeNull();
    expect(root.querySelector('.zoff-drag-preview')).toBeNull();
  });

  it('keeps pending decision after pointer cancel during drag', () => {
    session = mountPlayableSession(root, 7);
    const deck = root.querySelector('[data-drag-deck]')!;

    dispatchPointer('pointerdown', deck, { pointerId: 13, clientX: 10, clientY: 10, button: 0 });
    dispatchPointer('pointermove', window, { pointerId: 13, clientX: 40, clientY: 40, button: 0 });
    dispatchPointer('pointercancel', window, { pointerId: 13, clientX: 40, clientY: 40, button: 0 });

    expect(root.querySelector('.zoff-private-decision')).not.toBeNull();
    expect(root.querySelector('.zoff-drag-preview')).toBeNull();
  });

  it('dispatches reducer commands for draw and place', () => {
    session = new ZoffSession(createContext(7)) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();
    root.querySelector<HTMLButtonElement>('[data-draw]')!.click();
    expect(root.querySelector('.zoff-private-draw')).not.toBeNull();
    const placeTarget = root.querySelector<HTMLButtonElement>('[data-place]');
    expect(placeTarget).not.toBeNull();
    placeTarget!.click();
    expect(root.querySelector('.zoff-private-draw')).toBeNull();
  });

  it('supports discard-reveal mode during inspection', () => {
    session = new ZoffSession(createContext(9)) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();
    root.querySelector<HTMLButtonElement>('[data-draw]')!.click();
    root.querySelector<HTMLButtonElement>('[data-discard-reveal]')!.click();
    expect(root.querySelector('[data-reveal]')).not.toBeNull();
    expect(root.querySelector('[data-place]')).toBeNull();
  });

  it('is idempotent on dispose and ignores advance/pause/resume', () => {
    session = new ZoffSession(createContext()) as ZoffSession;
    session.mount(root);
    session.advance(0);
    session.pause(0);
    session.resume(0);
    session.dispose();
    session.dispose();
    expect(root.childNodes.length).toBe(0);
    expect(root.dataset.theme).toBeUndefined();
  });

  it('requests collection exit from the shell button', () => {
    const context = createContext();
    session = new ZoffSession(context) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-exit-collection]')!.click();
    expect(context.requestExit).toHaveBeenCalled();
  });

  it('focuses the replay button when the match finishes', () => {
    session = new ZoffSession(createContext(30)) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();

    const internal = session as unknown as {
      game: { phase: string; result: { scores: [number, number]; winner: 0 } };
      focusResultReplay: boolean;
      draw(): void;
    };
    internal.game.phase = 'finished';
    internal.game.result = { scores: [2, 4], winner: 0 };
    internal.focusResultReplay = true;
    internal.draw();

    expect(document.activeElement).toBe(root.querySelector('[data-restart]'));
  });

  it('shows eating overlay during a turn toast after chain removal', () => {
    vi.useFakeTimers();
    session = new ZoffSession(createContext(12)) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();

    const internal = session as unknown as {
      game: { activePlayer: 0 | 1 };
      handleEvents(events: GameEvent[], previousActive: 0 | 1): void;
      draw(): void;
    };
    internal.game.activePlayer = 1;
    internal.handleEvents(
      [
        {
          type: 'chainRemoved',
          player: 0,
          row: 0,
          cols: [0, 1, 2],
          species: ['mosquito', 'mouse', 'fox'],
        },
      ],
      0,
    );
    internal.draw();

    expect(root.querySelector('.zoff-turn-toast')).not.toBeNull();
    expect(root.querySelector('[data-eating-overlay]')).not.toBeNull();
    expect(root.querySelector('[data-draw]')).toBeNull();

    vi.advanceTimersByTime(1_200);
    expect(root.querySelector('.zoff-turn-toast')).toBeNull();
    expect(root.querySelector('[data-draw]')).not.toBeNull();
    vi.useRealTimers();
  });

  it('dismisses eating overlay after the presentation timer expires', () => {
    vi.useFakeTimers();
    session = new ZoffSession(createContext(12)) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();

    const internal = session as unknown as {
      handleEvents(events: GameEvent[], previousActive: 0 | 1): void;
      draw(): void;
    };
    internal.handleEvents(
      [
        {
          type: 'chainRemoved',
          player: 0,
          row: 0,
          cols: [0, 1, 2],
          species: ['mosquito', 'mouse', 'fox'],
        },
      ],
      0,
    );
    internal.draw();
    expect(root.querySelector('[data-eating-overlay]')).not.toBeNull();

    vi.advanceTimersByTime(900);
    expect(root.querySelector('[data-eating-overlay]')).toBeNull();
    vi.useRealTimers();
  });

  it('clears eating overlay timer on dispose', () => {
    vi.useFakeTimers();
    session = new ZoffSession(createContext(12)) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();

    const internal = session as unknown as {
      handleEvents(events: GameEvent[], previousActive: 0 | 1): void;
      eatingOverlayTimer: number | null;
    };
    internal.handleEvents(
      [
        {
          type: 'chainRemoved',
          player: 0,
          row: 0,
          cols: [0, 1, 2],
          species: ['mosquito', 'mouse', 'fox'],
        },
      ],
      0,
    );
    expect(internal.eatingOverlayTimer).not.toBeNull();

    session.dispose();
    expect(internal.eatingOverlayTimer).toBeNull();
    vi.useRealTimers();
  });

  it('stores every simultaneous chainRemoved group in overlay state', () => {
    session = new ZoffSession(createContext(12)) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();

    const internal = session as unknown as {
      handleEvents(events: GameEvent[], previousActive: 0 | 1): void;
      ui: { eatingOverlayChains: Array<{ row: number }> };
      draw(): void;
    };
    internal.handleEvents(
      [
        {
          type: 'chainRemoved',
          player: 0,
          row: 0,
          cols: [0, 1, 2],
          species: ['mosquito', 'mouse', 'fox'],
        },
        {
          type: 'chainRemoved',
          player: 1,
          row: 2,
          cols: [1, 2, 3],
          species: ['fish', 'mosquito', 'mouse'],
        },
      ],
      0,
    );
    internal.draw();

    expect(internal.ui.eatingOverlayChains).toHaveLength(2);
    expect(root.querySelectorAll('.zoff-eating-overlay')).toHaveLength(2);
  });
});
