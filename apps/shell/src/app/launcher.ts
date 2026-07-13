import {
  registerUiElements,
  SPIELE_LAUNCHER_TAG,
  type LauncherLoadState,
  type SpieleLauncher,
} from '@spiele/ui';
import type { GameManifest } from '@spiele/engine/contracts';
import { buildShareUrl } from './router';

export type { LauncherLoadState };

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

export function renderLauncher(
  root: HTMLElement,
  model: LauncherViewModel,
  actions: LauncherActions,
): () => void {
  registerUiElements();

  let launcher = root.querySelector<SpieleLauncher>(SPIELE_LAUNCHER_TAG);
  if (!launcher) {
    launcher = document.createElement(SPIELE_LAUNCHER_TAG);
    root.replaceChildren(launcher);
  }

  launcher.manifests = model.manifests;
  launcher.loadStates = model.loadStates;
  launcher.notice = model.notice;
  launcher.selectedGameId = model.selectedGameId;
  launcher.shareUrlFor = buildShareUrl;

  const onPlay = (event: Event): void => {
    const gameId = (event as CustomEvent<string>).detail;
    if (gameId) actions.onPlay(gameId);
  };
  const onShare = (event: Event): void => {
    const gameId = (event as CustomEvent<string>).detail;
    if (gameId) actions.onShare(gameId);
  };

  launcher.addEventListener('spiele-play', onPlay);
  launcher.addEventListener('spiele-share', onShare);
  launcher.renderNow();

  return () => {
    launcher.removeEventListener('spiele-play', onPlay);
    launcher.removeEventListener('spiele-share', onShare);
  };
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
