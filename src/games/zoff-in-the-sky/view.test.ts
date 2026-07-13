// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { canEat } from './cards';
import { createGame, transition } from './reducer';
import { INITIAL_UI, eatingOverlaysMarkup, formatBoardScore, render, visibleSubtotal } from './view';
import {
  eatingChainsOverlayMarkup,
  eatingIndicatorsMarkup,
  findAdjacentEatLinks,
  preyOf,
  predatorsOf,
  speciesLabel,
} from './graphics';

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

  it('renders eating indicators as sprite icons without abbreviation text', () => {
    const markup = eatingIndicatorsMarkup('fox');
    expect(markup).toContain('zoff-eat-icon');
    expect(markup).not.toContain('>Fu<');
    expect(markup).not.toContain('zoff-eat-glyph');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('zoff-eat-icon__art');
  });

  it('renders multiple simultaneous chain groups with row labels', () => {
    const markup = eatingChainsOverlayMarkup([
      { player: 0, row: 0, species: ['mosquito', 'mouse', 'fox'] },
      { player: 1, row: 2, species: ['fish', 'mosquito', 'mouse', 'hedgehog'] },
    ]);
    expect((markup.match(/<section class="zoff-eating-overlay"/g) ?? []).length).toBe(2);
    expect(markup).toContain('Reihe 1');
    expect(markup).toContain('Reihe 3');
    expect(markup).toContain('Mücke → Maus → Fuchs');
  });
});

describe('zoff visible score helpers', () => {
  it('sums only face-up occupied card values', () => {
    const game = transition(createGame(22), { type: 'start' }).state;
    const grid = game.players[0].grid;
    const total = visibleSubtotal(grid);
    expect(typeof total).toBe('number');
    expect(formatBoardScore(game, 0)).toMatch(/Sichtbar -?\d+ · \d+ verdeckt/);
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
    render(root, game, { ...INITIAL_UI, turnFlipActive: true });
    expect(root.querySelector('.zoff-handoff')).not.toBeNull();
    expect(root.classList.contains('zoff-root--turn-flip')).toBe(true);
    expect(root.classList.contains('zoff-root--handoff')).toBe(true);
    expect(root.querySelector('.zoff-game')).toBeNull();
    expect(root.textContent).toContain('Spieler');
    expect(root.querySelector('[data-confirm-handoff]')).not.toBeNull();
  });

  it('shows visible subtotals and hidden counts in board headers', () => {
    const game = transition(createGame(12), { type: 'start' }).state;
    render(root, game, { ...INITIAL_UI, handoffConfirmed: true });
    const scores = [...root.querySelectorAll('.zoff-board__score')];
    expect(scores).toHaveLength(2);
    expect(scores.every((score) => /Sichtbar -?\d+ · \d+ verdeckt/.test(score.textContent ?? ''))).toBe(
      true,
    );
  });

  it('renders an eating overlay at the session root during play', () => {
    const game = transition(createGame(12), { type: 'start' }).state;
    render(root, game, {
      ...INITIAL_UI,
      handoffConfirmed: true,
      eatingOverlayChains: [{ player: 0, row: 0, species: ['mosquito', 'mouse', 'fox'] }],
      chainFeedback: 'Fresskette in Reihe 1: Mücke → Maus → Fuchs',
    });
    const shell = root.querySelector('[data-eating-overlay]');
    expect(shell).not.toBeNull();
    expect(root.querySelector('.zoff-game .zoff-eating-overlays')).toBeNull();
    const overlay = root.querySelector('.zoff-eating-overlay');
    expect(overlay?.getAttribute('aria-live')).toBe('polite');
    expect(overlay?.querySelectorAll('.zoff-eat-icon').length).toBeGreaterThanOrEqual(3);
    expect(overlay?.textContent).toContain('Fresskette!');
  });

  it('renders eating overlay on handoff after a chain event', () => {
    const game = transition(createGame(12), { type: 'start' }).state;
    render(root, game, {
      ...INITIAL_UI,
      handoffConfirmed: false,
      eatingOverlayChains: [{ player: 0, row: 1, species: ['mosquito', 'mouse', 'fox'] }],
    });
    expect(root.querySelector('.zoff-handoff')).not.toBeNull();
    expect(root.querySelector('[data-eating-overlay]')).not.toBeNull();
    expect(root.classList.contains('zoff-root--eating-overlay')).toBe(true);
  });

  it('places final eating overlay above the result layer', () => {
    const game = transition(createGame(18), { type: 'start' }).state;
    game.phase = 'finished';
    game.result = { scores: [3, 5], winner: 0 };
    render(root, game, {
      ...INITIAL_UI,
      handoffConfirmed: true,
      eatingOverlayChains: [{ player: 0, row: 0, species: ['mosquito', 'mouse', 'fox'] }],
    });
    const shell = root.querySelector('.zoff-eating-overlays--above-result');
    expect(shell).not.toBeNull();
    expect(eatingOverlaysMarkup(game, {
      ...INITIAL_UI,
      eatingOverlayChains: [{ player: 0, row: 0, species: ['mosquito', 'mouse', 'fox'] }],
    })).toContain('zoff-eating-overlays--above-result');
    expect(root.querySelector('.zoff-result')).not.toBeNull();
  });

  it('keeps a stable four-track play grid without a separate decision row', () => {
    const game = transition(createGame(12), { type: 'start' }).state;
    render(root, game, { ...INITIAL_UI, handoffConfirmed: true });
    expect(root.querySelector('.zoff-game__opponent .zoff-board--compact')).not.toBeNull();
    expect(root.querySelector('.zoff-game__piles')).not.toBeNull();
    expect(root.querySelector('.zoff-pile-edge-gutter')).not.toBeNull();
    expect(root.querySelector('.zoff-game__decision')).toBeNull();
    expect(root.querySelector('.zoff-game__active .zoff-board--active')).not.toBeNull();
    expect(root.querySelector('.zoff-game__status .zoff-status')).not.toBeNull();
  });

  it('orders discard before deck in the pile strip', () => {
    const game = transition(createGame(12), { type: 'start' }).state;
    render(root, game, { ...INITIAL_UI, handoffConfirmed: true });
    const discard = root.querySelector('.zoff-pile--discard')!;
    const deck = root.querySelector('.zoff-pile--deck')!;
    expect(
      discard.compareDocumentPosition(deck) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    const piles = root.querySelector('.zoff-game__piles')!;
    const privateDecision = piles.querySelector('.zoff-private-decision');
    expect(privateDecision).not.toBeNull();
    expect(privateDecision?.querySelector('.zoff-private-draw')).not.toBeNull();
    expect(privateDecision?.querySelector('[data-discard-reveal]')).not.toBeNull();
    expect(root.querySelector('.zoff-piles--inspecting')).not.toBeNull();
    expect(root.querySelector('.zoff-game--inspecting')).not.toBeNull();
    expect(root.querySelector('.zoff-game__decision')).toBeNull();
    expect(root.querySelector('.zoff-board--current-turn')).not.toBeNull();
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

  it('marks gaps and face-up cards with eating indicator icons', () => {
    const game = transition(createGame(16), { type: 'start' }).state;
    render(root, game, { ...INITIAL_UI, handoffConfirmed: true });
    expect(root.querySelector('.zoff-cell--gap, .zoff-cell--hidden, .zoff-cell--face-up')).not.toBeNull();
    expect(root.querySelector('.zoff-eat-icon, .zoff-card-back')).not.toBeNull();
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
