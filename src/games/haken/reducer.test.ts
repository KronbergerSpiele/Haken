import { describe, expect, it } from 'vitest';
import { CARD_BY_ID } from './cards';
import { createGame, playableZones, transition } from './reducer';
import type { CardInstance, GameState, PlayerId, Zone } from './model';

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
  zone: Zone = 'logik',
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
  it('builds identical twenty-two-card decks and four-card hands', () => {
    const state = createGame(42);
    expect(totalCards(state, 0)).toBe(22);
    expect(totalCards(state, 1)).toBe(22);
    expect(state.players[0].hand).toHaveLength(4);
    expect([...CARD_BY_ID.values()].reduce((sum, card) => sum + card.copies, 0)).toBe(22);
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
    state = play(state, 0, 'kontext-kollaps', 100, 'kontext');
    state = play(state, 1, 'denkfehler', 100, 'logik');

    expect(state.center).toHaveLength(2);
    expect(state.center.map((card) => card.owner).sort()).toEqual([0, 1]);
    expect(state.players[0].tokens).toBe(1);
    expect(state.players[1].tokens).toBe(1);
  });

  it('rejects unaffordable cards without changing the slot', () => {
    const state = started();
    state.players[0].tokens = 3;
    stage(state, 0, 'tokensturm');
    const card = state.players[0].hand[0];
    const next = transition(state, {
      type: 'play',
      now: 0,
      player: 0,
      slot: 0,
      zone: 'kontext',
      travelMs: 180,
    }).state;

    expect(next.center).toHaveLength(0);
    expect(next.players[0].hand[0]).toEqual(card);
    expect(next.players[0].tokens).toBe(3);
  });

  it('only exposes and accepts the printed lane for fixed-zone cards', () => {
    const state = started();
    const card = CARD_BY_ID.get('kontext-kollaps')!;
    expect(playableZones(card)).toEqual(['kontext']);
    stage(state, 0, card.id);
    const stagedCard = state.players[0].hand[0];

    const next = transition(state, {
      type: 'play',
      now: 0,
      player: 0,
      slot: 0,
      zone: 'output',
      travelMs: 180,
    }).state;

    expect(next.center).toHaveLength(0);
    expect(next.players[0].hand[0]).toEqual(stagedCard);
    expect(next.players[0].tokens).toBe(3);
  });

  it.each<Zone>(['kontext', 'logik', 'output'])(
    'allows a choice card to target the %s zone',
    (zone) => {
      const state = started();
      state.players[0].tokens = 6;
      const next = play(state, 0, 'tokensturm', 0, zone);

      expect(next.center[0]?.zone).toBe(zone);
    },
  );

  it('regenerates tokens and refills played slots', () => {
    const played = play(started(), 0, 'denkfehler', 0, 'logik');
    expect(played.players[0].hand[0]).toBeNull();
    const next = transition(played, { type: 'tick', now: 2_400 }).state;
    expect(next.players[0].hand[0]).not.toBeNull();
    expect(next.players[0].tokens).toBe(3);
  });
});

describe('center resolution', () => {
  it('uses the oldest matching guard to block an attack', () => {
    let state = started();
    state = play(state, 1, 'kontext-puffer', 0, 'kontext');
    state = play(state, 0, 'kontext-kollaps', 0, 'kontext');
    state = transition(state, { type: 'tick', now: 3_000 }).state;

    expect(state.players[1].health.kontext).toBe(3);
    expect(state.center).toHaveLength(0);
    expect(state.announcements.some((item) => item.text === 'GEBLOCKT')).toBe(true);
  });

  it('places the wildcard guard in any selected zone', () => {
    let state = started();
    state = play(state, 1, 'bundes-guardrail', 0, 'output');
    state = play(state, 0, 'output-salat', 0, 'output');
    state = transition(state, { type: 'tick', now: 2_500 }).state;

    expect(state.players[1].health.output).toBe(3);
    expect(state.announcements.some((item) => item.text === 'GEBLOCKT')).toBe(true);
  });

  it('applies unblocked damage after the attack fuse', () => {
    let state = started();
    state.players[0].tokens = 6;
    state = play(state, 0, 'tokensturm', 0, 'output');
    state = transition(state, { type: 'tick', now: 4_121 }).state;
    expect(state.players[1].health.output).toBe(1);
  });

  it('applies simultaneous lethal damage as a double knockout', () => {
    const state = started();
    state.players[0].health.kontext = 0;
    state.players[0].health.logik = 1;
    state.players[1].health.kontext = 0;
    state.players[1].health.logik = 1;
    const cards: CardInstance[] = [
      { instanceId: 80_000, definitionId: 'kontext-kollaps' },
      { instanceId: 80_001, definitionId: 'kontext-kollaps' },
    ];
    state.center = cards.map((card, index) => ({
      centerId: index + 1,
      card,
      definitionId: card.definitionId,
      owner: index as PlayerId,
      zone: 'logik',
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
    let state = play(started(), 0, 'kontext-kollaps', 0, 'kontext');
    state = transition(state, { type: 'pause', now: 100 }).state;
    state = transition(state, { type: 'resume', now: 1_100 }).state;

    expect(state.center[0]?.landsAt).toBe(1_220);
    state = transition(state, { type: 'tick', now: 1_219 }).state;
    expect(state.center[0]?.status).toBe('traveling');
  });
});
