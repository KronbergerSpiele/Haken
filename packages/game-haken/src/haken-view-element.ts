import { html, nothing } from 'lit';
import { LightDomElement } from '@spiele/ui';
import { BALANCE, CARD_BY_ID, ZONE_LABELS, ZONE_SYMBOLS } from './cards';
import { defineHakenElement } from './define';
import {
  cardGraphic,
  fighterAvatar,
  impactGraphic,
  zoneDoodle,
  type AvatarMood,
} from './graphics';
import { cardForSlot } from './reducer';
import { ZONES, type CardDefinition, type GameState, type PlayerId, type Zone } from './model';

export interface UiState {
  countdown: number | null;
  selectedSlots: [number | null, number | null];
  selectedZones: [Zone, Zone];
  muted: boolean;
}

export const HAKEN_VIEW_TAG = 'spiele-haken-view';

function cardClass(card: CardDefinition): string {
  return `card card--${card.kind}`;
}

function cardZoneLabel(card: CardDefinition): string {
  return card.zone === 'choice' ? '◆' : ZONE_SYMBOLS[card.zone];
}

function avatarReaction(
  state: GameState,
  player: PlayerId,
): { mood: AvatarMood; age: number } {
  for (let index = state.announcements.length - 1; index >= 0; index -= 1) {
    const announcement = state.announcements[index];
    const age = Math.max(
      0,
      state.time - (announcement.expiresAt - BALANCE.announcementMs),
    );
    if (announcement.text === 'TREFFER') {
      return { mood: announcement.player === player ? 'action' : 'hit', age };
    }
    if (announcement.text === 'GEBLOCKT') {
      return { mood: announcement.player === player ? 'block' : 'bonk', age };
    }
    if (announcement.player === player) return { mood: 'action', age };
  }
  return { mood: 'ready', age: state.time % 4_200 };
}

function healthTemplate(state: GameState, player: PlayerId) {
  return ZONES.map((zone) => {
    const health = state.players[player].health[zone];
    return html`<div class="health-zone ${health === 0 ? 'broken' : ''}">
      <span aria-hidden="true">${ZONE_SYMBOLS[zone]}</span>
      <b>${ZONE_LABELS[zone]}</b>
      <span class="health-pips" aria-label="${health} von ${BALANCE.zoneHealth}">
        ${Array.from(
          { length: BALANCE.zoneHealth },
          (_, index) => html`<i class=${index < health ? 'full' : ''}></i>`,
        )}
      </span>
    </div>`;
  });
}

function tokenTemplate(tokens: number) {
  return Array.from({ length: BALANCE.maxTokens }, (_, index) =>
    html`<i class=${index < tokens ? 'full' : ''}></i>`,
  );
}

function handTemplate(
  state: GameState,
  player: PlayerId,
  selected: number | null,
) {
  return state.players[player].hand.map((instance, slot) => {
    if (!instance) {
      const refill = state.players[player].refillAt[slot];
      const waiting = refill !== null ? 'Nachziehen…' : '';
      return html`<div class="card-slot empty" aria-label="Leerer Kartenplatz">${waiting}</div>`;
    }
    const card = CARD_BY_ID.get(instance.definitionId)!;
    const affordable = state.players[player].tokens >= card.cost;
    return html`<button
      class="${cardClass(card)} ${selected === slot ? 'selected' : ''}"
      data-card
      data-player=${player}
      data-slot=${slot}
      aria-pressed=${selected === slot}
      aria-label="${card.name}, ${card.cost} Tokens. ${card.description}"
    >
      <span class="card-kind">${card.kind === 'attack' ? 'ANGRIFF' : 'VERTEIDIGUNG'}</span>
      ${cardGraphic(card)}
      <strong>${card.shortName}</strong>
      <span class="card-zone">${cardZoneLabel(card)}</span>
      <span class="card-cost ${affordable ? '' : 'too-costly'}">${card.cost}⚡</span>
    </button>`;
  });
}

function fallbackTemplate(
  state: GameState,
  player: PlayerId,
  selectedSlot: number | null,
  selectedZone: Zone,
) {
  if (selectedSlot === null) {
    return html`<div class="fallback-hint">Karte antippen oder schnippen</div>`;
  }
  const card = cardForSlot(state, player, selectedSlot);
  if (!card) return nothing;
  const laneButtons =
    card.zone === 'choice'
      ? html`<div class="lane-choices" aria-label="Ziel wählen">
          ${ZONES.map(
            (zone) => html`<button
              data-choose-zone=${zone}
              data-player=${player}
              class=${selectedZone === zone ? 'selected' : ''}
            >
              ${ZONE_SYMBOLS[zone]}
            </button>`,
          )}
        </div>`
      : html`<span class="fallback-target"
          >Ziel: ${ZONE_SYMBOLS[card.zone]} ${ZONE_LABELS[card.zone]}</span
        >`;
  return html`<div class="fallback-play">
    ${laneButtons}
    <button class="play-button" data-play-selected=${player}>SPIELEN</button>
  </div>`;
}

function fighterTemplate(state: GameState, ui: UiState, player: PlayerId) {
  const playerLabel = player === 0 ? 'K.I. KLAUS' : 'BOT BRIGITTE';
  const reaction = avatarReaction(state, player);
  return html`<section
    class="fighter fighter--${player}"
    aria-label="Spieler ${player + 1}, ${playerLabel}"
  >
    <div class="fighter-status">
      <div class="fighter-identity">
        ${fighterAvatar(player, reaction.mood, reaction.age)}
        <div class="fighter-name">
          <span>MODELL ${player + 1}</span><b>${playerLabel}</b>
        </div>
      </div>
      <div class="steam" aria-label="${state.players[player].tokens} Tokens">
        <span>TOKENS</span><span class="steam-pips">${tokenTemplate(state.players[player].tokens)}</span>
      </div>
    </div>
    <div class="health">${healthTemplate(state, player)}</div>
    <div class="hand">${handTemplate(state, player, ui.selectedSlots[player])}</div>
    ${fallbackTemplate(
      state,
      player,
      ui.selectedSlots[player],
      ui.selectedZones[player],
    )}
  </section>`;
}

function centerCardTemplate(state: GameState, zone: Zone) {
  return state.center
    .filter((center) => center.zone === zone)
    .map((center) => {
      const card = CARD_BY_ID.get(center.definitionId)!;
      const deadline = center.status === 'traveling' ? center.landsAt : center.expiresAt!;
      const duration =
        center.status === 'traveling' ? center.landsAt - center.releasedAt : card.durationMs;
      const progress = Math.max(0, Math.min(1, (deadline - state.time) / Math.max(1, duration)));
      return html`<div
        class="center-card ${cardClass(card)} owner-${center.owner} ${center.status}"
        style=${`--progress:${progress}`}
        aria-label="${card.name}, ${Math.ceil((deadline - state.time) / 100) / 10} Sekunden"
      >
        <span>${center.owner === 0 ? '↑' : '↓'}</span>
        ${cardGraphic(card)}
        <b>${card.shortName}</b>
        <i></i>
      </div>`;
    });
}

function arenaTemplate(state: GameState) {
  return html`<main class="arena" data-arena>
    ${ZONES.map(
      (zone) => html`<section class="lane lane--${zone}" data-lane=${zone}>
        <div class="lane-label top">${ZONE_SYMBOLS[zone]} ${ZONE_LABELS[zone]}</div>
        ${zoneDoodle(zone)}
        <div class="center-stack">${centerCardTemplate(state, zone)}</div>
        <div class="lane-label bottom">${ZONE_SYMBOLS[zone]} ${ZONE_LABELS[zone]}</div>
      </section>`,
    )}
    <div class="announcements" aria-live="assertive">
      ${state.announcements.map(
        (item) => html`<div
          class="announcement player-${item.player}"
          style=${`grid-column:${ZONES.indexOf(item.zone) + 1}`}
        >
          ${impactGraphic(item.text)}
          <span>${item.text}</span>
        </div>`,
      )}
    </div>
    <button class="utility pause" data-pause aria-label="Spiel pausieren">Ⅱ</button>
  </main>`;
}

function setupTemplate(ui: UiState) {
  const countdown = ui.countdown;
  return html`<main class="splash">
    <div class="sunburst"></div>
    <div class="splash-bots" aria-hidden="true">
      ${fighterAvatar(0)}
      <span class="splash-zap">VS</span>
      ${fighterAvatar(1)}
    </div>
    <div class="logo">
      <span>ZWEI DEUTSCHE KIs · EIN HANDY · KEINE ZÜGE</span>
      <h1>HAKEN!</h1>
      <p>Der große Token-Krawall</p>
    </div>
    ${countdown === null
      ? html`<ol class="how-to">
            <li><b>1</b> Zertrümmere zwei gegnerische Zonen</li>
            <li><b>2</b> Farbe und Symbol zeigen die Zielspur</li>
            <li><b>3</b> Freie Wahl ist flexibel, aber teurer</li>
          </ol>
          <button class="start-button" data-start>LOS GEHT'S!</button>`
      : html`<div class="countdown" aria-live="assertive">${countdown === 0 ? 'HAKEN!' : countdown}</div>`}
    <p class="rotate-note">Spieler 2 sitzt am oberen Ende</p>
  </main>`;
}

function finishedTemplate(state: GameState) {
  const winner = state.result?.winner;
  const result =
    winner === null ? 'DOPPEL-K.O.' : `SPIELER ${(winner ?? 0) + 1} GEWINNT!`;
  const resultGraphic =
    winner === null
      ? html`<div class="result-bots">
          ${fighterAvatar(0, 'bonk')}${fighterAvatar(1, 'bonk')}
        </div>`
      : html`<div class="result-bots">
          ${fighterAvatar(winner ?? 0, 'winner')}<span class="result-crown">♛</span>
        </div>`;
  return html`<div class="result-overlay" role="dialog" aria-modal="true">
    <span>DAS WAR'S</span>
    ${resultGraphic}
    <h2>${result}</h2>
    <button class="start-button" data-restart>NOCHMAL!</button>
  </div>`;
}

function playTemplate(state: GameState, ui: UiState) {
  return html`<div class="game ${state.phase === 'paused' ? 'is-paused' : ''}">
    ${fighterTemplate(state, ui, 1)}
    ${arenaTemplate(state)}
    ${fighterTemplate(state, ui, 0)}
    <button
      class="sound-toggle"
      data-sound
      aria-label=${ui.muted ? 'Ton einschalten' : 'Ton ausschalten'}
    >
      ${ui.muted ? '🔇' : '🔊'}
    </button>
    <div class="landscape-warning">
      <b>HANDY DREHEN</b><span>Haken spielt man hochkant.</span>
    </div>
    ${state.phase === 'paused'
      ? html`<div class="pause-overlay">
          <h2>PAUSE</h2>
          <button class="start-button" data-resume>WEITER!</button>
        </div>`
      : nothing}
    ${state.phase === 'finished' ? finishedTemplate(state) : nothing}
  </div>`;
}

export class HakenViewElement extends LightDomElement {
  static override properties = {
    state: { attribute: false, hasChanged: () => true },
    ui: { attribute: false, hasChanged: () => true },
  };

  declare state: GameState;
  declare ui: UiState;

  override render() {
    if (this.state.phase === 'setup') {
      return setupTemplate(this.ui);
    }
    return playTemplate(this.state, this.ui);
  }

  applyView(state: GameState, ui: UiState): void {
    this.state = state;
    this.ui = ui;
    this.requestUpdate();
    if (this.isUpdatePending) {
      this.performUpdate();
    }
  }
}

export function registerHakenViewElement(): void {
  defineHakenElement(HAKEN_VIEW_TAG, HakenViewElement);
}

declare global {
  interface HTMLElementTagNameMap {
    [HAKEN_VIEW_TAG]: HakenViewElement;
  }
}
