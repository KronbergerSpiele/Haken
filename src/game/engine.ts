import { BALANCE, CARD_BY_ID, CARD_DEFINITIONS } from './cards';
import {
  ZONES,
  type Announcement,
  type CardDefinition,
  type CardInstance,
  type CenterCard,
  type GameCommand,
  type GameEvent,
  type GameState,
  type PlayerId,
  type PlayerState,
  type Transition,
  type Zone,
} from './types';

const otherPlayer = (player: PlayerId): PlayerId => (player === 0 ? 1 : 0);

function definition(id: string): CardDefinition {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new Error(`Unknown card definition: ${id}`);
  return card;
}

function randomStep(value: number): number {
  let x = value | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0 || 0x9e3779b9;
}

function shuffle<T>(items: T[], rngState: number): { items: T[]; rngState: number } {
  const result = [...items];
  let rng = rngState;
  for (let index = result.length - 1; index > 0; index -= 1) {
    rng = randomStep(rng);
    const target = rng % (index + 1);
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return { items: result, rngState: rng };
}

function createDeck(player: PlayerId, firstPlayer: PlayerId): CardInstance[] {
  const offset = player === firstPlayer ? 0 : 1;
  let cardIndex = 0;
  const deck: CardInstance[] = [];
  for (const card of CARD_DEFINITIONS) {
    for (let copy = 0; copy < card.copies; copy += 1) {
      deck.push({
        instanceId: cardIndex * 2 + offset,
        definitionId: card.id,
      });
      cardIndex += 1;
    }
  }
  return deck;
}

function emptyPlayer(drawPile: CardInstance[]): PlayerState {
  return {
    health: { kontext: BALANCE.zoneHealth, logik: BALANCE.zoneHealth, output: BALANCE.zoneHealth },
    tokens: BALANCE.startingTokens,
    costPenaltyExpiresAt: null,
    drawPile,
    discard: [],
    hand: Array.from({ length: BALANCE.handSize }, () => null),
    refillAt: Array.from({ length: BALANCE.handSize }, () => null),
  };
}

function drawIntoSlot(state: GameState, playerId: PlayerId, slot: number): void {
  const player = state.players[playerId];
  if (player.hand[slot]) return;

  if (player.drawPile.length === 0 && player.discard.length > 0) {
    const shuffled = shuffle(player.discard, state.rngState);
    player.drawPile = shuffled.items;
    player.discard = [];
    state.rngState = shuffled.rngState;
  }

  player.hand[slot] = player.drawPile.pop() ?? null;
  player.refillAt[slot] = null;
}

export function createGame(seed = Date.now() >>> 0, now = 0): GameState {
  const normalizedSeed = seed >>> 0 || 1;
  const firstPlayer: PlayerId = normalizedSeed % 2 === 0 ? 0 : 1;
  const firstShuffle = shuffle(createDeck(0, firstPlayer), normalizedSeed);
  const secondShuffle = shuffle(createDeck(1, firstPlayer), firstShuffle.rngState);
  const state: GameState = {
    phase: 'setup',
    seed: normalizedSeed,
    rngState: secondShuffle.rngState,
    time: now,
    pausedAt: null,
    nextTokenAt: now + BALANCE.tokenIntervalMs,
    players: [emptyPlayer(firstShuffle.items), emptyPlayer(secondShuffle.items)],
    center: [],
    announcements: [],
    result: null,
    nextCenterId: 1,
    nextAnnouncementId: 1,
  };

  for (const player of [0, 1] as const) {
    for (let slot = 0; slot < BALANCE.handSize; slot += 1) drawIntoSlot(state, player, slot);
  }
  return state;
}

function addAnnouncement(
  state: GameState,
  text: string,
  zone: Zone,
  player: PlayerId,
  now: number,
): void {
  const announcement: Announcement = {
    id: state.nextAnnouncementId,
    text,
    zone,
    player,
    expiresAt: now + BALANCE.announcementMs,
  };
  state.nextAnnouncementId += 1;
  state.announcements.push(announcement);
}

function discardCenterCard(state: GameState, center: CenterCard): void {
  state.center = state.center.filter((item) => item.centerId !== center.centerId);
  if (center.card && !center.generated) state.players[center.owner].discard.push(center.card);
}

function oldestAttack(state: GameState, owner: PlayerId, zone: Zone): CenterCard | undefined {
  return state.center
    .filter(
      (center) =>
        center.owner === owner &&
        center.zone === zone &&
        center.status === 'active' &&
        definition(center.definitionId).kind === 'attack',
    )
    .sort((left, right) => left.landsAt - right.landsAt || left.centerId - right.centerId)[0];
}

function applySpecial(
  state: GameState,
  center: CenterCard,
  landedAt: number,
  events: GameEvent[],
): void {
  const card = definition(center.definitionId);
  const enemy = otherPlayer(center.owner);
  let text = 'VERPUFFT';

  if (card.effect === 'counter') {
    const target = oldestAttack(state, enemy, center.zone);
    if (target) {
      discardCenterCard(state, target);
      state.center.push({
        centerId: state.nextCenterId,
        card: null,
        definitionId: 'retour-angriff',
        owner: center.owner,
        zone: center.zone,
        status: 'active',
        releasedAt: landedAt,
        landsAt: landedAt,
        expiresAt: landedAt + BALANCE.returnFuseMs,
        generated: true,
      });
      state.nextCenterId += 1;
      text = 'KONTER';
    }
  } else if (card.effect === 'redirect') {
    const target = oldestAttack(state, enemy, center.zone);
    if (target) {
      const currentIndex = ZONES.indexOf(target.zone);
      const alternatives = [1, 2]
        .map((offset) => ZONES[(currentIndex + offset) % ZONES.length]!)
        .filter((zone) => state.players[center.owner].health[zone] > 0);
      const nextZone = alternatives[0];
      if (nextZone) {
        target.zone = nextZone;
        text = 'UMGELEITET';
      }
    }
  } else if (card.effect === 'haste') {
    const attacks = state.center.filter(
      (item) =>
        item.owner === center.owner &&
        item.status === 'active' &&
        item.expiresAt !== null &&
        definition(item.definitionId).kind === 'attack',
    );
    for (const attack of attacks) {
      attack.expiresAt = Math.max(landedAt + BALANCE.hasteMinimumMs, attack.expiresAt! - BALANCE.hasteMs);
    }
    if (attacks.length > 0) text = 'ZACK';
  } else if (card.effect === 'surcharge') {
    state.players[enemy].costPenaltyExpiresAt =
      landedAt + (card.effectDurationMs ?? BALANCE.surchargeMs);
    text = 'AUFSCHLAG';
  }

  addAnnouncement(state, text, center.zone, center.owner, landedAt);
  events.push({ type: 'special', player: center.owner, zone: center.zone, text });
}

function processResourceTimers(state: GameState, now: number): void {
  while (state.nextTokenAt <= now) {
    for (const player of state.players) {
      player.tokens = Math.min(BALANCE.maxTokens, player.tokens + 1);
    }
    state.nextTokenAt += BALANCE.tokenIntervalMs;
  }

  for (const playerId of [0, 1] as const) {
    const player = state.players[playerId];
    if (player.costPenaltyExpiresAt !== null && player.costPenaltyExpiresAt <= now) {
      player.costPenaltyExpiresAt = null;
    }
    for (let slot = 0; slot < BALANCE.handSize; slot += 1) {
      const refillAt = player.refillAt[slot];
      if (refillAt !== null && refillAt <= now) drawIntoSlot(state, playerId, slot);
    }
  }
}

function processLandings(state: GameState, now: number, events: GameEvent[]): void {
  const landings = state.center
    .filter((card) => card.status === 'traveling' && card.landsAt <= now)
    .sort((left, right) => left.landsAt - right.landsAt || left.centerId - right.centerId);

  for (const center of landings) {
    if (!state.center.some((item) => item.centerId === center.centerId)) continue;
    const card = definition(center.definitionId);
    center.status = 'active';
    center.expiresAt = center.landsAt + card.durationMs;
    events.push({ type: 'landed', player: center.owner, zone: center.zone });
    if (card.kind === 'special') applySpecial(state, center, center.landsAt, events);
  }
}

function processExpiredGuards(state: GameState, now: number): void {
  const expired = state.center.filter((center) => {
    const card = definition(center.definitionId);
    return center.status === 'active' && card.kind === 'guard' && center.expiresAt! <= now;
  });
  for (const guard of expired) discardCenterCard(state, guard);
}

function processAttacks(state: GameState, now: number, events: GameEvent[]): void {
  const damage: Array<{ player: PlayerId; zone: Zone; amount: number }> = [];
  const attacks = state.center
    .filter((center) => {
      const card = definition(center.definitionId);
      return center.status === 'active' && card.kind === 'attack' && center.expiresAt! <= now;
    })
    .sort((left, right) => left.expiresAt! - right.expiresAt! || left.centerId - right.centerId);

  for (const attack of attacks) {
    if (!state.center.some((item) => item.centerId === attack.centerId)) continue;
    const defender = otherPlayer(attack.owner);
    const guard = state.center
      .filter(
        (center) =>
          center.owner === defender &&
          center.zone === attack.zone &&
          center.status === 'active' &&
          definition(center.definitionId).kind === 'guard',
      )
      .sort((left, right) => left.landsAt - right.landsAt || left.centerId - right.centerId)[0];

    if (guard) {
      discardCenterCard(state, guard);
      addAnnouncement(state, 'GEBLOCKT', attack.zone, defender, now);
      events.push({ type: 'blocked', player: defender, zone: attack.zone });
    } else {
      damage.push({
        player: defender,
        zone: attack.zone,
        amount: definition(attack.definitionId).damage ?? 0,
      });
      addAnnouncement(state, 'TREFFER', attack.zone, attack.owner, now);
      events.push({ type: 'hit', player: attack.owner, zone: attack.zone });
    }
    discardCenterCard(state, attack);
  }

  for (const hit of damage) {
    const health = state.players[hit.player].health[hit.zone];
    state.players[hit.player].health[hit.zone] = Math.max(0, health - hit.amount);
  }
}

function processExpiredSpecials(state: GameState, now: number): void {
  const expired = state.center.filter((center) => {
    const card = definition(center.definitionId);
    return center.status === 'active' && card.kind === 'special' && center.expiresAt! <= now;
  });
  for (const special of expired) discardCenterCard(state, special);
}

function checkVictory(state: GameState, events: GameEvent[]): void {
  const broken = state.players.map(
    (player) => ZONES.filter((zone) => player.health[zone] === 0).length,
  );
  const playerZeroWins = broken[1]! >= 2;
  const playerOneWins = broken[0]! >= 2;
  if (!playerZeroWins && !playerOneWins) return;

  state.phase = 'finished';
  state.result =
    playerZeroWins && playerOneWins
      ? { winner: null, reason: 'double-knockout' }
      : { winner: playerZeroWins ? 0 : 1, reason: 'knockout' };
  events.push({ type: 'finished', player: state.result.winner ?? undefined });
}

function tickPlaying(state: GameState, now: number, events: GameEvent[]): void {
  if (now < state.time) return;
  state.time = now;
  state.announcements = state.announcements.filter((item) => item.expiresAt > now);
  processResourceTimers(state, now);
  processLandings(state, now, events);
  processExpiredGuards(state, now);
  processAttacks(state, now, events);
  processExpiredSpecials(state, now);
  checkVictory(state, events);
}

function shiftDeadlines(state: GameState, delta: number): void {
  state.nextTokenAt += delta;
  for (const player of state.players) {
    player.refillAt = player.refillAt.map((deadline) => (deadline === null ? null : deadline + delta));
    if (player.costPenaltyExpiresAt !== null) player.costPenaltyExpiresAt += delta;
  }
  for (const center of state.center) {
    center.landsAt += delta;
    if (center.expiresAt !== null) center.expiresAt += delta;
  }
  for (const announcement of state.announcements) announcement.expiresAt += delta;
}

function resolveZone(card: CardDefinition, requested?: Zone): Zone | null {
  if (card.zone === 'none') return 'logik';
  if (card.zone === 'choice') return requested && ZONES.includes(requested) ? requested : null;
  return card.zone;
}

export function transition(current: GameState, command: GameCommand): Transition {
  const state = structuredClone(current);
  const events: GameEvent[] = [];

  if (command.type === 'start' && state.phase === 'setup') {
    state.phase = 'playing';
    state.time = command.now;
    state.nextTokenAt = command.now + BALANCE.tokenIntervalMs;
    return { state, events };
  }

  if (command.type === 'pause' && state.phase === 'playing') {
    tickPlaying(state, command.now, events);
    if (state.phase === 'playing') {
      state.phase = 'paused';
      state.pausedAt = command.now;
    }
    return { state, events };
  }

  if (command.type === 'resume' && state.phase === 'paused' && state.pausedAt !== null) {
    const delta = Math.max(0, command.now - state.pausedAt);
    shiftDeadlines(state, delta);
    state.phase = 'playing';
    state.pausedAt = null;
    state.time = command.now;
    return { state, events };
  }

  if (command.type === 'tick' && state.phase === 'playing') {
    tickPlaying(state, command.now, events);
    return { state, events };
  }

  if (state.phase !== 'playing' || (command.type !== 'play' && command.type !== 'recycle')) {
    return { state, events };
  }

  tickPlaying(state, command.now, events);
  if (state.phase !== 'playing') return { state, events };
  const player = state.players[command.player];
  const cardInstance = player.hand[command.slot];
  if (!cardInstance) return { state, events };

  if (command.type === 'recycle') {
    player.hand[command.slot] = null;
    player.discard.push(cardInstance);
    player.refillAt[command.slot] = command.now + BALANCE.recycleDelayMs;
    events.push({ type: 'recycled', player: command.player });
    return { state, events };
  }

  const card = definition(cardInstance.definitionId);
  const zone = resolveZone(card, command.zone);
  const cost = effectiveCardCost(state, command.player, card);
  if (!zone || player.tokens < cost) return { state, events };

  const travelMs = Math.max(BALANCE.minTravelMs, Math.min(BALANCE.maxTravelMs, command.travelMs));
  const landsAt = command.now + travelMs;
  player.tokens -= cost;
  player.costPenaltyExpiresAt = null;
  player.hand[command.slot] = null;
  player.refillAt[command.slot] = landsAt + BALANCE.refillDelayMs;
  state.center.push({
    centerId: state.nextCenterId,
    card: cardInstance,
    definitionId: card.id,
    owner: command.player,
    zone,
    status: 'traveling',
    releasedAt: command.now,
    landsAt,
    expiresAt: null,
    generated: false,
  });
  state.nextCenterId += 1;
  events.push({ type: 'played', player: command.player, zone });
  return { state, events };
}

export function cardForSlot(state: GameState, player: PlayerId, slot: number): CardDefinition | null {
  const card = state.players[player].hand[slot];
  return card ? definition(card.definitionId) : null;
}

export function effectiveCardCost(
  state: GameState,
  player: PlayerId,
  card: CardDefinition,
): number {
  const penalty = state.players[player].costPenaltyExpiresAt;
  return card.cost + (penalty !== null && penalty > state.time ? BALANCE.surchargeAmount : 0);
}
