import { countPlayerHidden } from './reducer';
import type { GameState, Grid, PlayerId } from './model';
import { cardValue } from './cards';

export function visibleSubtotal(grid: Grid): number {
  let sum = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null && cell.faceUp) {
        sum += cardValue(cell.card.species);
      }
    }
  }
  return sum;
}

export function formatBoardScore(state: GameState, player: PlayerId): string {
  const visible = visibleSubtotal(state.players[player].grid);
  const hidden = countPlayerHidden(state, player);
  return `Sichtbar ${visible} · ${hidden} verdeckt`;
}
