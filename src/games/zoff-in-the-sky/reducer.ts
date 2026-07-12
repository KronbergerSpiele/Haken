import { canEat, cardValue, createDeck } from './cards';
import {
  GRID_COLS,
  GRID_ROWS,
  type CardInstance,
  type GameCommand,
  type GameEvent,
  type GameState,
  type Grid,
  type GridCell,
  type PlayerId,
  type Species,
  type Transition,
} from './model';

const ACTION_PHASES = new Set(['awaitingAction', 'finalTurn'] as const);
const PLACE_PHASES = new Set(['holdingDiscard', 'inspectingDraw'] as const);

function isActionPhase(phase: GameState['phase']): boolean {
  return ACTION_PHASES.has(phase as 'awaitingAction' | 'finalTurn');
}

function otherPlayer(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}

function randomStep(value: number): number {
  let x = value | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0 || 0x9e3779b9;
}

function shuffle<T>(items: readonly T[], rngState: number): { items: T[]; rngState: number } {
  const result = [...items];
  let rng = rngState;
  for (let index = result.length - 1; index > 0; index -= 1) {
    rng = randomStep(rng);
    const target = rng % (index + 1);
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return { items: result, rngState: rng };
}

function emptyGrid(): Grid {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => null),
  );
}

function isValidCoord(row: number, col: number): boolean {
  return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS;
}

function countHidden(grid: Grid): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null && !cell.faceUp) count += 1;
    }
  }
  return count;
}

function hiddenPositions(grid: Grid): Array<{ row: number; col: number }> {
  const positions: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const cell = grid[row]![col];
      if (cell !== null && !cell.faceUp) positions.push({ row, col });
    }
  }
  return positions;
}

function visibleDiscardTop(state: GameState): CardInstance | null {
  return state.discard.length > 0 ? state.discard[state.discard.length - 1]! : null;
}

export function getVisibleDiscard(state: GameState): CardInstance | null {
  return visibleDiscardTop(state);
}

function pushDiscard(state: GameState, card: CardInstance): void {
  state.discard.push(card);
}

function takeVisibleDiscard(state: GameState): CardInstance | null {
  return state.discard.pop() ?? null;
}

function recycleDrawPile(state: GameState, events: GameEvent[]): boolean {
  if (state.drawPile.length > 0) return true;
  if (state.discard.length <= 1) return false;

  const visibleTop = state.discard.pop()!;
  const toRecycle = state.discard;
  const shuffled = shuffle(toRecycle, state.rngState);
  state.drawPile = shuffled.items;
  state.discard = [visibleTop];
  state.rngState = shuffled.rngState;
  events.push({ type: 'deckRecycled', cards: state.drawPile.length });
  return state.drawPile.length > 0;
}

function drawFromPile(state: GameState, events: GameEvent[]): CardInstance | null {
  if (!recycleDrawPile(state, events)) return null;
  return state.drawPile.pop() ?? null;
}

interface ChainRemoval {
  player: PlayerId;
  row: number;
  cols: number[];
  species: Species[];
}

function findChainRemovals(grid: Grid, player: PlayerId): ChainRemoval[] {
  const removals: ChainRemoval[] = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    let col = 0;
    while (col < GRID_COLS) {
      const startCell = grid[row]![col];
      if (startCell === null || !startCell.faceUp) {
        col += 1;
        continue;
      }

      let end = col;
      while (end + 1 < GRID_COLS) {
        const left = grid[row]![end]!;
        const right = grid[row]![end + 1];
        if (right === null || !right.faceUp) break;
        if (!canEat(right.card.species, left.card.species)) break;
        end += 1;
      }

      const length = end - col + 1;
      if (length >= 3) {
        const cols: number[] = [];
        const species: Species[] = [];
        for (let index = col; index <= end; index += 1) {
          cols.push(index);
          species.push(grid[row]![index]!.card.species);
        }
        removals.push({ player, row, cols, species });
      }
      col = end + 1;
    }
  }
  return removals;
}

function applyChainRemovals(
  state: GameState,
  removals: ChainRemoval[],
  events: GameEvent[],
): void {
  for (const removal of removals) {
    const grid = state.players[removal.player].grid;
    for (const col of removal.cols) {
      grid[removal.row]![col] = null;
    }
    events.push({
      type: 'chainRemoved',
      player: removal.player,
      row: removal.row,
      cols: removal.cols,
      species: removal.species,
    });
  }
}

function resolveChains(state: GameState, events: GameEvent[]): void {
  const removals: ChainRemoval[] = [];
  for (const player of [0, 1] as const) {
    removals.push(...findChainRemovals(state.players[player].grid, player));
  }
  applyChainRemovals(state, removals, events);
}

function placeCard(
  state: GameState,
  player: PlayerId,
  row: number,
  col: number,
  card: CardInstance,
  events: GameEvent[],
): void {
  const grid = state.players[player].grid;
  const existing = grid[row]![col];
  let replaced: Species | null = null;
  let replacedWasHidden = false;
  if (existing !== null) {
    replaced = existing.card.species;
    replacedWasHidden = !existing.faceUp;
    pushDiscard(state, existing.card);
  }
  grid[row]![col] = { card, faceUp: true };
  events.push({
    type: 'placed',
    player,
    row,
    col,
    species: card.species,
    replaced,
    replacedWasHidden,
  });
}

function revealHidden(
  state: GameState,
  player: PlayerId,
  row: number,
  col: number,
  events: GameEvent[],
  eventType: 'revealed' | 'finalReveal',
): boolean {
  const cell = state.players[player].grid[row]![col];
  if (cell === null || cell.faceUp) return false;
  cell.faceUp = true;
  events.push({
    type: eventType,
    player,
    row,
    col,
    species: cell.card.species,
  });
  return true;
}

function scoreBoard(state: GameState): [number, number] {
  const scores: [number, number] = [0, 0];
  for (const player of [0, 1] as const) {
    for (const row of state.players[player].grid) {
      for (const cell of row) {
        if (cell !== null) scores[player] += cardValue(cell.card.species);
      }
    }
  }
  return scores;
}

function finishGame(state: GameState, events: GameEvent[]): void {
  for (const player of [0, 1] as const) {
    const grid = state.players[player].grid;
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const cell = grid[row]![col];
        if (cell !== null && !cell.faceUp) {
          cell.faceUp = true;
          events.push({
            type: 'finalReveal',
            player,
            row,
            col,
            species: cell.card.species,
          });
        }
      }
    }
  }

  resolveChains(state, events);
  const scores = scoreBoard(state);
  const winner: PlayerId | null =
    scores[0] < scores[1] ? 0 : scores[1] < scores[0] ? 1 : null;
  const result = { scores, winner };
  state.result = result;
  state.phase = 'finished';
  state.pendingCard = null;
  events.push({ type: 'finished', result });
}

function endTurn(
  state: GameState,
  actingPlayer: PlayerId,
  triggeredFinalByReveal: boolean,
  events: GameEvent[],
): void {
  state.pendingCard = null;

  if (state.inFinalTurn) {
    finishGame(state, events);
    return;
  }

  if (triggeredFinalByReveal) {
    const opponent = otherPlayer(actingPlayer);
    state.activePlayer = opponent;
    state.inFinalTurn = true;
    state.phase = 'finalTurn';
    events.push({ type: 'finalTurnBegan', player: opponent });
    return;
  }

  state.activePlayer = otherPlayer(actingPlayer);
  state.phase = 'awaitingAction';
}

function afterBoardChange(
  state: GameState,
  actingPlayer: PlayerId,
  triggeredFinalByReveal: boolean,
  events: GameEvent[],
): void {
  resolveChains(state, events);
  endTurn(state, actingPlayer, triggeredFinalByReveal, events);
}

function dealOpeningDiscard(state: GameState, events: GameEvent[]): void {
  const card = state.drawPile.pop();
  if (!card) return;
  pushDiscard(state, card);
  events.push({ type: 'openingDiscard', species: card.species });
}

function dealInitialReveals(
  state: GameState,
  events: GameEvent[],
): void {
  for (const player of [0, 1] as const) {
    const positions = hiddenPositions(state.players[player].grid);
    const firstPick = shuffle(positions, state.rngState);
    state.rngState = firstPick.rngState;
    const secondPool = firstPick.items.slice(1);
    const secondPick = shuffle(secondPool, state.rngState);
    state.rngState = secondPick.rngState;
    const picks = [firstPick.items[0]!, secondPick.items[0]!];
    for (const { row, col } of picks) {
      const cell = state.players[player].grid[row]![col]!;
      cell.faceUp = true;
      events.push({
        type: 'initialReveal',
        player,
        row,
        col,
        species: cell.card.species,
      });
    }
  }
}

export function createGame(seed: number): GameState {
  const normalizedSeed = seed >>> 0 || 1;
  const shuffled = shuffle(createDeck(), normalizedSeed);
  const deck = shuffled.items;
  const playerCards: [CardInstance[], CardInstance[]] = [
    deck.slice(0, 15),
    deck.slice(15, 30),
  ];
  const drawPile = deck.slice(30);
  const state: GameState = {
    phase: 'setup',
    seed: normalizedSeed,
    rngState: shuffled.rngState,
    activePlayer: normalizedSeed % 2 === 0 ? 0 : 1,
    inFinalTurn: false,
    players: [
      { grid: emptyGrid() },
      { grid: emptyGrid() },
    ],
    drawPile,
    discard: [],
    pendingCard: null,
    result: null,
  };

  for (const player of [0, 1] as const) {
    let index = 0;
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        state.players[player].grid[row]![col] = {
          card: playerCards[player][index]!,
          faceUp: false,
        };
        index += 1;
      }
    }
  }

  return state;
}

function reject(state: GameState): Transition {
  return { state: structuredClone(state), events: [] };
}

function accept(state: GameState, events: GameEvent[]): Transition {
  return { state, events };
}

function handlePlace(
  state: GameState,
  command: Extract<GameCommand, { type: 'place' }>,
  events: GameEvent[],
): Transition | null {
  if (!PLACE_PHASES.has(state.phase as 'holdingDiscard' | 'inspectingDraw')) return null;
  if (command.player !== state.activePlayer) return null;
  if (!state.pendingCard) return null;
  if (!isValidCoord(command.row, command.col)) return null;

  const actingPlayer = command.player;
  const hiddenBefore = countHidden(state.players[actingPlayer].grid);
  const { card } = state.pendingCard;
  placeCard(state, actingPlayer, command.row, command.col, card, events);
  const hiddenAfter = countHidden(state.players[actingPlayer].grid);
  const triggeredFinal = hiddenBefore > 0 && hiddenAfter === 0;
  afterBoardChange(state, actingPlayer, triggeredFinal, events);
  return accept(state, events);
}

function handleDiscardDrawn(
  state: GameState,
  command: Extract<GameCommand, { type: 'discardDrawn' }>,
  events: GameEvent[],
): Transition | null {
  if (state.phase !== 'inspectingDraw') return null;
  if (command.player !== state.activePlayer) return null;
  if (!state.pendingCard || state.pendingCard.source !== 'draw') return null;
  if (!isValidCoord(command.revealRow, command.revealCol)) return null;

  const actingPlayer = command.player;
  const cell = state.players[actingPlayer].grid[command.revealRow]![command.revealCol];
  if (cell === null || cell.faceUp) return null;

  const hiddenBefore = countHidden(state.players[actingPlayer].grid);
  const { card } = state.pendingCard;
  pushDiscard(state, card);
  events.push({ type: 'discardedDrawn', player: actingPlayer, species: card.species });

  if (!revealHidden(state, actingPlayer, command.revealRow, command.revealCol, events, 'revealed')) {
    return null;
  }

  const hiddenAfter = countHidden(state.players[actingPlayer].grid);
  const triggeredFinal = hiddenBefore > 0 && hiddenAfter === 0;
  afterBoardChange(state, actingPlayer, triggeredFinal, events);
  return accept(state, events);
}

export function transition(current: GameState, command: GameCommand): Transition {
  if (command.type === 'start') {
    if (current.phase !== 'setup') return reject(current);
    const state = structuredClone(current);
    const events: GameEvent[] = [{ type: 'started', firstPlayer: state.activePlayer }];
    dealInitialReveals(state, events);
    dealOpeningDiscard(state, events);
    state.phase = 'awaitingAction';
    return accept(state, events);
  }

  if (current.phase === 'finished') return reject(current);

  const state = structuredClone(current);
  const events: GameEvent[] = [];

  if (command.type === 'takeDiscard') {
    if (!isActionPhase(state.phase)) return reject(current);
    if (command.player !== state.activePlayer) return reject(current);
    if (state.pendingCard) return reject(current);
    const top = takeVisibleDiscard(state);
    if (!top) return reject(current);
    state.pendingCard = { card: top, source: 'discard' };
    state.phase = 'holdingDiscard';
    events.push({ type: 'tookDiscard', player: command.player, species: top.species });
    return accept(state, events);
  }

  if (command.type === 'draw') {
    if (!isActionPhase(state.phase)) return reject(current);
    if (command.player !== state.activePlayer) return reject(current);
    if (state.pendingCard) return reject(current);
    const drawn = drawFromPile(state, events);
    if (!drawn) return reject(current);
    state.pendingCard = { card: drawn, source: 'draw' };
    state.phase = 'inspectingDraw';
    events.push({ type: 'drew', player: command.player, species: drawn.species });
    return accept(state, events);
  }

  if (command.type === 'place') {
    const result = handlePlace(state, command, events);
    return result ?? reject(current);
  }

  if (command.type === 'discardDrawn') {
    const result = handleDiscardDrawn(state, command, events);
    return result ?? reject(current);
  }

  return reject(current);
}

export function getCell(
  state: GameState,
  player: PlayerId,
  row: number,
  col: number,
): GridCell | null {
  if (!isValidCoord(row, col)) return null;
  return state.players[player].grid[row]![col];
}

export function countPlayerHidden(state: GameState, player: PlayerId): number {
  return countHidden(state.players[player].grid);
}

export function inspectPendingCard(state: GameState): CardInstance | null {
  return state.pendingCard?.card ?? null;
}

export { canEat, cardValue } from './cards';
