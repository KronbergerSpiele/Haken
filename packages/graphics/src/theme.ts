export const SHARED_THEME = {
  ink: '#171410',
  paper: '#fff0bd',
  yellow: '#ffc928',
  red: '#e84a34',
  blue: '#308ac4',
  green: '#40a462',
} as const;

export function applySharedTokens(root: HTMLElement): void {
  root.style.setProperty('--ink', SHARED_THEME.ink);
  root.style.setProperty('--paper', SHARED_THEME.paper);
  root.style.setProperty('--yellow', SHARED_THEME.yellow);
  root.style.setProperty('--red', SHARED_THEME.red);
  root.style.setProperty('--blue', SHARED_THEME.blue);
  root.style.setProperty('--green', SHARED_THEME.green);
}
