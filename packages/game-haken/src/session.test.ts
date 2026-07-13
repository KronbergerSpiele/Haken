// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EffectService,
  FeedbackService,
  GraphicsService,
  InputService,
  SessionContext,
} from '@spiele/engine/contracts';
import { createHakenSession } from './session';

function fakeContext(): SessionContext {
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
    requestExit: vi.fn(),
  };
}

describe('HakenSession start flow', () => {
  let root: HTMLElement;
  let fullscreenDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="game"></div>';
    root = document.querySelector('#game')!;
    fullscreenDescriptor = Object.getOwnPropertyDescriptor(
      document.documentElement,
      'requestFullscreen',
    );
  });

  afterEach(() => {
    if (fullscreenDescriptor) {
      Object.defineProperty(document.documentElement, 'requestFullscreen', fullscreenDescriptor);
    } else {
      Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts countdown and enters play when fullscreen throws synchronously', () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: () => {
        throw new Error('Fullscreen denied');
      },
    });

    const session = createHakenSession(fakeContext());
    session.mount(root);

    root.querySelector<HTMLButtonElement>('[data-start]')!.click();

    expect(root.querySelector('.countdown')?.textContent).toBe('3');
    expect(root.querySelector('[data-start]')).toBeNull();

    vi.advanceTimersByTime(650);
    expect(root.querySelector('.countdown')?.textContent).toBe('2');
    vi.advanceTimersByTime(650);
    expect(root.querySelector('.countdown')?.textContent).toBe('1');
    vi.advanceTimersByTime(650);
    expect(root.querySelector('.countdown')?.textContent).toBe('HAKEN!');

    vi.advanceTimersByTime(350);
    expect(root.querySelector('[data-pause]')).not.toBeNull();
    expect(root.querySelectorAll('[data-card]')).toHaveLength(8);

    session.dispose();
  });

  it('mounts spiele-collection-exit and requests exit on click', async () => {
    const context = fakeContext();
    const session = createHakenSession(context);
    session.mount(root);

    const exitHost = root.querySelector('spiele-collection-exit');
    expect(exitHost).not.toBeNull();
    await exitHost!.updateComplete;
    expect(root.querySelector('[data-exit-collection]')?.textContent).toContain('SAMMLUNG');

    root.querySelector<HTMLButtonElement>('[data-exit-collection]')!.click();
    expect(context.requestExit).toHaveBeenCalledTimes(1);

    session.dispose();

    const session2 = createHakenSession(context);
    session2.mount(root);
    expect(root.querySelectorAll('spiele-collection-exit')).toHaveLength(1);
    session2.dispose();
  });
});
