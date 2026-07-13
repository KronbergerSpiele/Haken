// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, transition } from './reducer';
import type { UiState } from './view';
import { render } from './view';

const ui: UiState = {
  countdown: null,
  selectedSlots: [null, null],
  selectedZones: ['logik', 'logik'],
  muted: false,
};

describe('mobile game rendering', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
  });

  it('shows concise onboarding before the game starts', () => {
    render(root, createGame(10), ui);
    expect(root.querySelector('h1')?.textContent).toBe('HAKEN!');
    expect(root.querySelectorAll('.how-to li')).toHaveLength(3);
    expect(root.querySelectorAll('.splash-bots .fighter-avatar')).toHaveLength(2);
    expect(root.querySelectorAll('.splash-bots .fighter-avatar--ready')).toHaveLength(2);
    expect(root.querySelector('[data-start]')).not.toBeNull();
  });

  it('renders two independent four-card areas and three lanes', () => {
    const game = transition(createGame(10), { type: 'start', now: 0 }).state;
    render(root, game, ui);

    expect(root.querySelectorAll('.fighter')).toHaveLength(2);
    expect(root.querySelectorAll('[data-card][data-player="0"]')).toHaveLength(4);
    expect(root.querySelectorAll('[data-card][data-player="1"]')).toHaveLength(4);
    expect(root.querySelectorAll('[data-card] .card-graphic')).toHaveLength(8);
    expect(root.querySelectorAll('.fighter-identity .fighter-avatar')).toHaveLength(2);
    expect(root.querySelectorAll('.zone-doodle')).toHaveLength(3);
    expect(root.querySelectorAll('[data-lane]')).toHaveLength(3);
    expect(root.querySelector('[data-pause]')).not.toBeNull();
  });

  it('turns combat announcements into comic impact graphics', () => {
    const game = transition(createGame(10), { type: 'start', now: 0 }).state;
    game.announcements = [
      { id: 1, text: 'GEBLOCKT', zone: 'logik', player: 0, expiresAt: 1_000 },
    ];
    render(root, game, ui);

    expect(root.querySelector('.announcement')?.textContent).toContain('GEBLOCKT');
    expect(root.querySelector('.announcement .impact-graphic')).not.toBeNull();
    expect(root.querySelector('.fighter--0 .fighter-avatar--block')).not.toBeNull();
    expect(root.querySelector('.fighter--1 .fighter-avatar--bonk')).not.toBeNull();
  });

  it('makes both avatars react when an attack hits', () => {
    const game = transition(createGame(10), { type: 'start', now: 0 }).state;
    game.announcements = [
      { id: 1, text: 'TREFFER', zone: 'kontext', player: 1, expiresAt: 1_100 },
    ];
    render(root, game, ui);

    expect(root.querySelector('.fighter--0 .fighter-avatar--hit')).not.toBeNull();
    expect(root.querySelector('.fighter--1 .fighter-avatar--action')).not.toBeNull();
  });

  it('exposes lane and play controls for a selected choice card', () => {
    const game = transition(createGame(10), { type: 'start', now: 0 }).state;
    game.players[0].hand[0] = { instanceId: 50_000, definitionId: 'bundes-guardrail' };
    const selectedUi: UiState = {
      ...ui,
      selectedSlots: [0, null],
    };
    render(root, game, selectedUi);

    expect(root.querySelectorAll('[data-choose-zone][data-player="0"]')).toHaveLength(3);
    expect(root.querySelector('[data-play-selected="0"]')?.textContent).toContain('SPIELEN');
  });

  it('shows a fixed card target without offering other lanes', () => {
    const game = transition(createGame(10), { type: 'start', now: 0 }).state;
    game.players[0].hand[0] = { instanceId: 50_001, definitionId: 'kontext-kollaps' };
    const selectedUi: UiState = {
      ...ui,
      selectedSlots: [0, null],
    };
    render(root, game, selectedUi);

    expect(root.querySelector('.fighter--0 [data-slot="0"] .card-zone')?.textContent).toBe('▣');
    expect(root.querySelector('.fighter--0 [data-slot="0"] .card-cost')?.textContent).toBe('2⚡');
    expect(root.querySelectorAll('[data-choose-zone][data-player="0"]')).toHaveLength(0);
    expect(root.querySelector('.fighter--0 .fallback-target')?.textContent).toContain('Kontext');
  });

  it('announces the final result and offers a rematch', () => {
    const game = transition(createGame(10), { type: 'start', now: 0 }).state;
    game.phase = 'finished';
    game.result = { winner: null, reason: 'double-knockout' };
    render(root, game, ui);

    expect(root.querySelector('[role="dialog"]')?.textContent).toContain('DOPPEL-K.O.');
    expect(root.querySelectorAll('.result-bots .fighter-avatar')).toHaveLength(2);
    expect(root.querySelectorAll('.result-bots .fighter-avatar--bonk')).toHaveLength(2);
    expect(root.querySelector('[data-restart]')).not.toBeNull();
  });

  it('reuses the spiele-haken-view host across redraws', () => {
    render(root, createGame(10), ui);
    const view = root.querySelector('spiele-haken-view');
    render(root, createGame(10), ui);
    expect(root.querySelector('spiele-haken-view')).toBe(view);
    expect(root.querySelectorAll('spiele-haken-view')).toHaveLength(1);
  });

  it('updates splash incrementally through the countdown without replacing the host', () => {
    const game = createGame(10);
    render(root, game, ui);
    const view = root.querySelector('spiele-haken-view')!;
    expect(root.querySelector('[data-start]')).not.toBeNull();

    render(root, game, { ...ui, countdown: 3 });
    expect(root.querySelector('spiele-haken-view')).toBe(view);
    expect(root.querySelector('[data-start]')).toBeNull();
    expect(root.querySelector('.countdown')?.textContent).toBe('3');

    render(root, game, { ...ui, countdown: 0 });
    expect(root.querySelector('spiele-haken-view')).toBe(view);
    expect(root.querySelector('.countdown')?.textContent).toBe('HAKEN!');
  });
});
