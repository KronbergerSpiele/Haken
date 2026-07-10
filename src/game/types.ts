export const ZONES = ['kopf', 'bauch', 'beine'] as const;

export type Zone = (typeof ZONES)[number];
export type PlayerId = 0 | 1;
export type CardKind = 'attack' | 'guard' | 'special';
export type SpecialEffect = 'counter' | 'redirect' | 'haste';
export type GamePhase = 'setup' | 'playing' | 'paused' | 'finished';

export interface CardDefinition {
  id: string;
  name: string;
  shortName: string;
  kind: CardKind;
  cost: number;
  copies: number;
  zone: Zone | 'choice' | 'none';
  durationMs: number;
  damage?: number;
  effect?: SpecialEffect;
  description: string;
}

export interface CardInstance {
  instanceId: number;
  definitionId: string;
}

export interface PlayerState {
  health: Record<Zone, number>;
  steam: number;
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
  nextSteamAt: number;
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
  | { type: 'recycle'; now: number; player: PlayerId; slot: number }
  | { type: 'tick'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number };

export interface GameEvent {
  type: 'played' | 'recycled' | 'landed' | 'hit' | 'blocked' | 'special' | 'finished';
  player?: PlayerId;
  zone?: Zone;
  text?: string;
}

export interface Transition {
  state: GameState;
  events: GameEvent[];
}
