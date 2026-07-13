// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionHost } from './session-host';

describe('session host smoke', () => {
  let root: HTMLElement;
  let host: SessionHost | null = null;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    history.replaceState(null, '', '/');
  });

  afterEach(() => {
    host?.dispose();
    host = null;
  });

  it('launches Haken, returns to the launcher, and launches again without duplicate roots', async () => {
    host = new SessionHost(root);
    host.start();

    await vi.waitFor(() => {
      expect(root.querySelector('.launcher-grid')).not.toBeNull();
    });

    root.querySelector<HTMLButtonElement>('[data-play="haken"]')!.click();

    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('#game-root')?.hidden).toBe(false);
      expect(root.querySelector('.splash, .game')).not.toBeNull();
    });

    root.querySelector<HTMLButtonElement>('[data-exit-collection]')!.click();

    await vi.waitFor(() => {
      expect(root.querySelector('.launcher-grid')).not.toBeNull();
      expect(root.querySelector<HTMLElement>('#game-root')?.hidden).toBe(true);
    });

    root.querySelector<HTMLButtonElement>('[data-play="haken"]')!.click();

    await vi.waitFor(() => {
      expect(root.querySelector('.splash, .game')).not.toBeNull();
    });

    expect(root.querySelectorAll('#game-root').length).toBe(1);
    expect(root.querySelectorAll('#launcher-root').length).toBe(1);
  });

  it('launches Zoff in the Sky and exits back to the launcher', async () => {
    host = new SessionHost(root);
    host.start();

    await vi.waitFor(() => {
      expect(root.querySelector('[data-play="zoff-in-the-sky"]')).not.toBeNull();
    });

    root.querySelector<HTMLButtonElement>('[data-play="zoff-in-the-sky"]')!.click();

    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('#game-root')?.hidden).toBe(false);
      expect(root.querySelector('[data-theme="zoff-in-the-sky"]')).not.toBeNull();
      expect(root.querySelector('[data-start]')).not.toBeNull();
    });

    root.querySelector<HTMLButtonElement>('[data-exit-collection]')!.click();

    await vi.waitFor(() => {
      expect(root.querySelector('.launcher-grid')).not.toBeNull();
      expect(root.querySelector<HTMLElement>('#game-root')?.hidden).toBe(true);
    });
  });
});
