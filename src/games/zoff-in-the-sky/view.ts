import { getVisibleDiscard } from './reducer';
import type { GameEvent, GameState, GridCell, PlayerId, Species } from './model';
import { GRID_COLS, GRID_ROWS } from './model';
import {
  cardBackMarkup,
  cardFaceMarkup,
  eatingRelationLabel,
  eatConnectorMarkup,
  findAdjacentEatLinks,
  privateDrawMarkup,
  speciesLabel,
  speciesValueLabel,
  eatingIndicatorsMarkup,
} from './graphics';
import { escapeHtml } from '../../graphics/primitives';

export interface UiState {
  handoffConfirmed: boolean;
  discardRevealMode: boolean;
  statusMessage: string;
  chainFeedback: string | null;
  removedCardCount: number;
}

export const INITIAL_UI: UiState = {
  handoffConfirmed: false,
  discardRevealMode: false,
  statusMessage: '',
  chainFeedback: null,
  removedCardCount: 0,
};

function playerName(player: PlayerId): string {
  return `Spieler ${player + 1}`;
}

function phaseInstructions(state: GameState, ui: UiState): string {
  if (state.phase === 'setup') {
    return 'Tippe auf Start, um die Runde zu beginnen.';
  }
  if (!ui.handoffConfirmed) {
    return `${playerName(state.activePlayer)} ist dran. Gerät übergeben und bestätigen.`;
  }
  if (state.phase === 'awaitingAction' || state.phase === 'finalTurn') {
    const suffix = state.phase === 'finalTurn' ? ' Letzter Zug!' : '';
    return `${playerName(state.activePlayer)}: Nimm die Ablage oder ziehe verdeckt.${suffix}`;
  }
  if (state.phase === 'holdingDiscard') {
    return `${playerName(state.activePlayer)}: Lege die Ablagekarte auf ein Feld oder eine Lücke.`;
  }
  if (state.phase === 'inspectingDraw') {
    if (ui.discardRevealMode) {
      return `${playerName(state.activePlayer)}: Wähle eine verdeckte Karte zum Aufdecken.`;
    }
    return `${playerName(state.activePlayer)}: Lege die gezogene Karte ab oder verwerfe sie und decke auf.`;
  }
  if (state.phase === 'finished') {
    return 'Runde beendet.';
  }
  return '';
}

function cellSpecies(cell: GridCell | null): Species | null {
  return cell?.faceUp ? cell.card.species : null;
}

function gridRowSpecies(cells: Array<GridCell | null>): Array<Species | null> {
  return cells.map((cell) => cellSpecies(cell));
}

function gridCellMarkup(
  state: GameState,
  player: PlayerId,
  row: number,
  col: number,
  options: { compact: boolean; interactive: boolean; ui: UiState },
): string {
  const cell = state.players[player].grid[row]![col];
  const compact = options.compact;
  const classes = ['zoff-cell'];
  if (cell === null) classes.push('zoff-cell--gap');
  else if (!cell.faceUp) classes.push('zoff-cell--hidden');
  else classes.push('zoff-cell--face-up');

  const canPlace =
    options.interactive &&
    player === state.activePlayer &&
    state.pendingCard !== null &&
    (state.phase === 'holdingDiscard' || state.phase === 'inspectingDraw') &&
    !options.ui.discardRevealMode;

  const canReveal =
    options.interactive &&
    player === state.activePlayer &&
    state.phase === 'inspectingDraw' &&
    options.ui.discardRevealMode &&
    cell !== null &&
    !cell.faceUp;

  if (canPlace) classes.push('zoff-cell--placeable');
  if (canReveal) classes.push('zoff-cell--revealable');

  let content = '';
  if (cell === null) {
    content = '<span class="zoff-cell-gap" aria-hidden="true">·</span>';
  } else if (!cell.faceUp) {
    content = cardBackMarkup({ compact });
  } else {
    content = `${eatingIndicatorsMarkup(cell.card.species)}${cardFaceMarkup(cell.card.species, { compact })}`;
  }

  const label =
    cell === null
      ? 'Leere Lücke'
      : cell.faceUp
        ? `${speciesLabel(cell.card.species)}, ${speciesValueLabel(cell.card.species)} Punkte. ${eatingRelationLabel(cell.card.species)}`
        : 'Verdeckte Karte';

  if (canPlace) {
    return `<button type="button" class="${classes.join(' ')}" data-place data-row="${row}" data-col="${col}" aria-label="${escapeHtml(label)} ablegen">${content}</button>`;
  }
  if (canReveal) {
    return `<button type="button" class="${classes.join(' ')}" data-reveal data-row="${row}" data-col="${col}" aria-label="${escapeHtml(label)} aufdecken">${content}</button>`;
  }

  return `<div class="${classes.join(' ')}" role="img" aria-label="${escapeHtml(label)}">${content}</div>`;
}

function eatLinksMarkup(cells: Array<GridCell | null>, row: number): string {
  const links = findAdjacentEatLinks(gridRowSpecies(cells)).map((link) => ({
    ...link,
    row,
  }));
  return links.map((link) => eatConnectorMarkup(link)).join('');
}

function boardMarkup(
  state: GameState,
  player: PlayerId,
  options: { compact: boolean; interactive: boolean; ui: UiState },
): string {
  const board = state.players[player].grid;
  const rows = Array.from({ length: GRID_ROWS }, (_, row) => {
    const cells = board[row]!;
    const cellMarkup = Array.from({ length: GRID_COLS }, (_, col) =>
      gridCellMarkup(state, player, row, col, options),
    ).join('');
    const links = options.compact ? '' : eatLinksMarkup(cells, row);
    return `<div class="zoff-grid-row" data-row="${row}">
      <div class="zoff-grid-cells">${cellMarkup}</div>
      ${links ? `<div class="zoff-grid-links">${links}</div>` : ''}
    </div>`;
  }).join('');

  return `<section class="zoff-board ${options.compact ? 'zoff-board--compact' : 'zoff-board--active'}" aria-label="Spielfeld ${playerName(player)}">
    <header class="zoff-board__header">
      <span>${playerName(player)}</span>
      ${player === state.activePlayer ? '<b class="zoff-board__turn">Am Zug</b>' : ''}
    </header>
    <div class="zoff-grid">${rows}</div>
  </section>`;
}

function pileMarkup(state: GameState, interactive: boolean): string {
  const top = getVisibleDiscard(state);
  const discardContent = top
    ? cardFaceMarkup(top.species, { compact: true })
    : '<span class="zoff-pile-empty">leer</span>';
  const canTake =
    interactive &&
    (state.phase === 'awaitingAction' || state.phase === 'finalTurn') &&
    top !== null;

  return `<section class="zoff-piles" aria-label="Stapel">
    <div class="zoff-pile zoff-pile--deck" aria-label="Ziehstapel, ${state.drawPile.length} Karten">
      ${cardBackMarkup({ compact: true })}
      <span class="zoff-pile-count">${state.drawPile.length}</span>
    </div>
    <div class="zoff-pile zoff-pile--discard" aria-label="Ablagestapel">
      ${discardContent}
    </div>
    <div class="zoff-pile-actions">
      ${
        canTake
          ? `<button type="button" class="zoff-action" data-take-discard>Ablage nehmen</button>`
          : ''
      }
      ${
        interactive && (state.phase === 'awaitingAction' || state.phase === 'finalTurn')
          ? `<button type="button" class="zoff-action zoff-action--primary" data-draw>Verdeckt ziehen</button>`
          : ''
      }
    </div>
  </section>`;
}

function pendingActionsMarkup(state: GameState, ui: UiState): string {
  if (state.phase !== 'inspectingDraw' || !ui.handoffConfirmed) return '';
  if (ui.discardRevealMode) {
    return `<button type="button" class="zoff-action" data-cancel-reveal>Abbrechen</button>`;
  }
  return `<button type="button" class="zoff-action" data-discard-reveal>Verwerfen und aufdecken</button>`;
}

function handoffMarkup(state: GameState): string {
  return `<main class="zoff-handoff">
    <p class="zoff-handoff__kicker">Gerät übergeben</p>
    <h2>${escapeHtml(playerName(state.activePlayer))}</h2>
    <p class="zoff-handoff__text">Du bist jetzt dran. Nimm das Gerät und bestätige, bevor du das Spielfeld siehst.</p>
  ${
    state.phase === 'finalTurn'
      ? '<p class="zoff-handoff__note">Letzter Zug der Runde!</p>'
      : ''
  }
    <button type="button" class="zoff-start-button" data-confirm-handoff>Bereit</button>
  </main>`;
}

function setupMarkup(): string {
  return `<main class="zoff-splash">
    <div class="zoff-splash__sky" aria-hidden="true"></div>
    <div class="zoff-splash__logo">
      <span>ZWEI SPIELER · EIN HANDY · EINE RUNDE</span>
      <h1>Zoff in the Sky</h1>
      <p>Tierisches Geduldspiel hoch über den Wolken</p>
    </div>
    <ol class="zoff-how-to">
      <li><b>1</b> Niedrigste Punktzahl gewinnt</li>
      <li><b>2</b> Ablage nehmen oder verdeckt ziehen</li>
      <li><b>3</b> Fressketten entfernen drei oder mehr Karten</li>
    </ol>
    <button type="button" class="zoff-start-button" data-start>Spiel starten</button>
    <p class="zoff-rotate-note">Spielt im Hochformat auf einem gemeinsamen Gerät.</p>
  </main>`;
}

function resultMarkup(state: GameState, ui: UiState): string {
  const result = state.result!;
  const winnerText =
    result.winner === null
      ? 'Unentschieden!'
      : `${playerName(result.winner)} gewinnt!`;
  const scoreLine = `Spieler 1: ${result.scores[0]} · Spieler 2: ${result.scores[1]}`;
  const chainLine =
    ui.removedCardCount > 0
      ? `${ui.removedCardCount} Karten durch Fressketten entfernt.`
      : 'Keine Fressketten in dieser Runde.';
  const feedback = ui.chainFeedback ? `<p class="zoff-result__chains">${escapeHtml(ui.chainFeedback)}</p>` : '';

  return `<div class="zoff-result" role="dialog" aria-modal="true" aria-label="Ergebnis">
    <span class="zoff-result__kicker">Runde vorbei</span>
    <h2>${escapeHtml(winnerText)}</h2>
    <p class="zoff-result__scores">${escapeHtml(scoreLine)}</p>
    <p class="zoff-result__chains-summary">${escapeHtml(chainLine)}</p>
    ${feedback}
    <button type="button" class="zoff-start-button" data-restart>Nochmal spielen</button>
  </div>`;
}

function playMarkup(state: GameState, ui: UiState): string {
  const opponent: PlayerId = state.activePlayer === 0 ? 1 : 0;
  const pending = state.pendingCard?.card ?? null;
  const showPrivateDraw =
    ui.handoffConfirmed && state.phase === 'inspectingDraw' && pending !== null;

  return `<div class="zoff-game">
    ${boardMarkup(state, opponent, { compact: true, interactive: false, ui })}
    ${pileMarkup(state, true)}
    ${showPrivateDraw ? privateDrawMarkup(pending.species) : ''}
    ${pendingActionsMarkup(state, ui)}
    ${boardMarkup(state, state.activePlayer, { compact: false, interactive: true, ui })}
    <div class="zoff-status" aria-live="polite">${escapeHtml(ui.statusMessage || phaseInstructions(state, ui))}</div>
    <div class="zoff-landscape-warning"><b>Handy drehen</b><span>Zoff spielt man hochkant.</span></div>
    ${state.phase === 'finished' ? resultMarkup(state, ui) : ''}
  </div>`;
}

export function render(root: HTMLElement, state: GameState, ui: UiState): void {
  if (state.phase === 'setup') {
    root.innerHTML = setupMarkup();
    return;
  }

  if (!ui.handoffConfirmed) {
    root.innerHTML = handoffMarkup(state);
    return;
  }

  root.innerHTML = playMarkup(state, ui);
}

export function formatChainEvent(event: Extract<GameEvent, { type: 'chainRemoved' }>): string {
  const names = event.species.map((species) => speciesLabel(species)).join(' → ');
  return `Fresskette in Reihe ${event.row + 1}: ${names}`;
}

export function countRemovedCards(events: GameEvent[]): number {
  return events
    .filter((event): event is Extract<GameEvent, { type: 'chainRemoved' }> => event.type === 'chainRemoved')
    .reduce((sum, event) => sum + event.cols.length, 0);
}
