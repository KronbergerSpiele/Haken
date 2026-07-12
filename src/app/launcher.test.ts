// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG } from './catalog';
import { renderLauncher } from './launcher';

describe('launcher', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="launcher"></div>';
    root = document.querySelector('#launcher')!;
  });

  it('renders metadata and actions for every registered game', () => {
    renderLauncher(
      root,
      {
        manifests: CATALOG,
        loadStates: {},
        notice: null,
        selectedGameId: null,
      },
      { onPlay: vi.fn(), onShare: vi.fn() },
    );

    expect(root.querySelector('.launcher-grid')?.children.length).toBe(CATALOG.length);
    expect(root.querySelector('[data-play="haken"]')).not.toBeNull();
    expect(root.querySelector('[data-play="zoff-in-the-sky"]')).not.toBeNull();
    expect(root.querySelector('[data-share="haken"]')).not.toBeNull();
    expect(root.textContent).toContain('2 Spieler');
    expect(root.textContent).toContain('Hochformat');
  });

  it('shows loading and failure states on the play button', () => {
    renderLauncher(
      root,
      {
        manifests: CATALOG,
        loadStates: { haken: 'loading' },
        notice: 'Hinweis',
        selectedGameId: 'haken',
      },
      { onPlay: vi.fn(), onShare: vi.fn() },
    );

    expect(root.querySelector('.launcher-notice')?.textContent).toContain('Hinweis');
    expect(root.querySelector('[data-play="haken"]')?.textContent).toContain('LÄDT');
    expect(root.querySelector('[data-play="haken"]')?.hasAttribute('disabled')).toBe(true);
  });

  it('calls play and share handlers from card actions', () => {
    const onPlay = vi.fn();
    const onShare = vi.fn();
    renderLauncher(
      root,
      {
        manifests: CATALOG,
        loadStates: {},
        notice: null,
        selectedGameId: null,
      },
      { onPlay, onShare },
    );

    root.querySelector<HTMLButtonElement>('[data-play="haken"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-share="haken"]')!.click();
    expect(onPlay).toHaveBeenCalledWith('haken');
    expect(onShare).toHaveBeenCalledWith('haken');
  });
});
