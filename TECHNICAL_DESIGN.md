# Mini-game collection — technical design document

This document defines the target architecture for a browser-based mini-game
engine and its games. Haken is the first game implemented on the engine.
Zoff in the Sky is the second. Player-visible behavior, game rules, balance,
and acceptance criteria are defined in [the game design document](DESIGN.md).

## Goals and boundaries

The engine makes small multiplayer prototypes cheap to add without coupling
their rules, state, or artwork to one another. It owns the application shell,
game discovery, lifecycle, clocks, player input plumbing, shared graphics and
effects, and platform integrations. Each game owns its rules, deterministic
state transitions, game-specific controls, view, theme, and content.

The site remains framework-free TypeScript built by Vite. Native DOM and SVG,
Pointer Events, CSS, `requestAnimationFrame`, the Page Visibility API, and the
Fullscreen API are sufficient. The production output is a static site with
relative asset URLs and can be hosted at a GitHub Pages repository subpath.

"Remote" means that a deployed build can be opened over the web while away from
the development machine. The first transport is local, same-device multiplayer.
There is no backend, account, analytics, persistence, matchmaking, or network
multiplayer. A future network transport must preserve the command contract and
is a separate architectural decision; games must not call network APIs
directly.

## Layered architecture

Dependencies point downward through four layers:

1. **Application shell** discovers games, renders the launcher, owns navigation,
   creates and disposes sessions, and integrates browser lifecycle APIs.
2. **Mini-game runtime** provides the clock, deterministic command queue,
   player/input ownership, seeded random source, pause handling, and session
   services.
3. **Shared presentation library** provides graphics primitives, themes, effect
   scheduling, sound/haptics adapters, and accessibility helpers.
4. **Game modules** implement only their own model, commands, reducer, renderer,
   controls, content, and tests.

The runtime does not contain Haken concepts such as cards, lanes, tokens, or
zones. Shared presentation code does not import a game module. Games may import
runtime and presentation contracts, but they may not import one another.

Target module layout:

```text
src/
  app/
    catalog.ts             # explicit registry of available games
    launcher.ts            # game selection and requirement summaries
    router.ts              # URL parsing and History API synchronization
    session-host.ts        # mount, pause, resume, and dispose orchestration
  engine/
    contracts.ts           # GameModule, GameSession, command, and event types
    runtime.ts             # clock and ordered command processing
    random.ts              # reproducible seeded random source
    input.ts               # pointer ownership and keyboard/tap routing
  graphics/
    primitives.ts          # safe DOM/SVG shapes, icons, labels, and sprites
    theme.ts               # shared design tokens and per-game theme scopes
    effects.ts             # visual effect timeline and reduced-motion variants
    feedback.ts            # optional sound and vibration adapters
  games/
    haken/
      session.ts           # Haken manifest and session factory
      model.ts             # Haken-only state and event contracts
      cards.ts             # deck definitions and balance constants
      reducer.ts           # deterministic Haken transitions
      controls.ts          # flick and accessible fallback interpretation
      view.ts              # Haken DOM projection
      graphics.ts          # Haken-specific art built from shared primitives
    zoff-in-the-sky/
      session.ts           # session factory, click/keyboard command routing
      model.ts             # nested grid, deck, phase, and command contracts
      cards.ts             # species values, deck composition, predator graph
      reducer.ts           # deterministic turn, chain, and scoring transitions
      view.ts              # active and compact opponent grid projection
      graphics.ts          # bundled animal sprites and eating indicators
      reducer.test.ts
      view.test.ts
      session.test.ts
      assets/              # optimized local card-face and card-back artwork
  main.ts                  # composition root only
```

Haken already lives under `src/games/haken/`. Shared pointer, lifecycle, and
presentation behavior lives in `src/engine/` and `src/graphics/`. Zoff in the
Sky follows the same plug-in layout as a self-contained turn-based module.

## Game plug-in contract

Games are compile-time plug-ins registered explicitly in `app/catalog.ts`.
Remote code, runtime plug-in downloads, and manifest fetching are out of scope.
An explicit registry keeps deployment static, makes the complete catalog
testable, and lets Vite produce one lazy-loaded chunk per game.

The public contract is intentionally small:

```ts
interface GameManifest {
  id: string;                 // stable, URL-safe, and globally unique
  title: string;
  description: string;
  players: { min: number; max: number };
  device: 'shared-screen';
  orientation: 'portrait' | 'landscape' | 'any';
  load(): Promise<GameModule>;
}

interface GameModule {
  createSession(context: SessionContext): GameSession;
}

interface GameSession {
  mount(root: HTMLElement): void;
  dispatch(command: GameCommand): void;
  advance(now: number): void;
  pause(at: number): void;
  resume(at: number): void;
  dispose(): void;
}

interface SessionContext {
  seed: number;
  clock: MonotonicClock;
  random: SeededRandom;
  input: InputService;
  graphics: GraphicsService;
  effects: EffectService;
  feedback: FeedbackService;
  announce(message: string): void;
  requestExit(): void;
}
```

`GameCommand` and game state are discriminated, game-owned types. The shell
treats them as opaque. `createSession` receives all external capabilities, so a
game can be run with fake services in tests. `mount` may only render inside its
provided root. `dispose` is mandatory and idempotent: it releases pointer
captures, listeners, animation work, effect handles, and generated media nodes.

The manifest contains only launcher metadata. Rules and balance do not belong
in the catalog. A game is accepted only when it can be removed from the registry
without breaking the engine or another game.

## Launcher, navigation, and deep links

The launcher renders `GameManifest` metadata and is the only entry point for
browsing the catalog. It remains interactive while a selected game's lazy chunk
loads, reports load failures on the corresponding game card, and does not create
a session until loading succeeds. Its share action uses the Web Share API when
available and otherwise copies the absolute game URL to the clipboard; a
selectable text fallback is provided if both APIs are unavailable.

Game routes use a query parameter on the deployment root:

```text
./                         launcher
./?game=haken              Haken
./?game=zoff-in-the-sky    Zoff in the Sky
```

Path routes such as `/games/haken` are not used because a static GitHub Pages
host cannot rewrite a direct request to `index.html`. `router.ts` reads and
writes URLs through `URL` and `URLSearchParams`, preserving the repository
subpath. It never constructs a root-relative URL.

The route state contains only the stable manifest ID. Session state, player
input, score, seed, and timestamps are excluded. IDs are compared exactly after
URL decoding; arbitrary query values are never interpreted as module paths or
inserted as markup.

Navigation follows these rules:

- selecting a launcher entry pushes `?game=<id>` and starts that game;
- `popstate` reconciles the active session with the URL, disposing the old
  session before mounting another or showing the launcher;
- an in-game collection action uses browser Back when the launcher started the
  game, or replaces a directly opened game URL with the launcher after disposal;
- a direct game URL loads the matching registered game without first flashing
  the launcher;
- an unknown, missing, or failed game resolves to the launcher with a
  non-blocking error message and removes the invalid parameter with
  `replaceState`;
- Back returns to the launcher after a game selected there, and Forward can
  recreate a fresh session for that game. A directly opened deep link may leave
  the site when the browser goes Back, so the in-game collection action remains
  available.

The canonical share URL is derived from `window.location.href`, with the
query reduced to the `game` parameter and the URL fragment removed. This keeps
links valid in local previews, custom domains, and GitHub repository subpaths
without propagating unrelated query data.

## Runtime and determinism

The runtime uses `performance.now()` through an injected monotonic clock.
Browser callbacks wake the runtime but do not define game time. Commands are
ordered by timestamp and then by a session-local increasing sequence number.
Each animation frame drains due commands, asks the active game to advance to
the frame time, and renders any resulting state.

The engine does not impose a fixed update model: turn-based games can advance
only on commands, while real-time games can process absolute deadlines. Zoff in
the Sky advances only on player commands and has no gameplay timers. Games must
not use `Date.now()`, `Math.random()`, `setTimeout()`, or `setInterval()` for
rule decisions. Random choices use the session's seeded generator. Given a
seed and the same timestamped command stream, a game must produce the same state
and semantic events.

Page hiding pauses the session. On resume, the runtime shifts outstanding
deadlines by the paused duration or supplies an equivalent paused-time offset;
hidden time never advances gameplay. The game decides ordering among
simultaneous game events and documents that ordering in its design rules.

Only one game session is active. Starting another session first disposes the
current one. The shell owns the sole animation loop and routes frames only to
the active session, preventing abandoned games from consuming resources.

## Multiplayer and input

The runtime assigns stable player slots for a session and routes input with a
player identifier. The shared-screen adapter supports concurrent Pointer Events:
each active pointer has one owner, one control cannot be claimed twice, and
captured pointers are released when a session ends. Keyboard and tap actions
use the same game commands as gestures.

Gesture meaning remains game-specific. The input service reports normalized
pointer phases, coordinates relative to the game root, timestamps, and pointer
identity; a game's controls translate those values into commands. This avoids
embedding Haken's flick thresholds or board orientation in the engine.

The command boundary is transport-neutral enough for a future remote adapter,
but it is not a networking protocol. Before network multiplayer is added, the
design must define authority, synchronization, latency policy, reconnects,
serialization compatibility, abuse controls, and backend deployment.

## Shared graphics and effects

`src/graphics/` is a rendering toolkit rather than a game asset catalog:

- primitives create reusable DOM/SVG elements such as panels, badges, progress
  meters, bursts, particles, and icon containers;
- theme scopes expose typed color, spacing, typography, motion, and contrast
  tokens as CSS custom properties;
- each game supplies named artwork and composition in its own `graphics.ts`;
- the effect service schedules visual effects against the runtime clock and
  supports cancellation by session, element, or effect handle;
- semantic effects such as `impact`, `block`, `celebrate`, and `warning` map to
  themeable motion, optional sound/haptics, and a text announcement;
- reduced-motion variants replace large movement, shake, and particle effects
  with short fades or static emphasis while preserving timing and meaning.

Graphics APIs return nodes or structured descriptors, not unsanitized HTML.
Bundled SVG paths are trusted source code; player-provided text is inserted with
`textContent`. Zoff in the Sky ships text-free card faces and a card back as
static bundled assets referenced from its module. Effects are presentation-only:
their callbacks cannot mutate game state. Rule outcomes first produce semantic
game events, then the view maps those events to effects. Skipped or disabled
effects therefore cannot alter a match.

The library uses DOM/SVG initially because it integrates with the existing
accessible interface and is adequate for small boards. A Canvas renderer is not
part of the common contract. A game that proves it needs Canvas may own one
behind its view without changing other games.

## Lifecycle and platform services

`session-host.ts` is the only module allowed to coordinate game lifecycle with
navigation and page visibility. Session flow is:

1. resolve and lazy-load a registered manifest;
2. create a scoped root, seed, services, and session;
3. mount the session and optionally request fullscreen after a user gesture;
4. route frames, input, visibility, and feedback while active;
5. pause on page hide and resume on page show;
6. dispose services and the session before returning to the launcher.

Fullscreen, vibration, and generated sound are progressive enhancements.
Service adapters report unavailable or denied capabilities without failing
session creation. Audio starts only after user interaction and respects mute.
No platform service contains game rules.

## Zoff in the Sky module

Zoff in the Sky is a self-contained turn-based game module at
`src/games/zoff-in-the-sky/`. It does not share rules code with Haken.

### State and phases

- Each player board stores a nested `3 × 5` grid of `(GridCell | null)[][]`.
  A `GridCell` holds a card instance and a `faceUp` flag; `null` is a gap after
  chain removal.
- Match state is a pure reducer model with discriminated phases: `setup`,
  `awaitingAction`, `holdingDiscard`, `inspectingDraw`, `finalTurn`, and
  `finished`.
- `pendingCard` holds a taken discard or inspected draw between action selection
  and placement. The inspected draw is private to the active player in the view
  until placed or discarded.
- `inFinalTurn` records that one grid has no hidden occupied cells and the
  opponent still owes exactly one turn.

### Deck and randomness

- The fifty-nine-card deck is built from species copy counts in `cards.ts`.
- The reducer owns deterministic `rngState`, initialized from the session seed
  in `createGame`. Internal `randomStep` / `shuffle` advance `rngState` for
  the opening deal, seeded initial reveals, and discard recycling. The module
  does not call the shared `SessionContext.random` service for rule decisions.
- On `start`, the reducer reveals two seeded-random hidden cells per player,
  deals one opening face-up discard from the draw pile, and sets the first
  active player from seed parity (`seed % 2`).
- Draw-pile exhaustion recycles every discard card except the visible top into
  a newly shuffled draw pile, preserving that top as the only discard card.
- `canPlacePendingAt` enforces stock safety: during a normal turn, when the draw
  pile is empty, the pending card came from discard, and taking it left discard
  empty, gap targets are rejected so placement must replace an occupied card and
  restore a visible discard. During `finalTurn`, gap placement is allowed
  because scoring follows immediately. The reducer and view share this query for
  legality and placeable highlighting.

### Chains and scoring

- Chain resolution scans player `0` then player `1`, row by row left to right.
  Each maximal contiguous run of three or more face-up cards where every right
  neighbor eats its immediate left neighbor is removed in one step. The reducer
  does not iteratively remove single cards inside a qualifying run. Gaps are
  not compacted.
- After the final opponent turn, the reducer reveals all remaining hidden
  cells, resolves chains once more, then scores every occupied slot.

### Presentation

- The session applies a namespaced `zoff-in-the-sky` theme scope and CSS tokens.
- `session.ts` routes click and keyboard input into reducer commands; there is no
  separate `controls.ts`.
- The view renders the active player's full grid, a compact opponent grid, pass-
  device privacy for inspected draws, compact edge eating indicators, and stronger
  contextual valid-link connectors. Accessible labels mirror the predator and
  prey relations.

### Registration and assets

- The game is registered explicitly in `app/catalog.ts` with lazy dynamic import
  of its session factory, matching the Haken chunk pattern.
- Card artwork is bundled under the module's `assets/` directory and referenced
  as static build inputs; there is no runtime asset fetch.

## Accessibility

The shell and shared library provide semantic buttons, visible focus, an
ARIA-live status region, focus restoration when leaving a game, and
`prefers-reduced-motion` integration. A game must provide complete non-gesture
controls, programmatic labels for state and controls, and information that does
not rely on color, motion, sound, or vibration alone.

The launcher announces player count, orientation, and shared-device
requirements before starting a game. Orientation prompts do not trap focus.
Games are responsible for logical focus order inside their root; the host
restores focus to the selected launcher entry after disposal.

## Performance and resource limits

There is one application animation loop. It stops when no game is active or the
page is hidden. Effect pools cap transient nodes per session; when a cap is
reached, semantic feedback remains but decorative particles may be dropped.
Games should render from snapshots and update only changed DOM where practical.

The launcher eagerly loads only metadata. Game implementation chunks and
game-specific assets load on selection. Shared engine and graphics modules form
the common chunk. A production build must detect circular dependencies and
remain functional from a repository subpath.

## Testing strategy

The following automated boundaries are required:

- contract tests run every registered manifest through create, mount, pause,
  resume, exit, and double-dispose with fake services;
- runtime tests verify command ordering, seeded randomness, pause offsets,
  single-session ownership, and cleanup;
- graphics tests verify safe text insertion, effect cancellation, theme
  scoping, node caps, and reduced-motion mappings;
- catalog tests verify unique IDs, valid metadata, lazy-load success, and that
  every registered game satisfies the contract;
- router tests verify query parsing, subpath-safe URL generation, unknown IDs,
  direct loads, and Back/Forward session disposal;
- launcher tests verify metadata, loading and failure states, and share,
  clipboard, and text fallbacks;
- each game has reducer tests proving determinism and its documented
  simultaneous-event ordering, plus DOM smoke tests for pointer and non-gesture
  play;
- Zoff in the Sky adds reducer tests for shuffle/recycle with preserved discard
  top, opening discard, seeded initial reveals, Zoff turn legality, stock-safety
  gap rejection with occupied replacement, final-turn gap allowance, private
  inspected draw visibility, face-up and hidden replacement, full-run chain
  removal, final-turn handoff after placement or reveal, scoring, and draws,
  plus DOM smoke tests in `view.test.ts`—including stock-unsafe gaps not marked
  placeable—and lifecycle cleanup in `session.test.ts`;
- end-to-end smoke tests launch Haken, leave it, launch it again, and confirm
  that no duplicate listeners, animation loops, or effects survive; the same
  cleanup guarantees apply when launching and leaving Zoff in the Sky.

`pnpm test` runs deterministic unit and DOM tests. `pnpm build` type-checks and
builds all registered games. GitHub Pages deployment runs both commands before
publishing `dist/`.

## Design-document boundary

Technical decisions belong here when they affect architecture, module
responsibilities, state or event contracts, algorithms, dependencies, build or
deployment, persistence or networking, platform integration, performance,
security, accessibility implementation, or testing strategy.

Player-visible behavior and requirements belong in `DESIGN.md`. A decision that
changes both implementation and player-visible behavior must update both
documents.
