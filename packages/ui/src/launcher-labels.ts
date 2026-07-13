import type { GameManifest } from '@spiele/engine/contracts';

export type LauncherLoadState = 'idle' | 'loading' | 'failed';

export function playerLabel(manifest: GameManifest): string {
  const { min, max } = manifest.players;
  if (min === max) return `${min} Spieler`;
  return `${min}–${max} Spieler`;
}

export function orientationLabel(orientation: GameManifest['orientation']): string {
  if (orientation === 'portrait') return 'Hochformat';
  if (orientation === 'landscape') return 'Querformat';
  return 'Beliebig';
}

export function deviceLabel(device: GameManifest['device']): string {
  return device === 'shared-screen' ? 'Ein Gerät teilen' : device;
}

export function playButtonLabel(loadState: LauncherLoadState): string {
  if (loadState === 'loading') return 'LÄDT…';
  if (loadState === 'failed') return 'FEHLER';
  return 'SPIELEN';
}
