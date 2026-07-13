import { canPlacePendingAt, getVisibleDiscard } from './reducer';
import type { GameState, GridCell, PlayerId, Species } from './model';
import { GRID_COLS, GRID_ROWS } from './model';
import {
  cardBackTemplate,
  cardFaceTemplate,
  eatConnectorTemplate,
  eatingChainsOverlayTemplate,
  eatingIndicatorsTemplate,
  eatingRelationLabel,
  findAdjacentEatLinks,
  speciesLabel,
  speciesValueLabel,
  type EatingChainGroup,
} from './graphics';
import type { UiState } from './view';
import { formatBoardScore } from './view-helpers';
import { html, nothing, type TemplateResult } from 'lit';

function playerName(player: PlayerId): string {
  return `Spieler ${player + 1}`;
}

function phaseInstructions(state: GameState, ui: UiState): string {
  if (state.phase === 'setup') {
    return 'Tippe auf Start, um die Runde zu beginnen.';
  }
  if (ui.turnToastActive) {
    return `${playerName(state.activePlayer)} ist dran.`;
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

function gridCellTemplate(
  state: GameState,
  player: PlayerId,
  row: number,
  col: number,
  options: { compact: boolean; interactive: boolean; ui: UiState },
): TemplateResult {
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
    !options.ui.discardRevealMode &&
    canPlacePendingAt(state, player, row, col);

  const canReveal =
    options.interactive &&
    player === state.activePlayer &&
    state.phase === 'inspectingDraw' &&
    options.ui.discardRevealMode &&
    cell !== null &&
    !cell.faceUp;

  if (canPlace) classes.push('zoff-cell--placeable');
  if (canReveal) classes.push('zoff-cell--revealable');

  const className = classes.join(' ');

  let content: TemplateResult;
  if (cell === null) {
    content = html`<span class="zoff-cell-gap" aria-hidden="true">·</span>`;
  } else if (!cell.faceUp) {
    content = cardBackTemplate({ compact });
  } else {
    content = html`${eatingIndicatorsTemplate(cell.card.species)}${cardFaceTemplate(cell.card.species, { compact })}`;
  }

  const label =
    cell === null
      ? 'Leere Lücke'
      : cell.faceUp
        ? `${speciesLabel(cell.card.species)}, ${speciesValueLabel(cell.card.species)} Punkte. ${eatingRelationLabel(cell.card.species)}`
        : 'Verdeckte Karte';

  if (canPlace) {
    return html`
      <button
        type="button"
        class=${className}
        data-place=${''}
        data-row=${String(row)}
        data-col=${String(col)}
        aria-label=${`${label} ablegen`}
      >
        ${content}
      </button>
    `;
  }
  if (canReveal) {
    return html`
      <button
        type="button"
        class=${className}
        data-reveal=${''}
        data-row=${String(row)}
        data-col=${String(col)}
        aria-label=${`${label} aufdecken`}
      >
        ${content}
      </button>
    `;
  }

  return html`
    <div class=${className} role="img" aria-label=${label}>
      ${content}
    </div>
  `;
}

function eatLinksTemplate(cells: Array<GridCell | null>, row: number): TemplateResult {
  const links = findAdjacentEatLinks(gridRowSpecies(cells)).map((link) => ({
    ...link,
    row,
  }));
  return html`${links.map((link) => eatConnectorTemplate(link))}`;
}

function boardTemplate(
  state: GameState,
  player: PlayerId,
  options: { compact: boolean; interactive: boolean; ui: UiState },
): TemplateResult {
  const board = state.players[player].grid;
  const isCurrentTurn = !options.ui.turnToastActive && player === state.activePlayer;
  const boardClass = `zoff-board ${options.compact ? 'zoff-board--compact' : 'zoff-board--active'}${isCurrentTurn ? ' zoff-board--current-turn' : ''}`;
  const scoreText = formatBoardScore(state, player);

  return html`
    <section class=${boardClass} aria-label=${`Spielfeld ${playerName(player)}`}>
      <header class="zoff-board__header">
        <span class="zoff-board__player">${playerName(player)}</span>
        <span class="zoff-board__score" aria-label=${scoreText}>${scoreText}</span>
        ${isCurrentTurn ? html`<b class="zoff-board__turn">Am Zug</b>` : nothing}
      </header>
      <div class="zoff-grid">
        ${Array.from({ length: GRID_ROWS }, (_, row) => {
          const cells = board[row]!;
          const links = options.compact ? nothing : html`
            <div class="zoff-grid-links">${eatLinksTemplate(cells, row)}</div>
          `;
          return html`
            <div class="zoff-grid-row" data-row=${String(row)}>
              <div class="zoff-grid-cells">
                ${Array.from({ length: GRID_COLS }, (_, col) =>
                  gridCellTemplate(state, player, row, col, options),
                )}
              </div>
              ${links}
            </div>
          `;
        })}
      </div>
    </section>
  `;
}

function pileActionsTemplate(state: GameState, interactive: boolean): TemplateResult | null {
  const top = getVisibleDiscard(state);
  const canTake =
    interactive &&
    (state.phase === 'awaitingAction' || state.phase === 'finalTurn') &&
    top !== null;

  const canDraw =
    interactive && (state.phase === 'awaitingAction' || state.phase === 'finalTurn');

  if (!canTake && !canDraw) return null;

  return html`
    <div class="zoff-pile-actions">
      ${canTake
        ? html`<button type="button" class="zoff-action" data-take-discard=${''}>Ablage nehmen</button>`
        : nothing}
      ${canDraw
        ? html`<button type="button" class="zoff-action zoff-action--primary" data-draw=${''}>Verdeckt ziehen</button>`
        : nothing}
    </div>
  `;
}

function pendingActionsTemplate(state: GameState, ui: UiState): TemplateResult | null {
  if (state.phase !== 'inspectingDraw' || ui.turnToastActive) return null;
  if (ui.discardRevealMode) {
    return html`<button type="button" class="zoff-action" data-cancel-reveal=${''}>Abbrechen</button>`;
  }
  return html`<button type="button" class="zoff-action" data-discard-reveal=${''}>Verwerfen und aufdecken</button>`;
}

function privateDecisionTemplate(state: GameState, ui: UiState): TemplateResult {
  const species = state.pendingCard!.card.species;
  const actions = pendingActionsTemplate(state, ui);
  return html`
    <div class="zoff-private-decision" role="region" aria-label="Entscheidung zur gezogenen Karte">
      <div class="zoff-private-draw" aria-label="Gezogene Karte nur für den aktiven Spieler">
        <p class="zoff-private-draw__hint">Nur du siehst diese Karte.</p>
        ${cardFaceTemplate(species, { compact: true })}
      </div>
      ${actions !== null
        ? html`<div class="zoff-private-decision__actions">${actions}</div>`
        : nothing}
    </div>
  `;
}

function isInspectingDraw(state: GameState, ui: UiState): boolean {
  return state.phase === 'inspectingDraw' && !ui.turnToastActive && state.pendingCard !== null;
}

function pileTemplate(state: GameState, interactive: boolean, ui: UiState): TemplateResult {
  const top = getVisibleDiscard(state);
  const discardContent = top
    ? cardFaceTemplate(top.species, { compact: true })
    : html`<span class="zoff-pile-empty">leer</span>`;
  const canTake =
    interactive &&
    (state.phase === 'awaitingAction' || state.phase === 'finalTurn') &&
    top !== null;

  const canDraw =
    interactive && (state.phase === 'awaitingAction' || state.phase === 'finalTurn');

  const inspecting = isInspectingDraw(state, ui);
  const pileActions = pileActionsTemplate(state, interactive);
  const showSideStrip = inspecting || pileActions !== null;
  const sideContent = inspecting ? privateDecisionTemplate(state, ui) : pileActions;
  const pilesClass = inspecting ? 'zoff-piles zoff-piles--inspecting' : 'zoff-piles';

  return html`
    <section class=${pilesClass} aria-label="Stapel">
      <div class="zoff-pile-edge-gutter" aria-hidden="true"></div>
      <div
        class="zoff-pile zoff-pile--discard${canTake ? ' zoff-pile--draggable' : ''}"
        data-drag-discard=${''}
        aria-label="Ablagestapel"
      >
        ${discardContent}
      </div>
      <div
        class="zoff-pile zoff-pile--deck${canDraw ? ' zoff-pile--draggable' : ''}"
        data-drag-deck=${''}
        aria-label=${`Ziehstapel, ${state.drawPile.length} Karten`}
      >
        ${cardBackTemplate({ compact: true })}
        <span class="zoff-pile-count">${state.drawPile.length}</span>
      </div>
      ${showSideStrip && sideContent !== null
        ? html`<div class="zoff-pile-strip-side">${sideContent}</div>`
        : nothing}
    </section>
  `;
}

function turnToastTemplate(state: GameState, ui: UiState): TemplateResult {
  const message = ui.statusMessage || `${playerName(state.activePlayer)} ist dran.`;
  return html`
    <div class="zoff-turn-toast" role="status" aria-live="polite">
      <p class="zoff-turn-toast__text">${message}</p>
      ${state.phase === 'finalTurn'
        ? html`<p class="zoff-turn-toast__note">Letzter Zug der Runde!</p>`
        : nothing}
    </div>
  `;
}

function setupTemplate(): TemplateResult {
  return html`
    <main class="zoff-splash">
      <div class="zoff-splash__backdrop" aria-hidden="true"></div>
      <div class="zoff-splash__logo">
        <span>ZWEI SPIELER · EIN HANDY · EINE RUNDE</span>
        <h1>Zoff in the Sky</h1>
        <p>Laser-Tierduell in der Neon-Matrix</p>
      </div>
      <ol class="zoff-how-to">
        <li><b>1</b> Niedrigste Punktzahl gewinnt</li>
        <li><b>2</b> Ablage nehmen oder verdeckt ziehen</li>
        <li><b>3</b> Fressketten entfernen drei oder mehr Karten</li>
      </ol>
      <button type="button" class="zoff-start-button" data-start=${''}>Spiel starten</button>
      <p class="zoff-rotate-note">Spielt im Hochformat auf einem gemeinsamen Gerät.</p>
    </main>
  `;
}

function resultTemplate(state: GameState, ui: UiState): TemplateResult {
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

  return html`
    <div class="zoff-result" role="region" aria-labelledby="zoff-result-heading">
      <span class="zoff-result__kicker">Runde vorbei</span>
      <h2 id="zoff-result-heading">${winnerText}</h2>
      <p class="zoff-result__scores">${scoreLine}</p>
      <p class="zoff-result__chains-summary">${chainLine}</p>
      ${ui.chainFeedback
        ? html`<p class="zoff-result__chains">${ui.chainFeedback}</p>`
        : nothing}
      <button type="button" class="zoff-start-button" data-restart=${''}>Nochmal spielen</button>
    </div>
  `;
}

function playTemplate(state: GameState, ui: UiState): TemplateResult {
  const displayPlayer = ui.perspectivePlayer;
  const opponent: PlayerId = displayPlayer === 0 ? 1 : 0;
  const canInteract = !ui.turnToastActive && state.phase !== 'finished';
  const inspecting =
    canInteract &&
    state.phase === 'inspectingDraw' &&
    state.pendingCard !== null &&
    displayPlayer === state.activePlayer;
  const gameClass = inspecting ? 'zoff-game zoff-game--inspecting' : 'zoff-game';
  const statusText = ui.turnToastActive ? '' : ui.statusMessage || phaseInstructions(state, ui);

  return html`
    <div class=${gameClass}>
      <div class="zoff-game__opponent">
        ${boardTemplate(state, opponent, { compact: true, interactive: false, ui })}
      </div>
      <div class="zoff-game__piles">${pileTemplate(state, canInteract, ui)}</div>
      <div class="zoff-game__active">
        ${boardTemplate(state, displayPlayer, { compact: false, interactive: canInteract, ui })}
      </div>
      <div class="zoff-game__status">
        <div class="zoff-status" aria-live="polite">${statusText}</div>
      </div>
      <div class="zoff-landscape-warning"><b>Handy drehen</b><span>Zoff spielt man hochkant.</span></div>
      ${ui.turnToastActive ? turnToastTemplate(state, ui) : nothing}
      ${state.phase === 'finished' ? resultTemplate(state, ui) : nothing}
    </div>
  `;
}

export function eatingOverlaysTemplate(state: GameState, ui: UiState): TemplateResult | null {
  if (ui.eatingOverlayChains.length === 0) return null;
  const aboveResult = state.phase === 'finished';
  const className = aboveResult
    ? 'zoff-eating-overlays zoff-eating-overlays--above-result'
    : 'zoff-eating-overlays';
  return html`
    <div class=${className} data-eating-overlay=${''}>
      ${eatingChainsOverlayTemplate(ui.eatingOverlayChains)}
    </div>
  `;
}

function renderContentTemplate(state: GameState, ui: UiState): TemplateResult {
  if (state.phase === 'setup') return setupTemplate();
  return playTemplate(state, ui);
}

export function zoffViewTemplate(state: GameState, ui: UiState): TemplateResult {
  const overlays = eatingOverlaysTemplate(state, ui);
  return html`
    ${renderContentTemplate(state, ui)}
    ${overlays ?? nothing}
  `;
}

export type { EatingChainGroup };
