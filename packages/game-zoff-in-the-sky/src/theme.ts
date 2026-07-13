import { SHARED_THEME, applySharedTokens } from '@spiele/graphics/theme';

export const ZOFF_THEME = {
  ...SHARED_THEME,
  accent: '#00e5ff',
  background: '#080c14',
  laserCyan: '#00e5ff',
  laserMagenta: '#ff2d95',
  panel: '#121a2e',
  text: '#e8f4ff',
} as const;

export function applyZoffTokens(root: HTMLElement): void {
  applySharedTokens(root);
  root.style.setProperty('--game-accent', ZOFF_THEME.accent);
  root.style.setProperty('--game-background', ZOFF_THEME.background);
  root.style.setProperty('--zoff-laser-cyan', ZOFF_THEME.laserCyan);
  root.style.setProperty('--zoff-laser-magenta', ZOFF_THEME.laserMagenta);
  root.style.setProperty('--zoff-panel-solid', ZOFF_THEME.panel);
  root.style.setProperty('--zoff-text', ZOFF_THEME.text);
}
