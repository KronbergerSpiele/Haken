import './styles.css';
import { cardForSlot, createGame, playableZones, transition } from './game/engine';
import type { GameCommand, GameEvent, GameState, PlayerId, Zone } from './game/types';
import { FlickController } from './ui/flick-controller';
import { render, type UiState } from './ui/render';

const rootElement = document.querySelector<HTMLElement>('#app');
if (!rootElement) throw new Error('App root is missing');
const root: HTMLElement = rootElement;

let game: GameState = createGame();
const ui: UiState = {
  countdown: null,
  selectedSlots: [null, null],
  selectedZones: ['logik', 'logik'],
  muted: false,
};
let audioContext: AudioContext | null = null;
let countdownTimer: number | null = null;
let lastFrameAt = 0;
let visibilityPaused = false;

function now(): number {
  return performance.now();
}

function feedback(events: GameEvent[]): void {
  if (events.some((event) => event.type === 'hit' || event.type === 'blocked')) {
    navigator.vibrate?.(events.some((event) => event.type === 'hit') ? 45 : 20);
  }
  if (ui.muted || events.length === 0) return;
  const important = events.find((event) =>
    ['hit', 'blocked', 'special', 'finished'].includes(event.type),
  );
  if (!important) return;

  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = important.type === 'hit' ? 'sawtooth' : 'square';
  oscillator.frequency.value =
    important.type === 'finished' ? 220 : important.type === 'hit' ? 105 : 280;
  gain.gain.setValueAtTime(0.06, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.12);
}

function draw(): void {
  render(root, game, ui);
}

function dispatch(command: GameCommand): void {
  const result = transition(game, command);
  game = result.state;
  feedback(result.events);
  draw();
}

function startCountdown(): void {
  if (countdownTimer !== null) window.clearInterval(countdownTimer);
  let value = 3;
  ui.countdown = value;
  draw();
  countdownTimer = window.setInterval(() => {
    value -= 1;
    ui.countdown = value;
    draw();
    if (value <= 0) {
      window.clearInterval(countdownTimer!);
      countdownTimer = null;
      window.setTimeout(() => {
        ui.countdown = null;
        dispatch({ type: 'start', now: now() });
      }, 350);
    }
  }, 650);
}

const flicks = new FlickController(root, {
  canDrag: (player, slot) =>
    game.phase === 'playing' && game.players[player].hand[slot] !== null,
  playableZones: (player, slot) => {
    const card = cardForSlot(game, player, slot);
    return card ? playableZones(card) : [];
  },
  onPlay: (player, slot, zone, travelMs) => {
    ui.selectedSlots[player] = null;
    dispatch({ type: 'play', now: now(), player, slot, zone, travelMs });
  },
  onRecycle: (player, slot) => {
    ui.selectedSlots[player] = null;
    dispatch({ type: 'recycle', now: now(), player, slot });
  },
});

function selectedPlayer(target: HTMLElement): PlayerId {
  return Number(target.dataset.player) as PlayerId;
}

root.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button');
  if (!target) return;

  if (target.matches('[data-start]')) {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    startCountdown();
    return;
  }
  if (target.matches('[data-restart]')) {
    game = createGame((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0, now());
    ui.selectedSlots = [null, null];
    startCountdown();
    return;
  }
  if (target.matches('[data-pause]')) {
    dispatch({ type: 'pause', now: now() });
    return;
  }
  if (target.matches('[data-resume]')) {
    dispatch({ type: 'resume', now: now() });
    return;
  }
  if (target.matches('[data-sound]')) {
    ui.muted = !ui.muted;
    draw();
    return;
  }
  if (target.matches('[data-choose-zone]')) {
    const player = selectedPlayer(target);
    ui.selectedZones[player] = target.dataset.chooseZone as Zone;
    draw();
    return;
  }
  if (target.matches('[data-play-selected]')) {
    const player = Number(target.dataset.playSelected) as PlayerId;
    const slot = ui.selectedSlots[player];
    if (slot !== null) {
      ui.selectedSlots[player] = null;
      dispatch({
        type: 'play',
        now: now(),
        player,
        slot,
        zone: ui.selectedZones[player],
        travelMs: 250,
      });
    }
    return;
  }
  if (target.matches('[data-card]') && !flicks.shouldSuppressClick()) {
    const player = selectedPlayer(target);
    const slot = Number(target.dataset.slot);
    const card = cardForSlot(game, player, slot);
    if (!card) return;
    ui.selectedSlots[player] = ui.selectedSlots[player] === slot ? null : slot;
    if (card.zone !== 'choice' && card.zone !== 'none') ui.selectedZones[player] = card.zone;
    draw();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.phase === 'playing') {
    visibilityPaused = true;
    dispatch({ type: 'pause', now: now() });
  } else if (!document.hidden && visibilityPaused && game.phase === 'paused') {
    visibilityPaused = false;
    dispatch({ type: 'resume', now: now() });
  }
});

function frame(timestamp: number): void {
  if (
    game.phase === 'playing' &&
    !flicks.isDragging &&
    timestamp - lastFrameAt >= 80
  ) {
    lastFrameAt = timestamp;
    const result = transition(game, { type: 'tick', now: timestamp });
    game = result.state;
    feedback(result.events);
    draw();
  }
  requestAnimationFrame(frame);
}

draw();
requestAnimationFrame(frame);
