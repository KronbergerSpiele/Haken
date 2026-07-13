import type { GameManifest } from '@spiele/engine/contracts';
import { html, type PropertyValues } from 'lit';
import { defineSpieleElement } from './define';
import { LightDomElement } from './light-dom-element';
import {
  deviceLabel,
  orientationLabel,
  playerLabel,
  playButtonLabel,
  type LauncherLoadState,
} from './launcher-labels';

export const SPIELE_LAUNCHER_CARD_TAG = 'spiele-launcher-card';

export class SpieleLauncherCard extends LightDomElement {
  static override properties = {
    manifest: { attribute: false },
    loadState: { type: String },
    selected: { type: Boolean },
    shareUrl: { type: String },
  };

  declare manifest: GameManifest | null;
  declare loadState: LauncherLoadState;
  declare selected: boolean;
  declare shareUrl: string;

  constructor() {
    super();
    this.manifest = null;
    this.loadState = 'idle';
    this.selected = false;
    this.shareUrl = '';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('manifest') || changed.has('loadState') || changed.has('selected')) {
      this.syncHostState();
    }
  }

  private syncHostState(): void {
    const manifest = this.manifest;
    if (!manifest) return;
    const failed = this.loadState === 'failed';
    this.className = `launcher-card${this.selected ? ' is-selected' : ''}${failed ? ' is-failed' : ''}`;
    this.dataset.gameId = manifest.id;
    this.setAttribute('role', 'listitem');
  }

  override render() {
    const manifest = this.manifest;
    if (!manifest) return html``;

    const loading = this.loadState === 'loading';
    const failed = this.loadState === 'failed';
    const playLabel = playButtonLabel(this.loadState);

    return html`
      <header class="launcher-card__header">
        <h2>${manifest.title}</h2>
        <p>${manifest.description}</p>
      </header>
      <dl class="launcher-card__meta">
        <div>
          <dt>Spieler</dt>
          <dd>${playerLabel(manifest)}</dd>
        </div>
        <div>
          <dt>Ausrichtung</dt>
          <dd>${orientationLabel(manifest.orientation)}</dd>
        </div>
        <div>
          <dt>Gerät</dt>
          <dd>${deviceLabel(manifest.device)}</dd>
        </div>
      </dl>
      <div class="launcher-card__actions">
        <button
          type="button"
          class="launcher-play"
          data-play=${manifest.id}
          ?disabled=${loading || failed}
          aria-busy=${loading ? 'true' : 'false'}
          @click=${this.handlePlay}
        >
          ${playLabel}
        </button>
        <button
          type="button"
          class="launcher-share"
          data-share=${manifest.id}
          aria-label=${`Link zu ${manifest.title} teilen`}
          @click=${this.handleShare}
        >
          Teilen
        </button>
      </div>
      ${failed
        ? html`<p class="launcher-card__error">Spiel konnte nicht geladen werden.</p>`
        : null}
      <p class="launcher-share-url" hidden>
        <label
          >Link<input readonly data-share-url=${manifest.id} .value=${this.shareUrl}
        /></label>
      </p>
    `;
  }

  private handlePlay(event: Event): void {
    event.stopPropagation();
    const gameId = this.manifest?.id;
    if (!gameId || this.loadState === 'loading' || this.loadState === 'failed') return;
    this.dispatchEvent(
      new CustomEvent('spiele-play', { bubbles: true, detail: gameId }),
    );
  }

  private handleShare(event: Event): void {
    event.stopPropagation();
    const gameId = this.manifest?.id;
    if (!gameId) return;
    this.dispatchEvent(
      new CustomEvent('spiele-share', { bubbles: true, detail: gameId }),
    );
  }
}

export function registerLauncherCardElement(): void {
  defineSpieleElement(SPIELE_LAUNCHER_CARD_TAG, SpieleLauncherCard);
}

declare global {
  interface HTMLElementTagNameMap {
    [SPIELE_LAUNCHER_CARD_TAG]: SpieleLauncherCard;
  }
}
