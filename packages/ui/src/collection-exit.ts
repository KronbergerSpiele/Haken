import { html } from 'lit';
import { defineSpieleElement } from './define';
import { LightDomElement } from './light-dom-element';

export const SPIELE_COLLECTION_EXIT_TAG = 'spiele-collection-exit';

export class SpieleCollectionExit extends LightDomElement {
  static override properties = {
    label: { type: String },
  };

  declare label: string;

  constructor() {
    super();
    this.label = '← SAMMLUNG';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.style.display = 'contents';
  }

  override render() {
    return html`
      <button
        type="button"
        class="collection-exit"
        data-exit-collection="true"
        aria-label="Zurück zur Spielesammlung"
        @click=${this.handleClick}
      >
        ${this.label}
      </button>
    `;
  }

  private handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('spiele-exit', { bubbles: true, detail: undefined }),
    );
  }
}

export function registerCollectionExitElement(): void {
  defineSpieleElement(SPIELE_COLLECTION_EXIT_TAG, SpieleCollectionExit);
}

export function mountCollectionExit(root: HTMLElement): SpieleCollectionExit {
  registerCollectionExitElement();
  let exit = root.querySelector<SpieleCollectionExit>(SPIELE_COLLECTION_EXIT_TAG);
  if (!exit) {
    exit = document.createElement(SPIELE_COLLECTION_EXIT_TAG);
    root.appendChild(exit);
  }
  exit.renderNow();
  return exit;
}

declare global {
  interface HTMLElementTagNameMap {
    [SPIELE_COLLECTION_EXIT_TAG]: SpieleCollectionExit;
  }
}
