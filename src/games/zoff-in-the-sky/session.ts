import type { GameCommand, GameSession, SessionContext } from '../../engine/contracts';
import { applyZoffTokens } from '../../graphics/theme';
import { createGame, transition } from './reducer';
import type { GameCommand as ZoffCommand, GameEvent, GameState, PlayerId } from './model';
import {
  INITIAL_UI,
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
    this.root?.removeEventListener('click', this.clickHandler);
    this.root?.removeEventListener('keydown', this.keyHandler);
    this.context.input.detach();
    this.context.effects.cancelAll();
    if (this.root) {
      this.context.graphics.clearThemeScope(this.root);
      this.root.replaceChildren();
    }
    this.root = null;
  }

  private draw(): void {
    if (!this.root || this.disposed) return;
    render(this.root, this.game, this.ui);
    this.ensureCollectionButton();
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
        this.resetHandoff();
        this.ui.statusMessage = `${this.playerLabel(event.firstPlayer)} beginnt.`;
        this.context.announce(this.ui.statusMessage);
      }
      if (event.type === 'chainRemoved') {
        const message = formatChainEvent(event);
        this.ui.chainFeedback = message;
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
      this.resetHandoff();
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

  private resetHandoff(): void {
    this.ui.handoffConfirmed = false;
    this.ui.discardRevealMode = false;
  }

  private restart(useNewSeed: boolean): void {
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
      this.ui.handoffConfirmed = true;
      this.ui.statusMessage = this.phaseHint();
      this.context.announce(this.ui.statusMessage);
      this.draw();
      return;
    }
    if (!this.ui.handoffConfirmed || this.game.phase === 'finished') return;

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
