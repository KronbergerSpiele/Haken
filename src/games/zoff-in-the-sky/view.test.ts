// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { canEat } from './cards';
import { createGame, transition } from './reducer';
import { INITIAL_UI, render } from './view';
import { findAdjacentEatLinks, preyOf, predatorsOf, speciesLabel } from './graphics';

describe('zoff graphics helpers', () => {
  it('maps species to German labels and sprite order', () => {
    expect(speciesLabel('whale')).toBe('Wal');
    expect(speciesLabel('mosquito')).toBe('Mücke');
  });

  it('derives prey and predators from the shared graph', () => {
    expect(preyOf('fox')).toContain('hedgehog');
    expect(predatorsOf('mosquito')).toEqual(
      expect.arrayContaining(['mouse', 'hedgehog', 'fish']),
    );
    expect(canEat('mouse', 'mosquito')).toBe(true);
  });

  it('flags chains of three or more adjacent eats', () => {
    const links = findAdjacentEatLinks(['mosquito', 'mouse', 'fox', null, null]);
    expect(links.some((link) => link.chainLength >= 3)).toBe(true);
  });
});

describe('zoff view rendering', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app" data-theme="zoff-in-the-sky"></div>';
    root = document.querySelector('#app')!;
  });

  it('shows onboarding before the match starts', () => {
    render(root, createGame(12), INITIAL_UI);
    expect(root.querySelector('h1')?.textContent).toBe('Zoff in the Sky');
    expect(root.querySelectorAll('.zoff-how-to li')).toHaveLength(3);
    expect(root.querySelector('[data-start]')).not.toBeNull();
  });

  it('shows a pass-device handoff before revealing the board', () => {
    const game = transition(createGame(12), { type: 'start' }).state;
    render(root, game, INITIAL_UI);
    expect(root.querySelector('.zoff-handoff')).not.toBeNull();
    expect(root.querySelector('.zoff-game')).toBeNull();
    expect(root.textContent).toContain('Spieler');
    expect(root.querySelector('[data-confirm-handoff]')).not.toBeNull();
  });

  it('renders active and compact boards with public piles after handoff', () => {
    const game = transition(createGame(12), { type: 'start' }).state;
    render(root, game, { ...INITIAL_UI, handoffConfirmed: true });
    expect(root.querySelectorAll('.zoff-board')).toHaveLength(2);
    expect(root.querySelector('.zoff-board--active')).not.toBeNull();
    expect(root.querySelector('.zoff-board--compact')).not.toBeNull();
    expect(root.querySelector('[data-draw]')).not.toBeNull();
    expect(root.querySelector('.zoff-pile--deck')).not.toBeNull();
    expect(root.querySelector('.zoff-status')).not.toBeNull();
  });

  it('shows the private draw only to the active player during inspection', () => {
    let game = transition(createGame(15), { type: 'start' }).state;
    game = transition(game, { type: 'draw', player: game.activePlayer }).state;
    render(root, game, { ...INITIAL_UI, handoffConfirmed: true });
    expect(root.querySelector('.zoff-private-decision')).not.toBeNull();
    expect(root.querySelector('.zoff-private-decision .zoff-private-draw')).not.toBeNull();
    expect(root.querySelector('.zoff-private-decision [data-discard-reveal]')).not.toBeNull();
  });

  it('does not mark stock-unsafe gaps as placeable while occupied targets remain selectable', () => {
    let game = transition(createGame(43), { type: 'start' }).state;
    const active = game.activePlayer;
    for (let col = 0; col < 5; col += 1) {
      game.players[active].grid[0]![col] =
        col === 0
          ? { card: { instanceId: col, species: 'lion' }, faceUp: true }
          : null;
    }
    game.drawPile = [];
    game.discard = [{ instanceId: 50, species: 'fox' }];
    game = transition(game, { type: 'takeDiscard', player: active }).state;

    render(root, game, { ...INITIAL_UI, handoffConfirmed: true });

    const placeButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-place]')];
    expect(placeButtons.some((button) => button.dataset.row === '0' && button.dataset.col === '1')).toBe(
      false,
    );
    expect(placeButtons.some((button) => button.dataset.row === '0' && button.dataset.col === '0')).toBe(
      true,
    );
    expect(root.querySelector('.zoff-cell--gap.zoff-cell--placeable')).toBeNull();
  });

  it('marks gaps and face-up cards with eating indicators', () => {
    const game = transition(createGame(16), { type: 'start' }).state;
    render(root, game, { ...INITIAL_UI, handoffConfirmed: true });
    expect(root.querySelector('.zoff-cell--gap, .zoff-cell--hidden, .zoff-cell--face-up')).not.toBeNull();
    expect(root.querySelector('.zoff-eat-indicators, .zoff-card-back')).not.toBeNull();
    expect(
      [...root.querySelectorAll<HTMLElement>('.zoff-cell--face-up')].some((cell) =>
        cell.getAttribute('aria-label')?.includes('Frisst:'),
      ),
    ).toBe(true);
  });

  it('announces finished results with replay', () => {
    const game = transition(createGame(18), { type: 'start' }).state;
    game.phase = 'finished';
    game.result = { scores: [3, 5], winner: 0 };
    render(root, game, {
      ...INITIAL_UI,
      handoffConfirmed: true,
      removedCardCount: 4,
      chainFeedback: 'Fresskette in Reihe 2: Mücke → Maus → Fuchs',
    });
    expect(root.querySelector('.zoff-result')).not.toBeNull();
    expect(root.querySelector('.zoff-result')?.getAttribute('aria-modal')).toBeNull();
    expect(root.querySelector('#zoff-result-heading')).not.toBeNull();
    expect(root.textContent).toContain('Spieler 1 gewinnt');
    expect(root.textContent).toContain('4 Karten durch Fressketten entfernt');
    expect(root.querySelector('[data-restart]')).not.toBeNull();
  });
});
