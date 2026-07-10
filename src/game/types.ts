export const ZONES = ['kontext', 'logik', 'output'] as const;

export type Zone = (typeof ZONES)[number];
export type PlayerId = 0 | 1;
export type CardKind = 'attack' | 'guard';
export type GamePhase = 'setup' | 'playing' | 'paused' | 'finished';

export interface CardDefinition {
  id: string;
  name: string;
  shortName: string;
  kind: CardKind;
  cost: number;
  copies: number;
  zone: 'choice';
  durationMs: number;
  damage?: number;
  description: string;
}

export interface CardInstance {
  instanceId: number;
  definitionId: string;
}

export interface PlayerState {
  health: Record<Zone, number>;
  tokens: number;
  drawPile: CardInstance[];
  discard: CardInstance[];
  hand: Array<CardInstance | null>;
  refillAt: Array<number | null>;
}

export interface CenterCard {
  centerId: number;
  card: CardInstance | null;
  definitionId: string;
  owner: PlayerId;
  zone: Zone;
  status: 'traveling' | 'active';
  releasedAt: number;
  landsAt: number;
  expiresAt: number | null;
  generated: boolean;
}

export interface Announcement {
  id: number;
  text: string;
  zone: Zone;
  player: PlayerId;
  expiresAt: number;
}

export interface GameResult {
  winner: PlayerId | null;
  reason: 'knockout' | 'double-knockout';
}

export interface GameState {
  phase: GamePhase;
  seed: number;
  rngState: number;
  time: number;
  pausedAt: number | null;
  nextTokenAt: number;
  players: [PlayerState, PlayerState];
  center: CenterCard[];
  announcements: Announcement[];
  result: GameResult | null;
  nextCenterId: number;
  nextAnnouncementId: number;
}

export type GameCommand =
  | { type: 'start'; now: number }
  | {
      type: 'play';
      now: number;
      player: PlayerId;
      slot: number;
      zone?: Zone;
      travelMs: number;
    }
  | { type: 'tick'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number };

export interface GameEvent {
  type: 'played' | 'landed' | 'hit' | 'blocked' | 'finished';
  player?: PlayerId;
  zone?: Zone;
  text?: string;
}

export interface Transition {
  state: GameState;
  events: GameEvent[];
}
