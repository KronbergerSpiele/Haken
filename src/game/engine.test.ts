import { describe, expect, it } from 'vitest';
import { CARD_BY_ID } from './cards';
import { createGame, transition } from './engine';
import type { CardInstance, GameState, PlayerId, Zone } from './types';

let testInstanceId = 10_000;

function started(seed = 2): GameState {
  return transition(createGame(seed, 0), { type: 'start', now: 0 }).state;
}

function stage(state: GameState, player: PlayerId, definitionId: string, slot = 0): void {
  state.players[player].hand[slot] = {
    instanceId: testInstanceId,
    definitionId,
  };
  testInstanceId += 1;
}

function play(
  state: GameState,
  player: PlayerId,
  definitionId: string,
  now = 0,
  zone: Zone = 'bauch',
  slot = 0,
): GameState {
  stage(state, player, definitionId, slot);
  return transition(state, {
    type: 'play',
    now,
    player,
    slot,
    zone,
    travelMs: 180,
  }).state;
}

function totalCards(state: GameState, player: PlayerId): number {
  const ownCenterCards = state.center.filter((card) => card.owner === player && card.card).length;
  return (
    state.players[player].drawPile.length +
    state.players[player].discard.length +
    state.players[player].hand.filter(Boolean).length +
    ownCenterCards
  );
}

describe('game setup', () => {
  it('builds identical twenty-card decks and four-card hands', () => {
    const state = createGame(42);
    expect(totalCards(state, 0)).toBe(20);
    expect(totalCards(state, 1)).toBe(20);
    expect(state.players[0].hand).toHaveLength(4);
    expect([...CARD_BY_ID.values()].reduce((sum, card) => sum + card.copies, 0)).toBe(20);
  });

  it('reproduces shuffled hands from the same seed', () => {
    expect(createGame(123).players.map((player) => player.hand)).toEqual(
      createGame(123).players.map((player) => player.hand),
    );
    expect(createGame(123).players[0].hand).not.toEqual(createGame(124).players[0].hand);
  });
});

describe('simultaneous play and resources', () => {
  it('accepts cards from both players at the same timestamp', () => {
    let state = started();
    state = play(state, 0, 'kopfnuss', 100, 'kopf');
    state = play(state, 1, 'bauchklatscher', 100, 'bauch');

    expect(state.center).toHaveLength(2);
    expect(state.center.map((card) => card.owner).sort()).toEqual([0, 1]);
    expect(state.players[0].steam).toBe(1);
    expect(state.players[1].steam).toBe(1);
  });

  it('rejects unaffordable cards without changing the slot', () => {
    const state = started();
    state.players[0].steam = 3;
    stage(state, 0, 'doppelwumms');
    const card = state.players[0].hand[0];
    const next = transition(state, {
      type: 'play',
      now: 0,
      player: 0,
      slot: 0,
      zone: 'kopf',
      travelMs: 180,
    }).state;

    expect(next.center).toHaveLength(0);
    expect(next.players[0].hand[0]).toEqual(card);
    expect(next.players[0].steam).toBe(3);
  });

  it('regenerates Dampf and refills recycled slots', () => {
    const state = started();
    const recycled = transition(state, { type: 'recycle', now: 0, player: 0, slot: 0 }).state;
    expect(recycled.players[0].hand[0]).toBeNull();
    const next = transition(recycled, { type: 'tick', now: 1_800 }).state;
    expect(next.players[0].hand[0]).not.toBeNull();
    expect(next.players[0].steam).toBe(5);
  });
});

describe('center resolution', () => {
  it('uses the oldest matching guard to block an attack', () => {
    let state = started();
    state = play(state, 1, 'dickschaedel', 0, 'kopf');
    state = play(state, 0, 'kopfnuss', 0, 'kopf');
    state = transition(state, { type: 'tick', now: 2_000 }).state;

    expect(state.players[1].health.kopf).toBe(3);
    expect(state.center).toHaveLength(0);
    expect(state.announcements.some((item) => item.text === 'GEBLOCKT')).toBe(true);
  });

  it('applies unblocked damage after the attack fuse', () => {
    let state = started();
    state.players[0].steam = 6;
    state = play(state, 0, 'doppelwumms', 0, 'beine');
    state = transition(state, { type: 'tick', now: 2_781 }).state;
    expect(state.players[1].health.beine).toBe(1);
  });

  it('counters an armed attack with a generated return attack', () => {
    let state = play(started(), 0, 'kopfnuss', 0, 'kopf');
    state = transition(state, { type: 'tick', now: 180 }).state;
    state.players[1].steam = 6;
    state = play(state, 1, 'retourkutsche', 200, 'kopf');
    state = transition(state, { type: 'tick', now: 380 }).state;

    expect(state.center.some((card) => card.definitionId === 'kopfnuss')).toBe(false);
    expect(
      state.center.some((card) => card.definitionId === 'retour-angriff' && card.owner === 1),
    ).toBe(true);
  });

  it('redirects the oldest attack to the next healthy zone', () => {
    let state = play(started(), 0, 'kopfnuss', 0, 'kopf');
    state = transition(state, { type: 'tick', now: 180 }).state;
    state = play(state, 1, 'ablenkung', 200, 'kopf');
    state = transition(state, { type: 'tick', now: 380 }).state;

    expect(state.center.find((card) => card.definitionId === 'kopfnuss')?.zone).toBe('bauch');
  });

  it('hastens active friendly attacks but leaves at least 300 ms', () => {
    let state = play(started(), 0, 'kopfnuss', 0, 'kopf');
    state = transition(state, { type: 'tick', now: 180 }).state;
    state.players[0].steam = 6;
    state = play(state, 0, 'jetzt-erst-recht', 200, 'bauch', 1);
    state = transition(state, { type: 'tick', now: 380 }).state;

    expect(state.center.find((card) => card.definitionId === 'kopfnuss')?.expiresAt).toBe(1_380);
  });

  it('applies simultaneous lethal damage as a double knockout', () => {
    const state = started();
    state.players[0].health.kopf = 0;
    state.players[0].health.bauch = 1;
    state.players[1].health.kopf = 0;
    state.players[1].health.bauch = 1;
    const cards: CardInstance[] = [
      { instanceId: 80_000, definitionId: 'kopfnuss' },
      { instanceId: 80_001, definitionId: 'kopfnuss' },
    ];
    state.center = cards.map((card, index) => ({
      centerId: index + 1,
      card,
      definitionId: card.definitionId,
      owner: index as PlayerId,
      zone: 'bauch',
      status: 'active',
      releasedAt: 0,
      landsAt: 0,
      expiresAt: 100,
      generated: false,
    }));

    const finished = transition(state, { type: 'tick', now: 100 }).state;
    expect(finished.phase).toBe('finished');
    expect(finished.result).toEqual({ winner: null, reason: 'double-knockout' });
  });
});

describe('pause behavior', () => {
  it('shifts every active deadline by the paused duration', () => {
    let state = play(started(), 0, 'kopfnuss', 0, 'kopf');
    state = transition(state, { type: 'pause', now: 100 }).state;
    state = transition(state, { type: 'resume', now: 1_100 }).state;

    expect(state.center[0]?.landsAt).toBe(1_180);
    state = transition(state, { type: 'tick', now: 1_179 }).state;
    expect(state.center[0]?.status).toBe('traveling');
  });
});
