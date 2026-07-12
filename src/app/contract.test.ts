// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EffectService,
  FeedbackService,
  GameSession,
  GraphicsService,
  InputService,
  SessionContext,
} from '../engine/contracts';
import { CATALOG } from './catalog';

function fakeContext(requestExit: () => void): SessionContext {
  const input: InputService = {
    attach: vi.fn(),
    detach: vi.fn(),
    releaseAllCaptures: vi.fn(),
  };
  const graphics: GraphicsService = {
    createElement: (tag, className) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      return element;
    },
    setText: (element, text) => {
      element.textContent = text;
    },
    applyThemeScope: vi.fn(),
    clearThemeScope: vi.fn(),
  };
  const effects: EffectService = {
    play: vi.fn(() => ({ cancel: vi.fn() })),
    cancelAll: vi.fn(),
  };
  const feedback: FeedbackService = {
    muted: false,
    vibrate: vi.fn(),
    playTone: vi.fn(),
  };

  return {
    seed: 42,
    clock: { now: () => 0 },
    random: { state: 42, nextUint32: () => 1, nextInt: () => 0 },
    input,
    graphics,
    effects,
    feedback,
    announce: vi.fn(),
    requestExit,
  };
}

describe('game contract', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="game"></div>';
    root = document.querySelector('#game')!;
  });

  it.each(CATALOG.map((manifest) => [manifest.id, manifest] as const))(
    '%s satisfies mount, pause, resume, exit, and double dispose',
    async (_id, manifest) => {
      const module = await manifest.load();
      const requestExit = vi.fn();
      const context = fakeContext(requestExit);
      const session: GameSession = module.createSession(context);

      session.mount(root);
      expect(root.childNodes.length).toBeGreaterThan(0);

      session.pause(10);
      session.resume(20);
      session.advance(100);
      session.dispatch({ type: 'exit' });
      expect(requestExit).toHaveBeenCalled();

      session.dispose();
      session.dispose();

      expect(context.input.detach).toHaveBeenCalled();
      expect(context.effects.cancelAll).toHaveBeenCalled();
    },
  );
});
