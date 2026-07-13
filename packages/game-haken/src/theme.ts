import { SHARED_THEME, applySharedTokens } from '@spiele/graphics/theme';

export const HAKEN_THEME = {
  ...SHARED_THEME,
  accent: '#ffc928',
  background: '#171410',
} as const;

export function applyHakenTokens(root: HTMLElement): void {
  applySharedTokens(root);
  root.style.setProperty('--game-accent', HAKEN_THEME.accent);
  root.style.setProperty('--game-background', HAKEN_THEME.background);
}
