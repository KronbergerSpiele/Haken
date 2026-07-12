import type { GameManifest } from '../engine/contracts';
import { buildShareUrl } from './router';

export type LauncherLoadState = 'idle' | 'loading' | 'failed';

export interface LauncherViewModel {
  manifests: readonly GameManifest[];
  loadStates: Readonly<Record<string, LauncherLoadState>>;
  notice: string | null;
  selectedGameId: string | null;
}

export interface LauncherActions {
  onPlay: (gameId: string) => void;
  onShare: (gameId: string) => void;
}

function playerLabel(manifest: GameManifest): string {
  const { min, max } = manifest.players;
  if (min === max) return `${min} Spieler`;
  return `${min}–${max} Spieler`;
}

function orientationLabel(orientation: GameManifest['orientation']): string {
  if (orientation === 'portrait') return 'Hochformat';
  if (orientation === 'landscape') return 'Querformat';
  return 'Beliebig';
}

function deviceLabel(device: GameManifest['device']): string {
  return device === 'shared-screen' ? 'Ein Gerät teilen' : device;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cardMarkup(
  manifest: GameManifest,
  loadState: LauncherLoadState,
  selected: boolean,
): string {
  const loading = loadState === 'loading';
  const failed = loadState === 'failed';
  const playLabel = loading ? 'LÄDT…' : failed ? 'FEHLER' : 'SPIELEN';
  const playDisabled = loading || failed ? 'disabled' : '';
  return `<article class="launcher-card ${selected ? 'is-selected' : ''} ${failed ? 'is-failed' : ''}" data-game-id="${escapeHtml(manifest.id)}">
    <header class="launcher-card__header">
      <h2>${escapeHtml(manifest.title)}</h2>
      <p>${escapeHtml(manifest.description)}</p>
    </header>
    <dl class="launcher-card__meta">
      <div><dt>Spieler</dt><dd>${playerLabel(manifest)}</dd></div>
      <div><dt>Ausrichtung</dt><dd>${orientationLabel(manifest.orientation)}</dd></div>
      <div><dt>Gerät</dt><dd>${deviceLabel(manifest.device)}</dd></div>
    </dl>
    <div class="launcher-card__actions">
      <button type="button" class="launcher-play" data-play="${escapeHtml(manifest.id)}" ${playDisabled} aria-busy="${loading}">${playLabel}</button>
      <button type="button" class="launcher-share" data-share="${escapeHtml(manifest.id)}" aria-label="Link zu ${escapeHtml(manifest.title)} teilen">Teilen</button>
    </div>
    ${failed ? '<p class="launcher-card__error">Spiel konnte nicht geladen werden.</p>' : ''}
    <p class="launcher-share-url" hidden>
      <label>Link<input readonly data-share-url="${escapeHtml(manifest.id)}" value="${escapeHtml(buildShareUrl(manifest.id))}"></label>
    </p>
  </article>`;
}

export function renderLauncher(
  root: HTMLElement,
  model: LauncherViewModel,
  actions: LauncherActions,
): () => void {
  root.innerHTML = `<div class="launcher">
    <header class="launcher-hero">
      <span class="launcher-kicker">Mini-Spiele</span>
      <h1>Spielesammlung</h1>
      <p>Wähle ein Spiel, teile den Link, und wechsle jederzeit zurück — ohne die Seite neu zu laden.</p>
    </header>
    ${model.notice ? `<p class="launcher-notice" role="status">${escapeHtml(model.notice)}</p>` : ''}
    <div class="launcher-grid" role="list">
      ${model.manifests
        .map((manifest) =>
          cardMarkup(
            manifest,
            model.loadStates[manifest.id] ?? 'idle',
            model.selectedGameId === manifest.id,
          ),
        )
        .join('')}
    </div>
    <div id="launcher-live" class="visually-hidden" aria-live="polite"></div>
  </div>`;

  const clickHandler = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target) return;
    const playId = target.dataset.play;
    if (playId) {
      actions.onPlay(playId);
      return;
    }
    const shareId = target.dataset.share;
    if (shareId) actions.onShare(shareId);
  };

  root.addEventListener('click', clickHandler);
  return () => root.removeEventListener('click', clickHandler);
}

export async function shareGameLink(gameId: string, title: string): Promise<string> {
  const url = buildShareUrl(gameId);
  const card = document.querySelector<HTMLElement>(`[data-game-id="${gameId}"]`);
  const fallback = card?.querySelector<HTMLElement>('.launcher-share-url');
  if (fallback) fallback.hidden = false;

  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return url;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return url;
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    announceLauncher(`Link zu ${title} kopiert.`);
    return url;
  }

  announceLauncher(`Link bereit: ${url}`);
  return url;
}

export function announceLauncher(message: string): void {
  const region = document.querySelector<HTMLElement>('#launcher-live');
  if (!region) return;
  region.textContent = message;
}

export function focusLauncherEntry(gameId: string | null): void {
  if (!gameId) return;
  const card = document.querySelector<HTMLElement>(`[data-game-id="${gameId}"] .launcher-play`);
  card?.focus();
}
