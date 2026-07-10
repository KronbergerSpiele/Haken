// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, transition } from '../game/engine';
import type { UiState } from './render';
import { render } from './render';

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

  it('announces the final result and offers a rematch', () => {
    const game = transition(createGame(10), { type: 'start', now: 0 }).state;
    game.phase = 'finished';
    game.result = { winner: null, reason: 'double-knockout' };
    render(root, game, ui);

    expect(root.querySelector('[role="dialog"]')?.textContent).toContain('DOPPEL-K.O.');
    expect(root.querySelectorAll('.result-bots .fighter-avatar')).toHaveLength(2);
    expect(root.querySelector('[data-restart]')).not.toBeNull();
  });
});
