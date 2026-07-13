export const SHARED_THEME = {
  ink: '#171410',
  paper: '#fff0bd',
  yellow: '#ffc928',
  red: '#e84a34',
  blue: '#308ac4',
  green: '#40a462',
} as const;

export const HAKEN_THEME = {
  ...SHARED_THEME,
  accent: '#ffc928',
  background: '#171410',
} as const;

export const ZOFF_THEME = {
  ...SHARED_THEME,
  accent: '#00e5ff',
  background: '#080c14',
  laserCyan: '#00e5ff',
  laserMagenta: '#ff2d95',
  panel: '#121a2e',
  text: '#e8f4ff',
} as const;

export function applySharedTokens(root: HTMLElement): void {
  root.style.setProperty('--ink', SHARED_THEME.ink);
  root.style.setProperty('--paper', SHARED_THEME.paper);
  root.style.setProperty('--yellow', SHARED_THEME.yellow);
  root.style.setProperty('--red', SHARED_THEME.red);
  root.style.setProperty('--blue', SHARED_THEME.blue);
  root.style.setProperty('--green', SHARED_THEME.green);
}

export function applyHakenTokens(root: HTMLElement): void {
  applySharedTokens(root);
  root.style.setProperty('--game-accent', HAKEN_THEME.accent);
  root.style.setProperty('--game-background', HAKEN_THEME.background);
}

export function applyZoffTokens(root: HTMLElement): void {
  applySharedTokens(root);
  root.style.setProperty('--game-accent', ZOFF_THEME.accent);
  root.style.setProperty('--game-background', ZOFF_THEME.background);
  root.style.setProperty('--zoff-laser-cyan', ZOFF_THEME.laserCyan);
  root.style.setProperty('--zoff-laser-magenta', ZOFF_THEME.laserMagenta);
  root.style.setProperty('--zoff-panel-solid', ZOFF_THEME.panel);
  root.style.setProperty('--zoff-text', ZOFF_THEME.text);
}
