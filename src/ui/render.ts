import { BALANCE, CARD_BY_ID, ZONE_LABELS, ZONE_SYMBOLS } from '../game/cards';
import { cardForSlot, effectiveCardCost } from '../game/engine';
import { ZONES, type CardDefinition, type GameState, type PlayerId, type Zone } from '../game/types';

export interface UiState {
  countdown: number | null;
  selectedSlots: [number | null, number | null];
  selectedZones: [Zone, Zone];
  muted: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function healthMarkup(state: GameState, player: PlayerId): string {
  return ZONES.map((zone) => {
    const health = state.players[player].health[zone];
    const pips = Array.from({ length: BALANCE.zoneHealth }, (_, index) =>
      `<i class="${index < health ? 'full' : ''}"></i>`,
    ).join('');
    return `<div class="health-zone ${health === 0 ? 'broken' : ''}">
      <span aria-hidden="true">${ZONE_SYMBOLS[zone]}</span>
      <b>${ZONE_LABELS[zone]}</b>
      <span class="health-pips" aria-label="${health} von ${BALANCE.zoneHealth}">${pips}</span>
    </div>`;
  }).join('');
}

function tokenMarkup(tokens: number): string {
  return Array.from(
    { length: BALANCE.maxTokens },
    (_, index) => `<i class="${index < tokens ? 'full' : ''}"></i>`,
  ).join('');
}

function cardClass(card: CardDefinition): string {
  return `card card--${card.kind}`;
}

function handMarkup(state: GameState, player: PlayerId, selected: number | null): string {
  return state.players[player].hand
    .map((instance, slot) => {
      if (!instance) {
        const refill = state.players[player].refillAt[slot];
        const waiting = refill !== null ? 'Nachziehen…' : '';
        return `<div class="card-slot empty" aria-label="Leerer Kartenplatz">${waiting}</div>`;
      }
      const card = CARD_BY_ID.get(instance.definitionId)!;
      const cost = effectiveCardCost(state, player, card);
      const surcharged = cost > card.cost;
      const affordable = state.players[player].tokens >= cost;
      return `<button
        class="${cardClass(card)} ${selected === slot ? 'selected' : ''} ${surcharged ? 'surcharged' : ''}"
        data-card data-player="${player}" data-slot="${slot}"
        aria-pressed="${selected === slot}"
        aria-label="${escapeHtml(card.name)}, ${cost} Tokens${surcharged ? ', inklusive 1 Token Aufschlag' : ''}. ${escapeHtml(card.description)}"
      >
        <span class="card-kind">${card.kind === 'attack' ? 'ANGRIFF' : card.kind === 'guard' ? 'VERTEIDIGUNG' : 'SPEZIAL'}</span>
        <strong>${escapeHtml(card.shortName)}</strong>
        <span class="card-zone">${card.zone === 'choice' ? '◆' : card.zone === 'none' ? '✦' : ZONE_SYMBOLS[card.zone]}</span>
        <span class="card-cost ${affordable ? '' : 'too-costly'}">${cost}⚡${surcharged ? '<small>+1</small>' : ''}</span>
      </button>`;
    })
    .join('');
}

function fallbackMarkup(
  state: GameState,
  player: PlayerId,
  selectedSlot: number | null,
  selectedZone: Zone,
): string {
  if (selectedSlot === null) return '<div class="fallback-hint">Karte antippen oder schnippen</div>';
  const card = cardForSlot(state, player, selectedSlot);
  if (!card) return '';
  const chooseLane = card.zone === 'choice';
  const laneButtons = chooseLane
    ? `<div class="lane-choices" aria-label="Ziel wählen">${ZONES.map(
        (zone) =>
          `<button data-choose-zone="${zone}" data-player="${player}" class="${selectedZone === zone ? 'selected' : ''}">${ZONE_SYMBOLS[zone]}</button>`,
      ).join('')}</div>`
    : '';
  return `<div class="fallback-play">
    ${laneButtons}
    <button class="play-button" data-play-selected="${player}">SPIELEN</button>
  </div>`;
}

function fighterMarkup(state: GameState, ui: UiState, player: PlayerId): string {
  const playerLabel = player === 0 ? 'K.I. KLAUS' : 'BOT BRIGITTE';
  const hasSurcharge =
    state.players[player].costPenaltyExpiresAt !== null &&
    state.players[player].costPenaltyExpiresAt! > state.time;
  return `<section class="fighter fighter--${player}" aria-label="Spieler ${player + 1}, ${playerLabel}">
    <div class="fighter-status">
      <div class="fighter-name"><span>MODELL ${player + 1}</span><b>${playerLabel}</b></div>
      <div class="steam" aria-label="${state.players[player].tokens} Tokens">
        <span>TOKENS</span><span class="steam-pips">${tokenMarkup(state.players[player].tokens)}</span>
        ${hasSurcharge ? '<strong class="surcharge-status">+1 NÄCHSTE KARTE</strong>' : ''}
      </div>
    </div>
    <div class="health">${healthMarkup(state, player)}</div>
    <div class="hand">${handMarkup(state, player, ui.selectedSlots[player])}</div>
    ${fallbackMarkup(state, player, ui.selectedSlots[player], ui.selectedZones[player])}
  </section>`;
}

function centerCardMarkup(state: GameState, zone: Zone): string {
  return state.center
    .filter((center) => center.zone === zone)
    .map((center) => {
      const card = CARD_BY_ID.get(center.definitionId)!;
      const deadline = center.status === 'traveling' ? center.landsAt : center.expiresAt!;
      const duration =
        center.status === 'traveling' ? center.landsAt - center.releasedAt : card.durationMs;
      const progress = Math.max(0, Math.min(1, (deadline - state.time) / Math.max(1, duration)));
      return `<div class="center-card ${cardClass(card)} owner-${center.owner} ${center.status}"
        style="--progress:${progress}" aria-label="${escapeHtml(card.name)}, ${Math.ceil((deadline - state.time) / 100) / 10} Sekunden">
        <span>${center.owner === 0 ? '↑' : '↓'}</span>
        <b>${escapeHtml(card.shortName)}</b>
        <i></i>
      </div>`;
    })
    .join('');
}

function arenaMarkup(state: GameState): string {
  const announcements = state.announcements
    .map(
      (item) =>
        `<div class="announcement player-${item.player}" style="grid-column:${ZONES.indexOf(item.zone) + 1}">${escapeHtml(item.text)}</div>`,
    )
    .join('');
  return `<main class="arena" data-arena>
    ${ZONES.map(
      (zone) => `<section class="lane lane--${zone}" data-lane="${zone}">
        <div class="lane-label top">${ZONE_SYMBOLS[zone]} ${ZONE_LABELS[zone]}</div>
        <div class="center-stack">${centerCardMarkup(state, zone)}</div>
        <div class="lane-label bottom">${ZONE_SYMBOLS[zone]} ${ZONE_LABELS[zone]}</div>
      </section>`,
    ).join('')}
    <div class="announcements" aria-live="assertive">${announcements}</div>
    <button class="utility pause" data-pause aria-label="Spiel pausieren">Ⅱ</button>
  </main>`;
}

function setupMarkup(ui: UiState): string {
  const countdown = ui.countdown;
  return `<main class="splash">
    <div class="sunburst"></div>
    <div class="logo">
      <span>ZWEI DEUTSCHE KIs · EIN HANDY · KEINE ZÜGE</span>
      <h1>HAKEN!</h1>
      <p>Der große Token-Krawall</p>
    </div>
    ${
      countdown === null
        ? `<ol class="how-to">
            <li><b>1</b> Kontext, Logik oder Ausgabe zertrümmern</li>
            <li><b>2</b> Tokens laden, Karten schnippen</li>
            <li><b>3</b> Guardrails vor Ablauf platzieren</li>
          </ol>
          <button class="start-button" data-start>LOS GEHT'S!</button>`
        : `<div class="countdown" aria-live="assertive">${countdown === 0 ? 'HAKEN!' : countdown}</div>`
    }
    <p class="rotate-note">Spieler 2 sitzt am oberen Ende</p>
  </main>`;
}

function finishedMarkup(state: GameState): string {
  const result =
    state.result?.winner === null
      ? 'DOPPEL-K.O.'
      : `SPIELER ${(state.result?.winner ?? 0) + 1} GEWINNT!`;
  return `<div class="result-overlay" role="dialog" aria-modal="true">
    <span>DAS WAR'S</span>
    <h2>${result}</h2>
    <button class="start-button" data-restart>NOCHMAL!</button>
  </div>`;
}

export function render(root: HTMLElement, state: GameState, ui: UiState): void {
  if (state.phase === 'setup') {
    root.innerHTML = setupMarkup(ui);
    return;
  }

  root.innerHTML = `<div class="game ${state.phase === 'paused' ? 'is-paused' : ''}">
    ${fighterMarkup(state, ui, 1)}
    ${arenaMarkup(state)}
    ${fighterMarkup(state, ui, 0)}
    <button class="sound-toggle" data-sound aria-label="${ui.muted ? 'Ton einschalten' : 'Ton ausschalten'}">${ui.muted ? '🔇' : '🔊'}</button>
    <div class="landscape-warning"><b>HANDY DREHEN</b><span>Haken spielt man hochkant.</span></div>
    ${
      state.phase === 'paused'
        ? '<div class="pause-overlay"><h2>PAUSE</h2><button class="start-button" data-resume>WEITER!</button></div>'
        : ''
    }
    ${state.phase === 'finished' ? finishedMarkup(state) : ''}
  </div>`;
}
