import type { GameEvent, GameState } from './model';
import { speciesLabel, type EatingChainGroup } from './graphics';
import { ensureZoffViewHost } from './view-element';
import { formatBoardScore, visibleSubtotal } from './view-helpers';

export interface UiState {
  turnToastActive: boolean;
  perspectivePlayer: import('./model').PlayerId;
  discardRevealMode: boolean;
  statusMessage: string;
  chainFeedback: string | null;
  removedCardCount: number;
  turnFlipActive: boolean;
  eatingOverlayChains: readonly EatingChainGroup[];
}

export const INITIAL_UI: UiState = {
  turnToastActive: false,
  perspectivePlayer: 0,
  discardRevealMode: false,
  statusMessage: '',
  chainFeedback: null,
  removedCardCount: 0,
  turnFlipActive: false,
  eatingOverlayChains: [],
};

export type { EatingChainGroup } from './graphics';
export { formatBoardScore, visibleSubtotal };

export function applyPresentationClasses(root: HTMLElement, state: GameState, ui: UiState): void {
  root.classList.toggle('zoff-root--playing', state.phase !== 'setup');
  root.classList.toggle('zoff-root--turn-toast', ui.turnToastActive);
  root.classList.toggle('zoff-root--turn-flip', ui.turnFlipActive);
  root.classList.toggle('zoff-root--eating-overlay', ui.eatingOverlayChains.length > 0);
}

export function render(root: HTMLElement, state: GameState, ui: UiState): void {
  const host = ensureZoffViewHost(root);
  host.updateView(state, ui);
  applyPresentationClasses(root, state, ui);
}

export function formatChainEvent(event: Extract<GameEvent, { type: 'chainRemoved' }>): string {
  const names = event.species.map((species) => speciesLabel(species)).join(' → ');
  return `Fresskette in Reihe ${event.row + 1}: ${names}`;
}

export function countRemovedCards(events: GameEvent[]): number {
  return events
    .filter((event): event is Extract<GameEvent, { type: 'chainRemoved' }> => event.type === 'chainRemoved')
    .reduce((sum, event) => sum + event.cols.length, 0);
}
