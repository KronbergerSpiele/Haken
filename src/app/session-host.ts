import { CATALOG, findManifest } from './catalog';
import {
  announceLauncher,
  focusLauncherEntry,
  renderLauncher,
  shareGameLink,
  type LauncherLoadState,
  type LauncherViewModel,
} from './launcher';
import {
  clearInvalidGameRoute,
  pushGameRoute,
  readRouteState,
  replaceGameRoute,
  routeStartedFromLauncher,
  subscribeRoute,
} from './router';
import type { GameManifest, GameModule, GameSession, SessionContext } from '../engine/contracts';
import { createInputService } from '../engine/input';
import { createSeededRandom } from '../engine/random';
import { RuntimeClock } from '../engine/runtime';
import { createEffectService } from '../graphics/effects';
import { createFeedbackService } from '../graphics/feedback';
import { createGraphicsService } from '../graphics/primitives';

export class SessionHost {
  private readonly root: HTMLElement;
  private readonly launcherRoot: HTMLElement;
  private readonly gameRoot: HTMLElement;
  private readonly statusRegion: HTMLElement;
  private readonly clock = new RuntimeClock();
  private readonly input = createInputService();
  private readonly graphics = createGraphicsService();
  private readonly effects = createEffectService();
  private readonly feedback = createFeedbackService();
  private session: GameSession | null = null;
  private activeManifest: GameManifest | null = null;
  private frameId: number | null = null;
  private pageHidden = false;
  private launcherCleanup: (() => void) | null = null;
  private routeUnsubscribe: (() => void) | null = null;
  private loadStates: Record<string, LauncherLoadState> = {};
  private notice: string | null = null;
  private lastFocusedGameId: string | null = null;
  private openedDirectly = false;
  private pendingGameId: string | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.launcherRoot = document.createElement('div');
    this.launcherRoot.id = 'launcher-root';
    this.gameRoot = document.createElement('div');
    this.gameRoot.id = 'game-root';
    this.gameRoot.hidden = true;
    this.statusRegion = document.createElement('div');
    this.statusRegion.id = 'app-status';
    this.statusRegion.className = 'visually-hidden';
    this.statusRegion.setAttribute('aria-live', 'polite');
    root.replaceChildren(this.launcherRoot, this.gameRoot, this.statusRegion);
  }

  start(): void {
    this.routeUnsubscribe = subscribeRoute((state) => {
      void this.reconcileRoute(state.gameId);
    });
    void this.reconcileRoute(readRouteState().gameId);
  }

  dispose(): void {
    this.routeUnsubscribe?.();
    this.routeUnsubscribe = null;
    this.stopFrameLoop();
    this.disposeSession();
    this.launcherCleanup?.();
    this.launcherCleanup = null;
    this.root.replaceChildren();
  }

  private async reconcileRoute(gameId: string | null): Promise<void> {
    if (gameId === this.pendingGameId && this.session) return;
    if (!gameId) {
      this.showLauncher(this.notice);
      return;
    }

    const manifest = findManifest(gameId);
    if (!manifest) {
      this.notice = `Spiel „${gameId}“ ist nicht verfügbar.`;
      clearInvalidGameRoute();
      this.showLauncher(this.notice);
      return;
    }

    await this.startGame(manifest, false);
  }

  private showLauncher(notice: string | null = null): void {
    this.notice = notice;
    this.stopFrameLoop();
    this.disposeSession();
    this.gameRoot.hidden = true;
    this.gameRoot.replaceChildren();
    this.launcherRoot.hidden = false;

    const model: LauncherViewModel = {
      manifests: CATALOG,
      loadStates: this.loadStates,
      notice: this.notice,
      selectedGameId: this.lastFocusedGameId,
    };

    this.launcherCleanup?.();
    this.launcherCleanup = renderLauncher(this.launcherRoot, model, {
      onPlay: (gameId) => {
        this.lastFocusedGameId = gameId;
        this.notice = null;
        pushGameRoute(gameId, true);
        void this.startGame(findManifest(gameId)!, true);
      },
      onShare: (gameId) => {
        const manifest = findManifest(gameId);
        if (manifest) void shareGameLink(gameId, manifest.title);
      },
    });

    focusLauncherEntry(this.lastFocusedGameId);
  }

  private async startGame(manifest: GameManifest, fromLauncher: boolean): Promise<void> {
    if (this.pendingGameId === manifest.id && this.session) return;
    this.pendingGameId = manifest.id;
    this.lastFocusedGameId = manifest.id;
    this.openedDirectly = !fromLauncher && !routeStartedFromLauncher();
    this.loadStates = { ...this.loadStates, [manifest.id]: 'loading' };
    if (fromLauncher) this.showLauncher(this.notice);

    try {
      const module = await manifest.load();
      if (this.pendingGameId !== manifest.id) return;
      this.loadStates = { ...this.loadStates, [manifest.id]: 'idle' };
      this.launchSession(manifest, module);
    } catch {
      this.loadStates = { ...this.loadStates, [manifest.id]: 'failed' };
      this.pendingGameId = null;
      if (readRouteState().gameId === manifest.id) replaceGameRoute(null);
      this.showLauncher(`Spiel „${manifest.title}“ konnte nicht geladen werden.`);
    }
  }

  private launchSession(manifest: GameManifest, module: GameModule): void {
    this.disposeSession();
    this.launcherCleanup?.();
    this.launcherCleanup = null;
    this.launcherRoot.hidden = true;
    this.launcherRoot.replaceChildren();

    this.activeManifest = manifest;
    this.gameRoot.hidden = false;
    this.gameRoot.replaceChildren();

    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
    const context = this.createContext(seed);
    this.session = module.createSession(context);
    this.session.mount(this.gameRoot);
    this.startFrameLoop();
    announceLauncher(`${manifest.title} gestartet. ${manifest.players.min} Spieler, ${manifest.orientation === 'portrait' ? 'Hochformat' : manifest.orientation}, ein Gerät teilen.`);
    this.pendingGameId = null;
  }

  private createContext(seed: number): SessionContext {
    const random = createSeededRandom(seed);
    return {
      seed,
      clock: this.clock,
      random,
      input: this.input,
      graphics: this.graphics,
      effects: this.effects,
      feedback: this.feedback,
      announce: (message) => {
        this.statusRegion.textContent = message;
      },
      requestExit: () => this.exitToLauncher(),
    };
  }

  private exitToLauncher(): void {
    const manifestId = this.activeManifest?.id ?? null;
    this.stopFrameLoop();
    this.disposeSession();
    this.pendingGameId = null;

    if (this.openedDirectly || !routeStartedFromLauncher()) {
      replaceGameRoute(null);
      this.showLauncher(null);
      return;
    }

    if (history.state?.fromLauncher) {
      history.back();
      return;
    }

    replaceGameRoute(null);
    this.showLauncher(null);
    if (manifestId) this.lastFocusedGameId = manifestId;
  }

  private disposeSession(): void {
    this.session?.dispose();
    this.session = null;
    this.activeManifest = null;
    this.effects.cancelAll();
    this.input.detach();
    this.feedback.muted = false;
  }

  private startFrameLoop(): void {
    this.stopFrameLoop();
    const tick = (timestamp: number): void => {
      if (!this.pageHidden) this.session?.advance(timestamp);
      this.frameId = requestAnimationFrame(tick);
    };
    this.frameId = requestAnimationFrame(tick);

    if (!this.visibilityListenerAttached) {
      document.addEventListener('visibilitychange', this.handleVisibility);
      this.visibilityListenerAttached = true;
    }
  }

  private visibilityListenerAttached = false;

  private readonly handleVisibility = (): void => {
    this.pageHidden = document.hidden;
    const at = this.clock.now();
    if (document.hidden) this.session?.pause(at);
    else this.session?.resume(at);
    if (document.hidden) this.stopFrameLoop();
    else if (this.session) this.startFrameLoop();
  };

  private stopFrameLoop(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }
}

export function bootstrapApp(root: HTMLElement): SessionHost {
  const host = new SessionHost(root);
  host.start();
  return host;
}
