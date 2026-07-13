import type { SeededRandom } from './random';

export interface MonotonicClock {
  now(): number;
}

export interface GameCommand {
  type: string;
  [key: string]: unknown;
}

export interface InputService {
  attach(root: HTMLElement): void;
  detach(): void;
  releaseAllCaptures(): void;
}

export interface GraphicsService {
  createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
  ): HTMLElementTagNameMap[K];
  setText(element: HTMLElement, text: string): void;
  applyThemeScope(root: HTMLElement, themeId: string): void;
  clearThemeScope(root: HTMLElement): void;
}

export interface EffectHandle {
  cancel(): void;
}

export type SemanticEffect = 'impact' | 'block' | 'celebrate' | 'warning';

export interface EffectService {
  play(
    kind: SemanticEffect,
    target: HTMLElement | null,
    options?: { text?: string },
  ): EffectHandle;
  cancelAll(): void;
}

export interface FeedbackService {
  vibrate(pattern: number | number[]): void;
  playTone(kind: 'hit' | 'block' | 'finished' | 'neutral'): void;
  get muted(): boolean;
  set muted(value: boolean);
}

export interface SessionContext {
  seed: number;
  clock: MonotonicClock;
  random: SeededRandom;
  input: InputService;
  graphics: GraphicsService;
  effects: EffectService;
  feedback: FeedbackService;
  announce(message: string): void;
  requestExit(): void;
}

export interface GameSession {
  mount(root: HTMLElement): void;
  dispatch(command: GameCommand): void;
  advance(now: number): void;
  pause(at: number): void;
  resume(at: number): void;
  dispose(): void;
}

export interface GameModule {
  createSession(context: SessionContext): GameSession;
}

export interface GameManifest {
  id: string;
  title: string;
  description: string;
  players: { min: number; max: number };
  device: 'shared-screen';
  orientation: 'portrait' | 'landscape' | 'any';
  load(): Promise<GameModule>;
}
