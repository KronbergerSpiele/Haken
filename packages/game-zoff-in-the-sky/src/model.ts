export const GRID_ROWS = 3 as const;
export const GRID_COLS = 5 as const;
export const GRID_SIZE = GRID_ROWS * GRID_COLS;

export type PlayerId = 0 | 1;

export type GamePhase =
  | 'setup'
  | 'awaitingAction'
  | 'holdingDiscard'
  | 'inspectingDraw'
  | 'finalTurn'
  | 'finished';

export type Species =
  | 'whale'
  | 'elephant'
  | 'crocodile'
  | 'polar-bear'
  | 'lion'
  | 'seal'
  | 'fox'
  | 'perch'
  | 'hedgehog'
  | 'fish'
  | 'mouse'
  | 'mosquito';

export interface CardInstance {
  instanceId: number;
  species: Species;
}

export interface GridCell {
  card: CardInstance;
  faceUp: boolean;
}

export type Grid = (GridCell | null)[][];

export interface PlayerBoard {
  grid: Grid;
}

export interface PendingCard {
  card: CardInstance;
  source: 'discard' | 'draw';
}

export interface GameResult {
  scores: [number, number];
  winner: PlayerId | null;
}

export interface GameState {
  phase: GamePhase;
  seed: number;
  rngState: number;
  activePlayer: PlayerId;
  inFinalTurn: boolean;
  players: [PlayerBoard, PlayerBoard];
  drawPile: CardInstance[];
  discard: CardInstance[];
  pendingCard: PendingCard | null;
  result: GameResult | null;
}

export type GameCommand =
  | { type: 'start' }
  | { type: 'takeDiscard'; player: PlayerId }
  | { type: 'draw'; player: PlayerId }
  | { type: 'place'; player: PlayerId; row: number; col: number }
  | {
      type: 'discardDrawn';
      player: PlayerId;
      revealRow: number;
      revealCol: number;
    };

export type GameEvent =
  | { type: 'started'; firstPlayer: PlayerId }
  | { type: 'openingDiscard'; species: Species }
  | { type: 'initialReveal'; player: PlayerId; row: number; col: number; species: Species }
  | { type: 'tookDiscard'; player: PlayerId; species: Species }
  | { type: 'drew'; player: PlayerId; species: Species }
  | { type: 'deckRecycled'; cards: number }
  | {
      type: 'placed';
      player: PlayerId;
      row: number;
      col: number;
      species: Species;
      replaced: Species | null;
      replacedWasHidden: boolean;
    }
  | { type: 'discardedDrawn'; player: PlayerId; species: Species }
  | { type: 'revealed'; player: PlayerId; row: number; col: number; species: Species }
  | {
      type: 'chainRemoved';
      player: PlayerId;
      row: number;
      cols: readonly number[];
      species: readonly Species[];
    }
  | { type: 'finalTurnBegan'; player: PlayerId }
  | { type: 'finalReveal'; player: PlayerId; row: number; col: number; species: Species }
  | { type: 'finished'; result: GameResult };

export interface Transition {
  state: GameState;
  events: GameEvent[];
}
