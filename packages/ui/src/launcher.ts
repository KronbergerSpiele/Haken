import type { GameManifest } from '@spiele/engine/contracts';
import { html } from 'lit';
import { defineSpieleElement } from './define';
import { LightDomElement } from './light-dom-element';
import { registerLauncherCardElement } from './launcher-card';
import type { LauncherLoadState } from './launcher-labels';

export const SPIELE_LAUNCHER_TAG = 'spiele-launcher';

export class SpieleLauncher extends LightDomElement {
  static override properties = {
    manifests: { attribute: false },
    loadStates: { attribute: false },
    notice: { type: String },
    selectedGameId: { type: String, attribute: 'selected-game-id' },
    shareUrlFor: { attribute: false },
  };

  declare manifests: readonly GameManifest[];
  declare loadStates: Readonly<Record<string, LauncherLoadState>>;
  declare notice: string | null;
  declare selectedGameId: string | null;
  declare shareUrlFor: (gameId: string) => string;

  constructor() {
    super();
    this.manifests = [];
    this.loadStates = {};
    this.notice = null;
    this.selectedGameId = null;
    this.shareUrlFor = () => '';
    registerLauncherCardElement();
  }

  override renderNow(): void {
    super.renderNow();
    for (const card of this.querySelectorAll('spiele-launcher-card')) {
      card.renderNow();
    }
  }

  override render() {
    return html`
      <div class="launcher">
        <header class="launcher-hero">
          <span class="launcher-kicker">Mini-Spiele</span>
          <h1>Spielesammlung</h1>
          <p>
            Wähle ein Spiel, teile den Link, und wechsle jederzeit zurück — ohne die Seite neu zu
            laden.
          </p>
        </header>
        ${this.notice
          ? html`<p class="launcher-notice" role="status">${this.notice}</p>`
          : null}
        <div class="launcher-grid" role="list">
          ${this.manifests.map(
            (manifest) => html`
              <spiele-launcher-card
                .manifest=${manifest}
                .loadState=${this.loadStates[manifest.id] ?? 'idle'}
                ?selected=${this.selectedGameId === manifest.id}
                .shareUrl=${this.shareUrlFor(manifest.id)}
              ></spiele-launcher-card>
            `,
          )}
        </div>
        <div id="launcher-live" class="visually-hidden" aria-live="polite"></div>
      </div>
    `;
  }
}

export function registerLauncherElement(): void {
  registerLauncherCardElement();
  defineSpieleElement(SPIELE_LAUNCHER_TAG, SpieleLauncher);
}

declare global {
  interface HTMLElementTagNameMap {
    [SPIELE_LAUNCHER_TAG]: SpieleLauncher;
  }
}
