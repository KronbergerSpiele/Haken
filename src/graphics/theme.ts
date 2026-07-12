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
