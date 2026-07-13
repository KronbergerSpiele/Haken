import './styles.css';
import type { GameCommand, GameSession, SessionContext } from '@spiele/engine/contracts';
import { feedbackFromEvents } from '@spiele/graphics/feedback';
import { mountCollectionExit } from '@spiele/ui';
import { applyHakenTokens } from './theme';
import { FlickController } from './controls';
import { cardForSlot, createGame, playableZones, transition } from './reducer';
import type { GameCommand as HakenCommand, GameEvent, GameState, PlayerId, Zone } from './model';
import { render, type UiState } from './view';

export class HakenSession implements GameSession {
  private game: GameState;
  private readonly ui: UiState = {
    countdown: null,
    selectedSlots: [null, null],
    selectedZones: ['logik', 'logik'],
    muted: false,
  };
  private root: HTMLElement | null = null;
  private flicks: FlickController | null = null;
  private countdownTimer: number | null = null;
  private lastFrameAt = 0;
  private disposed = false;
  private readonly clickHandler: (event: Event) => void;
  private readonly exitListener: () => void;

  constructor(private readonly context: SessionContext) {
    this.game = createGame(context.seed, 0);
    this.ui.muted = context.feedback.muted;
    this.clickHandler = (event) => this.handleClick(event);
    this.exitListener = () => this.context.requestExit();
  }

  mount(root: HTMLElement): void {
    if (this.disposed) return;
    this.root = root;
    applyHakenTokens(root);
    this.context.graphics.applyThemeScope(root, 'haken');
    this.context.input.attach(root);

    this.flicks = new FlickController(root, {
      canDrag: (player, slot) =>
        this.game.phase === 'playing' && this.game.players[player].hand[slot] !== null,
      playableZones: (player, slot) => {
        const card = cardForSlot(this.game, player, slot);
        return card ? playableZones(card) : [];
      },
      onPlay: (player, slot, zone, travelMs) => {
        this.ui.selectedSlots[player] = null;
        this.dispatchHaken({ type: 'play', now: this.now(), player, slot, zone, travelMs });
      },
    });

    root.addEventListener('click', this.clickHandler);
    root.addEventListener('spiele-exit', this.exitListener);
    mountCollectionExit(root);
    this.draw();
  }

  dispatch(command: GameCommand): void {
    if (command.type === 'exit') this.context.requestExit();
  }

  advance(timestamp: number): void {
    if (
      this.disposed ||
      this.game.phase !== 'playing' ||
      !this.flicks ||
      this.flicks.isDragging ||
      timestamp - this.lastFrameAt < 80
    ) {
      return;
    }
    this.lastFrameAt = timestamp;
    this.dispatchHaken({ type: 'tick', now: timestamp });
  }

  pause(at: number): void {
    if (this.game.phase === 'playing') {
      this.dispatchHaken({ type: 'pause', now: at });
    }
  }

  resume(at: number): void {
    if (this.game.phase === 'paused') {
      this.dispatchHaken({ type: 'resume', now: at });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.countdownTimer !== null) window.clearInterval(this.countdownTimer);
    this.countdownTimer = null;
    this.root?.removeEventListener('click', this.clickHandler);
    this.root?.removeEventListener('spiele-exit', this.exitListener);
    this.flicks = null;
    this.context.input.detach();
    this.context.effects.cancelAll();
    if (this.root) {
      this.context.graphics.clearThemeScope(this.root);
      this.root.replaceChildren();
    }
    this.root = null;
  }

  private now(): number {
    return this.context.clock.now();
  }

  private dispatchHaken(command: HakenCommand): void {
    const result = transition(this.game, command);
    this.game = result.state;
    this.handleEvents(result.events);
    this.draw();
  }

  private handleEvents(events: GameEvent[]): void {
    feedbackFromEvents(this.context.feedback, events);
    for (const event of events) {
      if (event.type === 'hit') this.context.effects.play('impact', this.root);
      if (event.type === 'blocked') this.context.effects.play('block', this.root);
      if (event.type === 'finished') this.context.effects.play('celebrate', this.root);
    }
  }

  private draw(): void {
    if (!this.root || this.disposed) return;
    render(this.root, this.game, this.ui);
  }

  private requestFullscreenBestEffort(): void {
    try {
      void Promise.resolve(document.documentElement.requestFullscreen?.()).catch(() => undefined);
    } catch {
      // Fullscreen is optional; refusal or API quirks must not block play.
    }
  }

  private startCountdown(): void {
    if (this.countdownTimer !== null) window.clearInterval(this.countdownTimer);
    let value = 3;
    this.ui.countdown = value;
    this.draw();
    this.countdownTimer = window.setInterval(() => {
      value -= 1;
      this.ui.countdown = value;
      this.draw();
      if (value <= 0) {
        window.clearInterval(this.countdownTimer!);
        this.countdownTimer = null;
        window.setTimeout(() => {
          this.ui.countdown = null;
          this.dispatchHaken({ type: 'start', now: this.now() });
        }, 350);
      }
    }, 650);
  }

  private handleClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target || !this.root) return;

    if (target.matches('[data-start]')) {
      this.startCountdown();
      this.requestFullscreenBestEffort();
      return;
    }
    if (target.matches('[data-restart]')) {
      this.game = createGame((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0, this.now());
      this.ui.selectedSlots = [null, null];
      this.startCountdown();
      return;
    }
    if (target.matches('[data-pause]')) {
      this.dispatchHaken({ type: 'pause', now: this.now() });
      return;
    }
    if (target.matches('[data-resume]')) {
      this.dispatchHaken({ type: 'resume', now: this.now() });
      return;
    }
    if (target.matches('[data-sound]')) {
      this.ui.muted = !this.ui.muted;
      this.context.feedback.muted = this.ui.muted;
      this.draw();
      return;
    }
    if (target.matches('[data-choose-zone]')) {
      const player = this.selectedPlayer(target);
      this.ui.selectedZones[player] = target.dataset.chooseZone as Zone;
      this.draw();
      return;
    }
    if (target.matches('[data-play-selected]')) {
      const player = Number(target.dataset.playSelected) as PlayerId;
      const slot = this.ui.selectedSlots[player];
      if (slot !== null) {
        const card = cardForSlot(this.game, player, slot);
        if (!card) return;
        const zones = playableZones(card);
        const zone = zones.length === 1 ? zones[0]! : this.ui.selectedZones[player];
        this.ui.selectedSlots[player] = null;
        this.dispatchHaken({
          type: 'play',
          now: this.now(),
          player,
          slot,
          zone,
          travelMs: 250,
        });
      }
      return;
    }
    if (target.matches('[data-card]') && !this.flicks?.shouldSuppressClick()) {
      const player = this.selectedPlayer(target);
      const slot = Number(target.dataset.slot);
      const card = cardForSlot(this.game, player, slot);
      if (!card) return;
      this.ui.selectedSlots[player] = this.ui.selectedSlots[player] === slot ? null : slot;
      this.draw();
    }
  }

  private selectedPlayer(target: HTMLElement): PlayerId {
    return Number(target.dataset.player) as PlayerId;
  }
}

export function createHakenSession(context: SessionContext): GameSession {
  return new HakenSession(context);
}
