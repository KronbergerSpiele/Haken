import type { GameCommand, GameSession, SessionContext } from '../../engine/contracts';
import { applyZoffTokens } from '../../graphics/theme';
import { ZoffDragController } from './controls';
import { canPlacePendingAt, createGame, getVisibleDiscard, transition } from './reducer';
import type { GameCommand as ZoffCommand, GameEvent, GameState, PlayerId } from './model';
import {
  INITIAL_UI,
  applyPresentationClasses,
  countRemovedCards,
  formatChainEvent,
  render,
  type UiState,
} from './view';

export class ZoffSession implements GameSession {
  private game: GameState;
  private ui: UiState = { ...INITIAL_UI };
  private root: HTMLElement | null = null;
  private disposed = false;
  private matchRemovedCards = 0;
  private focusResultReplay = false;
  private drag: ZoffDragController | null = null;
  private flipTimer: number | null = null;
  private readonly clickHandler: (event: Event) => void;
  private readonly keyHandler: (event: KeyboardEvent) => void;

  constructor(private readonly context: SessionContext) {
    this.game = createGame(context.seed);
    this.clickHandler = (event) => this.handleClick(event);
    this.keyHandler = (event) => this.handleKey(event);
  }

  mount(root: HTMLElement): void {
    if (this.disposed) return;
    this.root = root;
    applyZoffTokens(root);
    this.context.graphics.applyThemeScope(root, 'zoff-in-the-sky');
    this.context.input.attach(root);
    root.addEventListener('click', this.clickHandler);
    root.addEventListener('keydown', this.keyHandler);
    this.drag = new ZoffDragController(root, {
      canDragDeck: () =>
        this.ui.handoffConfirmed &&
        this.game.phase !== 'finished' &&
        (this.game.phase === 'awaitingAction' || this.game.phase === 'finalTurn'),
      canDragDiscard: () => {
        if (!this.ui.handoffConfirmed || this.game.phase === 'finished') return false;
        if (this.game.phase !== 'awaitingAction' && this.game.phase !== 'finalTurn') return false;
        return getVisibleDiscard(this.game) !== null;
      },
      onDrawStart: () => {
        this.clearEatingOverlay();
        this.dispatchZoff({ type: 'draw', player: this.game.activePlayer });
      },
      onTakeDiscardStart: () => {
        this.clearEatingOverlay();
        this.dispatchZoff({ type: 'takeDiscard', player: this.game.activePlayer });
      },
      onPlace: (row, col) => {
        this.clearEatingOverlay();
        this.dispatchZoff({
          type: 'place',
          player: this.game.activePlayer,
          row,
          col,
        });
      },
      isPlaceable: (row, col) => canPlacePendingAt(this.game, this.game.activePlayer, row, col),
      getPendingSpecies: () => this.game.pendingCard?.card.species ?? null,
      getPendingSource: () => {
        const source = this.game.pendingCard?.source;
        return source === 'draw' || source === 'discard' ? source : null;
      },
      isDiscardRevealMode: () => this.ui.discardRevealMode,
    });
    this.draw();
  }

  dispatch(command: GameCommand): void {
    if (command.type === 'exit') this.context.requestExit();
  }

  advance(_now: number): void {
    // Turn-based: no simulation clock.
  }

  pause(_at: number): void {
    // No-op for turn-based play.
  }

  resume(_at: number): void {
    // No-op for turn-based play.
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearFlipTimer();
    this.drag?.dispose();
    this.drag = null;
    this.root?.removeEventListener('click', this.clickHandler);
    this.root?.removeEventListener('keydown', this.keyHandler);
    this.context.input.detach();
    this.context.effects.cancelAll();
    if (this.root) {
      this.context.graphics.clearThemeScope(this.root);
      this.root.replaceChildren();
      this.root.classList.remove('zoff-root--handoff', 'zoff-root--playing', 'zoff-root--turn-flip');
    }
    this.root = null;
  }

  private draw(): void {
    if (!this.root || this.disposed) return;
    render(this.root, this.game, this.ui);
    applyPresentationClasses(this.root, this.game, this.ui);
    this.ensureCollectionButton();
    if (this.focusResultReplay) {
      this.focusResultReplay = false;
      this.root.querySelector<HTMLButtonElement>('[data-restart]')?.focus();
    }
  }

  private ensureCollectionButton(): void {
    if (!this.root) return;
    if (this.root.querySelector('[data-exit-collection]')) return;
    const button = this.context.graphics.createElement('button', 'collection-exit');
    button.dataset.exitCollection = 'true';
    button.type = 'button';
    button.setAttribute('aria-label', 'Zurück zur Spielesammlung');
    this.context.graphics.setText(button, '← SAMMLUNG');
    button.addEventListener('click', () => this.context.requestExit());
    this.root.appendChild(button);
  }

  private dispatchZoff(command: ZoffCommand): void {
    const previousActive = this.game.activePlayer;
    const result = transition(this.game, command);
    if (result.events.length === 0) return;
    this.game = result.state;
    this.handleEvents(result.events, previousActive);
    this.draw();
  }

  private handleEvents(events: GameEvent[], previousActive: PlayerId): void {
    for (const event of events) {
      if (event.type === 'started') {
        this.resetHandoff(true);
        this.ui.statusMessage = `${this.playerLabel(event.firstPlayer)} beginnt.`;
        this.context.announce(this.ui.statusMessage);
      }
      if (event.type === 'chainRemoved') {
        const message = formatChainEvent(event);
        this.ui.chainFeedback = message;
        this.ui.eatingOverlay = [...event.species];
        this.matchRemovedCards += event.cols.length;
        this.ui.removedCardCount = this.matchRemovedCards;
        this.ui.statusMessage = message;
        this.context.announce(message);
        this.context.effects.play('impact', this.root, { text: 'Kette' });
      }
      if (event.type === 'finalTurnBegan') {
        this.ui.statusMessage = `Letzter Zug für ${this.playerLabel(event.player)}.`;
        this.context.announce(this.ui.statusMessage);
      }
      if (event.type === 'finished') {
        this.focusResultReplay = true;
        this.ui.removedCardCount = this.matchRemovedCards;
        const winner =
          event.result.winner === null
            ? 'Unentschieden'
            : `${this.playerLabel(event.result.winner)} gewinnt`;
        const message = `${winner}. Punkte: ${event.result.scores[0]} zu ${event.result.scores[1]}.`;
        this.ui.statusMessage = message;
        this.context.announce(message);
        this.context.effects.play('celebrate', this.root);
      }
    }

    if (
      this.game.activePlayer !== previousActive &&
      this.game.phase !== 'setup' &&
      this.game.phase !== 'finished'
    ) {
      this.resetHandoff(true);
    }

    if (events.some((event) => event.type === 'tookDiscard' || event.type === 'drew')) {
      this.ui.discardRevealMode = false;
    }

    if (events.length > 0) {
      this.ui.removedCardCount = this.matchRemovedCards;
      const removedNow = countRemovedCards(events);
      if (removedNow === 0 && !events.some((event) => event.type === 'finished')) {
        const last = events[events.length - 1]!;
        this.ui.statusMessage = this.describeEvent(last);
      }
    }
  }

  private describeEvent(event: GameEvent): string {
    switch (event.type) {
      case 'tookDiscard':
        return `Ablage genommen: ${event.species}.`;
      case 'drew':
        return 'Karte verdeckt gezogen.';
      case 'placed':
        return `Karte gelegt auf Reihe ${event.row + 1}, Spalte ${event.col + 1}.`;
      case 'discardedDrawn':
        return 'Gezogene Karte verworfen, eine Karte aufgedeckt.';
      case 'revealed':
      case 'finalReveal':
      case 'initialReveal':
        return `Karte aufgedeckt: ${event.species}.`;
      case 'deckRecycled':
        return 'Ablage wurde neu gemischt.';
      default:
        return this.ui.statusMessage;
    }
  }

  private resetHandoff(animateFlip = false): void {
    this.drag?.cancel();
    this.ui.handoffConfirmed = false;
    this.ui.discardRevealMode = false;
    if (animateFlip) this.triggerTurnFlip();
  }

  private triggerTurnFlip(): void {
    this.clearFlipTimer();
    this.ui.turnFlipActive = true;
    this.flipTimer = window.setTimeout(() => {
      this.ui.turnFlipActive = false;
      this.flipTimer = null;
      if (this.root && !this.disposed) {
        applyPresentationClasses(this.root, this.game, this.ui);
      }
    }, 520);
  }

  private clearFlipTimer(): void {
    if (this.flipTimer !== null) {
      window.clearTimeout(this.flipTimer);
      this.flipTimer = null;
    }
    this.ui.turnFlipActive = false;
  }

  private clearEatingOverlay(): void {
    this.ui.eatingOverlay = null;
  }

  private restart(useNewSeed: boolean): void {
    this.drag?.cancel();
    this.clearFlipTimer();
    const seed = useNewSeed ? this.context.random.nextUint32() || 1 : this.context.seed;
    this.game = createGame(seed);
    this.ui = { ...INITIAL_UI };
    this.matchRemovedCards = 0;
    this.draw();
  }

  private playerLabel(player: PlayerId): string {
    return `Spieler ${player + 1}`;
  }

  private handleClick(event: Event): void {
    if (this.drag?.shouldSuppressClick()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target || !this.root) return;

    if (target.matches('[data-start]')) {
      this.dispatchZoff({ type: 'start' });
      return;
    }
    if (target.matches('[data-restart]')) {
      this.restart(true);
      return;
    }
    if (target.matches('[data-confirm-handoff]')) {
      this.clearEatingOverlay();
      this.ui.handoffConfirmed = true;
      this.triggerTurnFlip();
      this.ui.statusMessage = this.phaseHint();
      this.context.announce(this.ui.statusMessage);
      this.draw();
      return;
    }
    if (!this.ui.handoffConfirmed || this.game.phase === 'finished') return;

    this.clearEatingOverlay();

    if (target.matches('[data-take-discard]')) {
      this.dispatchZoff({ type: 'takeDiscard', player: this.game.activePlayer });
      return;
    }
    if (target.matches('[data-draw]')) {
      this.dispatchZoff({ type: 'draw', player: this.game.activePlayer });
      return;
    }
    if (target.matches('[data-discard-reveal]')) {
      this.ui.discardRevealMode = true;
      this.ui.statusMessage = 'Wähle eine verdeckte Karte zum Aufdecken.';
      this.draw();
      return;
    }
    if (target.matches('[data-cancel-reveal]')) {
      this.ui.discardRevealMode = false;
      this.ui.statusMessage = this.phaseHint();
      this.draw();
      return;
    }
    if (target.matches('[data-place]')) {
      const row = Number(target.dataset.row);
      const col = Number(target.dataset.col);
      this.dispatchZoff({
        type: 'place',
        player: this.game.activePlayer,
        row,
        col,
      });
      return;
    }
    if (target.matches('[data-reveal]')) {
      const row = Number(target.dataset.row);
      const col = Number(target.dataset.col);
      this.dispatchZoff({
        type: 'discardDrawn',
        player: this.game.activePlayer,
        revealRow: row,
        revealCol: col,
      });
      return;
    }
  }

  private phaseHint(): string {
    if (this.game.phase === 'finalTurn') {
      return `${this.playerLabel(this.game.activePlayer)}: letzter Zug.`;
    }
    if (this.game.phase === 'holdingDiscard') {
      return 'Lege die Ablagekarte.';
    }
    if (this.game.phase === 'inspectingDraw') {
      return 'Gezogene Karte ansehen und entscheiden.';
    }
    return `${this.playerLabel(this.game.activePlayer)} ist am Zug.`;
  }

  private handleKey(event: KeyboardEvent): void {
    if (!this.root || this.disposed) return;
    if (event.key === 'Escape' && this.ui.discardRevealMode) {
      this.ui.discardRevealMode = false;
      this.draw();
    }
  }
}

export function createZoffSession(context: SessionContext): GameSession {
  return new ZoffSession(context);
}
