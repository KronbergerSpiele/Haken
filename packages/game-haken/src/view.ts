import {
  HAKEN_VIEW_TAG,
  HakenViewElement,
  registerHakenViewElement,
  type UiState,
} from './haken-view-element';
import type { GameState } from './model';

export type { UiState };

export function render(root: HTMLElement, state: GameState, ui: UiState): void {
  registerHakenViewElement();
  let view = root.querySelector<HakenViewElement>(HAKEN_VIEW_TAG);
  if (!view) {
    view = document.createElement(HAKEN_VIEW_TAG) as HakenViewElement;
    root.appendChild(view);
  }
  view.applyView(state, ui);
}

export { HAKEN_VIEW_TAG, registerHakenViewElement };
