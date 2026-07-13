import { render as litRender } from 'lit';
import type { GameState } from './model';
import type { UiState } from './view';
import { zoffViewTemplate } from './view-templates';

export const SPIELE_ZOFF_VIEW_TAG = 'spiele-zoff-view';

export class SpieleZoffView extends HTMLElement {
  connectedCallback(): void {
    this.style.display = 'contents';
  }

  /** Synchronously commits the Lit template into the light DOM. */
  updateView(state: GameState, ui: UiState): void {
    litRender(zoffViewTemplate(state, ui), this);
  }
}

let registered = false;

export function registerZoffViewElement(): void {
  if (registered || customElements.get(SPIELE_ZOFF_VIEW_TAG)) {
    registered = true;
    return;
  }
  customElements.define(SPIELE_ZOFF_VIEW_TAG, SpieleZoffView);
  registered = true;
}

export function ensureZoffViewHost(root: HTMLElement): SpieleZoffView {
  registerZoffViewElement();
  let host = root.querySelector<SpieleZoffView>(SPIELE_ZOFF_VIEW_TAG);
  if (!host) {
    host = document.createElement(SPIELE_ZOFF_VIEW_TAG) as SpieleZoffView;
    root.appendChild(host);
  }
  return host;
}

declare global {
  interface HTMLElementTagNameMap {
    [SPIELE_ZOFF_VIEW_TAG]: SpieleZoffView;
  }
}
