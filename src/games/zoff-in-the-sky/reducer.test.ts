import { describe, expect, it } from 'vitest';
import {
  CARD_VALUES,
  DECK_COMPOSITION,
  PREDATOR_GRAPH,
  SPECIES,
  canEat,
  createDeck,
  totalDeckSize,
} from './cards';
import type { GameState, PlayerId, Species } from './model';
import { GRID_COLS, GRID_ROWS } from './model';
import { countPlayerHidden, createGame, getVisibleDiscard, inspectPendingCard, transition } from './reducer';

function started(seed = 42): GameState {
  return transition(createGame(seed), { type: 'start' }).state;
}

function cellSpecies(state: GameState, player: PlayerId, row: number, col: number): Species | null {
  return state.players[player].grid[row]?.[col]?.card.species ?? null;
}

function setFaceUpRow(
  state: GameState,
  player: PlayerId,
  row: number,
  species: Array<Species | null>,
): void {
  for (let col = 0; col < GRID_COLS; col += 1) {
    const value = species[col] ?? null;
    state.players[player].grid[row]![col] =
      value === null
        ? null
        : {
            card: { instanceId: row * 10 + col, species: value },
            faceUp: true,
          };
  }
}

function takeDiscard(state: GameState, player: PlayerId = state.activePlayer): GameState {
  return transition(state, { type: 'takeDiscard', player }).state;
}

function draw(state: GameState, player: PlayerId = state.activePlayer): GameState {
  return transition(state, { type: 'draw', player }).state;
}

function place(
  state: GameState,
  row: number,
  col: number,
  player: PlayerId = state.activePlayer,
): GameState {
  return transition(state, { type: 'place', player, row, col }).state;
}

function discardDrawn(
  state: GameState,
  revealRow: number,
  revealCol: number,
  player: PlayerId = state.activePlayer,
): GameState {
  return transition(state, {
    type: 'discardDrawn',
    player,
    revealRow,
    revealCol,
  }).state;
}

function firstHidden(state: GameState, player: PlayerId): { row: number; col: number } {
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const cell = state.players[player].grid[row]![col];
      if (cell !== null && !cell.faceUp) return { row, col };
    }
  }
  throw new Error('no hidden card');
}

describe('deck composition and card data', () => {
  it('matches the adopted fifty-nine-card deck without joker', () => {
    expect(totalDeckSize()).toBe(59);
    expect(createDeck()).toHaveLength(59);
    for (const species of SPECIES) {
      expect(
        createDeck().filter((card) => card.species === species),
      ).toHaveLength(DECK_COMPOSITION[species]);
    }
    expect(DECK_COMPOSITION.mosquito).toBe(4);
    expect(SPECIES).not.toContain('joker' as Species);
  });

  it('exposes the adopted value table', () => {
    expect(CARD_VALUES.mosquito).toBe(-1);
    expect(CARD_VALUES.fish).toBe(0);
    expect(CARD_VALUES.mouse).toBe(0);
    expect(CARD_VALUES.whale).toBe(0);
    expect(CARD_VALUES.hedgehog).toBe(1);
    expect(CARD_VALUES.perch).toBe(1);
    expect(CARD_VALUES.fox).toBe(2);
    expect(CARD_VALUES.lion).toBe(2);
    expect(CARD_VALUES.seal).toBe(2);
    expect(CARD_VALUES.crocodile).toBe(3);
    expect(CARD_VALUES['polar-bear']).toBe(3);
    expect(CARD_VALUES.elephant).toBe(4);
  });

  it('implements the full directed predator graph', () => {
    const expected: Array<[Species, Species]> = [
      ['mouse', 'mosquito'],
      ['hedgehog', 'mosquito'],
      ['fish', 'mosquito'],
      ['hedgehog', 'mouse'],
      ['polar-bear', 'mouse'],
      ['seal', 'mouse'],
      ['lion', 'mouse'],
      ['crocodile', 'mouse'],
      ['fox', 'mouse'],
      ['fox', 'hedgehog'],
      ['polar-bear', 'fox'],
      ['crocodile', 'fox'],
      ['lion', 'fox'],
      ['elephant', 'fox'],
      ['perch', 'fish'],
      ['whale', 'fish'],
      ['seal', 'fish'],
      ['crocodile', 'fish'],
      ['polar-bear', 'perch'],
      ['seal', 'perch'],
      ['crocodile', 'perch'],
      ['whale', 'perch'],
      ['elephant', 'crocodile'],
      ['elephant', 'lion'],
      ['polar-bear', 'seal'],
      ['whale', 'seal'],
      ['elephant', 'polar-bear'],
      ['whale', 'polar-bear'],
      ['mouse', 'elephant'],
    ];

    for (const [predator, prey] of expected) {
      expect(canEat(predator, prey)).toBe(true);
    }

    expect(PREDATOR_GRAPH.whale).toEqual([]);
    expect(canEat('whale', 'mosquito')).toBe(false);
    expect(canEat('mosquito', 'mouse')).toBe(false);
    expect(canEat('elephant', 'mosquito')).toBe(false);
  });
});

describe('deterministic setup', () => {
  it('deals fifteen hidden cards per player with one opening discard and twenty-eight draw cards', () => {
    const state = started(7);
    for (const player of [0, 1] as const) {
      let occupied = 0;
      let hidden = 0;
      let revealed = 0;
      for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < GRID_COLS; col += 1) {
          const cell = state.players[player].grid[row]![col];
          expect(cell).not.toBeNull();
          occupied += 1;
          if (cell!.faceUp) revealed += 1;
          else hidden += 1;
        }
      }
      expect(occupied).toBe(15);
      expect(hidden).toBe(13);
      expect(revealed).toBe(2);
    }
    expect(state.drawPile).toHaveLength(28);
    expect(state.discard).toHaveLength(1);
    expect(getVisibleDiscard(state)).not.toBeNull();
  });

  it('keeps all dealt cards hidden until the match starts', () => {
    const state = createGame(7);
    for (const player of [0, 1] as const) {
      for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < GRID_COLS; col += 1) {
          expect(state.players[player].grid[row]![col]!.faceUp).toBe(false);
        }
      }
    }
  });

  it('reproduces the same deal and initial reveals from the same seed', () => {
    const first = started(99);
    const second = started(99);
    expect(first.players).toEqual(second.players);
    expect(first.drawPile).toEqual(second.drawPile);
    expect(first.activePlayer).toBe(second.activePlayer);
  });

  it('emits semantic setup events', () => {
    const setup = createGame(5);
    const { events } = transition(setup, { type: 'start' });
    expect(events[0]).toEqual({ type: 'started', firstPlayer: setup.activePlayer });
    expect(events.filter((event) => event.type === 'initialReveal')).toHaveLength(4);
    expect(events.some((event) => event.type === 'openingDiscard')).toBe(true);
  });

  it('allows the first player to take the opening discard', () => {
    const state = started(8);
    const active = state.activePlayer;
    const openingSpecies = getVisibleDiscard(state)!.species;
    const holding = takeDiscard(state, active);
    expect(holding.phase).toBe('holdingDiscard');
    expect(inspectPendingCard(holding)?.species).toBe(openingSpecies);
    expect(holding.discard).toHaveLength(0);
  });
});

describe('turn branches', () => {
  it('allows taking the visible discard and placing into an occupied cell', () => {
    let state = started(1);
    const active = state.activePlayer;
    const opponent = active === 0 ? 1 : 0;
    setFaceUpRow(state, active, 2, [null, null, null, null, 'lion']);
    state.activePlayer = active;
    state.phase = 'awaitingAction';
    state.drawPile = [{ instanceId: 900, species: 'fox' }];

    state = draw(state, active);
    state = place(state, 2, 4, active);
    expect(state.discard[state.discard.length - 1]!.species).toBe('lion');

    state.activePlayer = active;
    state.phase = 'awaitingAction';
    state = takeDiscard(state, active);
    expect(inspectPendingCard(state)?.species).toBe('lion');
    state = place(state, 2, 4, active);

    expect(cellSpecies(state, active, 2, 4)).toBe('lion');
    expect(state.discard[state.discard.length - 1]!.species).toBe('fox');
    expect(state.activePlayer).toBe(opponent);
  });

  it('allows drawing, inspecting, and placing into an empty gap', () => {
    let state = started(2);
    const active = state.activePlayer;
    setFaceUpRow(state, active, 0, ['mosquito', 'fish', 'mouse', null, null]);
    state.drawPile = [{ instanceId: 501, species: 'lion' }];

    state = draw(state, active);
    expect(inspectPendingCard(state)?.species).toBe('lion');
    state = place(state, 0, 3, active);

    expect(cellSpecies(state, active, 0, 3)).toBe('lion');
    expect(state.discard).toHaveLength(1);
    expect(state.phase).toBe('awaitingAction');
  });

  it('allows drawing, discarding the inspected card, and revealing a hidden card', () => {
    let state = started(3);
    const active = state.activePlayer;
    const reveal = firstHidden(state, active);
    const revealedSpecies = cellSpecies(state, active, reveal.row, reveal.col);
    state.drawPile = [{ instanceId: 777, species: 'seal' }];

    state = draw(state, active);
    state = discardDrawn(state, reveal.row, reveal.col, active);

    expect(state.discard.map((card) => card.species)).toContain('seal');
    expect(cellSpecies(state, active, reveal.row, reveal.col)).toBe(revealedSpecies);
    expect(state.players[active].grid[reveal.row]![reveal.col]!.faceUp).toBe(true);
  });
});

describe('chain resolution', () => {
  it('removes maximal left-to-right predator chains of length at least three', () => {
    let state = started(10);
    const player: PlayerId = 0;
    setFaceUpRow(state, player, 1, ['mosquito', 'mouse', 'fox', 'elephant', null]);
    state.activePlayer = player;
    state.phase = 'awaitingAction';
    state.pendingCard = null;
    state.drawPile = [{ instanceId: 2, species: 'whale' }];
    const resolved = place(transition(state, { type: 'draw', player }).state, 1, 4, player);

    expect(resolved.players[player].grid[1]!.map((cell) => cell?.card.species ?? null)).toEqual([
      null,
      null,
      null,
      null,
      'whale',
    ]);
  });

  it('requires predators to the right of prey and does not remove reversed runs', () => {
    let state = started(11);
    const player: PlayerId = 1;
    setFaceUpRow(state, player, 2, ['fox', 'mouse', 'mosquito', null, null]);
    state.activePlayer = player;
    state.phase = 'awaitingAction';
    state.drawPile = [{ instanceId: 3, species: 'whale' }];
    const next = place(transition(state, { type: 'draw', player }).state, 2, 4, player);

    expect(next.players[player].grid[2]!.map((cell) => cell?.card.species ?? null)).toEqual([
      'fox',
      'mouse',
      'mosquito',
      null,
      'whale',
    ]);
  });

  it('treats gaps as chain interrupters without collapsing columns', () => {
    let state = started(12);
    const player: PlayerId = 0;
    setFaceUpRow(state, player, 0, ['mosquito', null, 'mouse', 'fox', null]);
    state.activePlayer = player;
    state.phase = 'awaitingAction';
    state.drawPile = [{ instanceId: 4, species: 'whale' }];
    const next = place(transition(state, { type: 'draw', player }).state, 0, 4, player);

    expect(next.players[player].grid[0]!.map((cell) => cell?.card.species ?? null)).toEqual([
      'mosquito',
      null,
      'mouse',
      'fox',
      'whale',
    ]);
    expect(next.players[player].grid[0]![1]).toBeNull();
  });

  it('resolves chains on multiple rows deterministically', () => {
    let state = started(13);
    const player: PlayerId = 0;
    setFaceUpRow(state, player, 0, ['mosquito', 'mouse', 'fox', null, null]);
    setFaceUpRow(state, player, 2, ['fish', 'perch', 'whale', 'seal', null]);
    state.activePlayer = player;
    state.phase = 'awaitingAction';
    state.drawPile = [{ instanceId: 5, species: 'hedgehog' }];
    const resolved = place(transition(state, { type: 'draw', player }).state, 2, 4, player);

    expect(resolved.players[player].grid[0]!.map((cell) => cell?.card.species ?? null)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(resolved.players[player].grid[2]!.map((cell) => cell?.card.species ?? null)).toEqual([
      null,
      null,
      null,
      'seal',
      'hedgehog',
    ]);
  });
});

describe('final turn and scoring', () => {
  it('grants the opponent exactly one final turn after the active player reveals their last hidden card', () => {
    let state = started(20);
    const active = state.activePlayer;
    const opponent = active === 0 ? 1 : 0;

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const cell = state.players[active].grid[row]![col];
        if (cell) cell.faceUp = true;
      }
    }
    state.players[active].grid[2]![4]!.faceUp = false;
    expect(countPlayerHidden(state, active)).toBe(1);

    state.drawPile = [{ instanceId: 800, species: 'mouse' }];
    state = draw(state, active);
    const { events, state: afterReveal } = transition(state, {
      type: 'discardDrawn',
      player: active,
      revealRow: 2,
      revealCol: 4,
    });

    expect(events.some((event) => event.type === 'finalTurnBegan')).toBe(true);
    expect(afterReveal.phase).toBe('finalTurn');
    expect(afterReveal.inFinalTurn).toBe(true);
    expect(afterReveal.activePlayer).toBe(opponent);
    expect(countPlayerHidden(afterReveal, active)).toBe(0);
  });

  it('grants the opponent a final turn when placement replaces the last hidden card', () => {
    let state = started(22);
    const active = state.activePlayer;
    const opponent = active === 0 ? 1 : 0;

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const cell = state.players[active].grid[row]![col];
        if (cell) cell.faceUp = true;
      }
    }
    const lastHidden = { row: 2, col: 4 };
    const hiddenSpecies = state.players[active].grid[lastHidden.row]![lastHidden.col]!.card.species;
    state.players[active].grid[lastHidden.row]![lastHidden.col]!.faceUp = false;
    expect(countPlayerHidden(state, active)).toBe(1);

    state.drawPile = [{ instanceId: 801, species: 'fox' }];
    state = draw(state, active);
    const { events, state: afterPlace } = transition(state, {
      type: 'place',
      player: active,
      row: lastHidden.row,
      col: lastHidden.col,
    });

    expect(events.some((event) => event.type === 'finalTurnBegan')).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === 'placed' &&
          event.replaced === hiddenSpecies &&
          event.replacedWasHidden === true,
      ),
    ).toBe(true);
    expect(afterPlace.discard.map((card) => card.species)).toContain(hiddenSpecies);
    expect(afterPlace.phase).toBe('finalTurn');
    expect(afterPlace.inFinalTurn).toBe(true);
    expect(afterPlace.activePlayer).toBe(opponent);
    expect(countPlayerHidden(afterPlace, active)).toBe(0);
    expect(cellSpecies(afterPlace, active, lastHidden.row, lastHidden.col)).toBe('fox');
  });

  it('does not trigger a final turn when placement fills a gap or replaces a face-up card', () => {
    let state = started(23);
    const active = state.activePlayer;
    const opponent = active === 0 ? 1 : 0;

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const cell = state.players[active].grid[row]![col];
        if (cell) cell.faceUp = true;
      }
    }
    state.players[active].grid[1]![2]!.faceUp = false;
    state.players[active].grid[2]![0] = null;
    expect(countPlayerHidden(state, active)).toBe(1);

    state.drawPile = [
      { instanceId: 810, species: 'lion' },
      { instanceId: 811, species: 'seal' },
    ];

    const gapFill = place(transition(state, { type: 'draw', player: active }).state, 2, 0, active);
    expect(gapFill.phase).toBe('awaitingAction');
    expect(gapFill.activePlayer).toBe(opponent);
    expect(countPlayerHidden(gapFill, active)).toBe(1);

    gapFill.activePlayer = active;
    gapFill.phase = 'awaitingAction';
    const faceUpReplace = place(
      transition(gapFill, { type: 'draw', player: active }).state,
      0,
      0,
      active,
    );
    expect(faceUpReplace.phase).toBe('awaitingAction');
    expect(faceUpReplace.inFinalTurn).toBe(false);
    expect(countPlayerHidden(faceUpReplace, active)).toBe(1);
  });

  it('reveals all remaining hidden cards, resolves chains, and scores after the final turn', () => {
    let state = started(21);
    const active: PlayerId = 0;
    state.activePlayer = active;
    state.phase = 'finalTurn';
    state.inFinalTurn = true;

    setFaceUpRow(state, active, 0, ['mosquito', 'mouse', 'fox', null, null]);
    for (let row = 1; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        state.players[active].grid[row]![col] = null;
      }
    }
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        state.players[1].grid[row]![col] = null;
      }
    }
    state.players[1].grid[0]![0] = {
      card: { instanceId: 100, species: 'whale' },
      faceUp: false,
    };
    state.drawPile = [{ instanceId: 101, species: 'hedgehog' }];

    const finished = place(transition(state, { type: 'draw', player: active }).state, 0, 4, active);

    expect(finished.phase).toBe('finished');
    expect(finished.result).not.toBeNull();
    expect(finished.players[1].grid[0]![0]!.faceUp).toBe(true);
    expect(finished.players[0].grid[0]!.map((cell) => cell?.card.species ?? null)).toEqual([
      null,
      null,
      null,
      null,
      'hedgehog',
    ]);
    expect(finished.result!.scores).toEqual([1, 0]);
  });

  it('declares the lower score the winner and allows ties', () => {
    let lowWins = started(30);
    lowWins.phase = 'finalTurn';
    lowWins.inFinalTurn = true;
    lowWins.activePlayer = 0;
    setFaceUpRow(lowWins, 0, 0, ['mosquito', null, null, null, null]);
    setFaceUpRow(lowWins, 1, 0, ['elephant', null, null, null, null]);
    for (const player of [0, 1] as const) {
      for (let row = 1; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < GRID_COLS; col += 1) {
          lowWins.players[player].grid[row]![col] = null;
        }
      }
    }
    lowWins.drawPile = [{ instanceId: 200, species: 'fish' }];
    const finishedLow = place(
      transition(lowWins, { type: 'draw', player: 0 }).state,
      0,
      1,
      0,
    );
    expect(finishedLow.result!.winner).toBe(0);

    let tie = started(31);
    tie.phase = 'finalTurn';
    tie.inFinalTurn = true;
    tie.activePlayer = 0;
    setFaceUpRow(tie, 0, 0, ['fish', null, null, null, null]);
    setFaceUpRow(tie, 1, 0, ['mouse', null, null, null, null]);
    for (const player of [0, 1] as const) {
      for (let row = 1; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < GRID_COLS; col += 1) {
          tie.players[player].grid[row]![col] = null;
        }
      }
    }
    tie.drawPile = [{ instanceId: 201, species: 'whale' }];
    const finishedTie = place(transition(tie, { type: 'draw', player: 0 }).state, 0, 1, 0);
    expect(finishedTie.result!.scores[0]).toBe(finishedTie.result!.scores[1]);
    expect(finishedTie.result!.winner).toBeNull();
  });
});

describe('invalid commands and deck recycle', () => {
  it('rejects wrong player, phase, and target actions without corrupting state', () => {
    const state = started(40);
    const opponent = state.activePlayer === 0 ? 1 : 0;
    const before = structuredClone(state);

    expect(transition(state, { type: 'takeDiscard', player: opponent }).state).toEqual(before);
    expect(transition(state, { type: 'draw', player: opponent }).state).toEqual(before);
    expect(transition(state, { type: 'place', player: state.activePlayer, row: 0, col: 0 }).state).toEqual(
      before,
    );

    let holding = takeDiscard(state);
    const hidden = firstHidden(holding, holding.activePlayer);
    expect(
      transition(holding, {
        type: 'discardDrawn',
        player: holding.activePlayer,
        revealRow: hidden.row,
        revealCol: hidden.col,
      }).state,
    ).toEqual(holding);
    expect(transition(holding, { type: 'place', player: holding.activePlayer, row: 9, col: 9 }).state).toEqual(
      holding,
    );
  });

  it('recycles the discard pile under the visible top card when the draw pile is empty', () => {
    let state = started(41);
    const active = state.activePlayer;
    state.drawPile = [];
    state.discard = [
      { instanceId: 1, species: 'mouse' },
      { instanceId: 2, species: 'fox' },
      { instanceId: 3, species: 'lion' },
    ];
    const visibleTop = state.discard[state.discard.length - 1]!;

    const { events, state: after } = transition(state, { type: 'draw', player: active });

    expect(events.some((event) => event.type === 'deckRecycled')).toBe(true);
    expect(after.discard).toEqual([visibleTop]);
    expect(after.drawPile).toHaveLength(1);
    expect(inspectPendingCard(after)?.species).toBeDefined();
    expect(after.discard[after.discard.length - 1]).toEqual(visibleTop);
  });

  it('rejects drawing when only the visible discard remains', () => {
    let state = started(42);
    state.drawPile = [];
    state.discard = [{ instanceId: 9, species: 'perch' }];
    const before = structuredClone(state);
    expect(transition(state, { type: 'draw', player: state.activePlayer }).state).toEqual(before);
  });
});
