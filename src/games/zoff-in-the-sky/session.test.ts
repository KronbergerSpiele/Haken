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

  it('requires handoff confirmation before showing actions', () => {
    session = new ZoffSession(createContext()) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();
    expect(root.querySelector('.zoff-handoff')).not.toBeNull();
    expect(root.querySelector('[data-draw]')).toBeNull();
    root.querySelector<HTMLButtonElement>('[data-confirm-handoff]')!.click();
    expect(root.querySelector('[data-draw]')).not.toBeNull();
  });

  it('dispatches reducer commands for draw and place', () => {
    session = new ZoffSession(createContext(7)) as ZoffSession;
    session.mount(root);
    root.querySelector<HTMLButtonElement>('[data-start]')!.click();
    root.querySelector<HTMLButtonElement>('[data-confirm-handoff]')!.click();
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
    root.querySelector<HTMLButtonElement>('[data-confirm-handoff]')!.click();
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
    root.querySelector<HTMLButtonElement>('[data-confirm-handoff]')!.click();

    const internal = session as unknown as {
      game: { phase: string; result: { scores: [number, number]; winner: 0 } };
      ui: { handoffConfirmed: boolean };
      focusResultReplay: boolean;
      draw(): void;
    };
    internal.game.phase = 'finished';
    internal.game.result = { scores: [2, 4], winner: 0 };
    internal.ui.handoffConfirmed = true;
    internal.focusResultReplay = true;
    internal.draw();

    expect(document.activeElement).toBe(root.querySelector('[data-restart]'));
  });
});
