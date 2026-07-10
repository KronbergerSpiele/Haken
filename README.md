# Haken

Haken is a simultaneous battle between two fictional German AI models on one
portrait-oriented phone. Sit at opposite ends, generate tokens, flick attacks
and guardrails into the shared arena, and crash two opposing system zones.
There are no turns.

The game is a static, framework-free TypeScript site. It has no accounts,
backend, tracking, or network multiplayer.

## Play

1. Put the phone between both players in portrait orientation.
2. Press **Los geht's**. The browser will offer fullscreen mode.
3. Flick a staged card toward the center. Fixed cards can only be played into
   their printed lane; Rechenleistungsüberlastungsgewitter,
   Bundesrundumverteidigungszaun, and selected specials can use any release lane.
4. Attacks fire when their countdown empties. Matching guards catch one attack.
5. Crash two zones—Kontext, Logik, or Ausgabe—to win.

Both players can drag cards at exactly the same time. A sideways drag recycles
an unwanted card. Tapping a card exposes accessible lane and **Spielen**
controls for players who do not want to flick.

The complete rules, balance values, card catalog, timing model, and UX
requirements are in the [game design document](DESIGN.md). Architecture and
implementation decisions are in the
[technical design document](TECHNICAL_DESIGN.md).

## Development

Requires Node.js 22 or newer and pnpm 10. The pinned pnpm version can be
activated with Corepack. Dependency resolution rejects package releases newer
than seven days (`minimumReleaseAge: 10080`).

```bash
corepack enable
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm test       # deterministic engine and DOM smoke tests
pnpm build      # type-check and create dist/
pnpm preview    # serve the production build locally
```

## Architecture

- `src/game/types.ts` defines cards, players, center state, and commands.
- `src/game/cards.ts` contains the symmetric 22-card deck and balance constants.
- `src/game/engine.ts` is the deterministic transition engine. It has no DOM
  dependency and resolves simultaneous damage in batches.
- `src/ui/flick-controller.ts` owns independent Pointer Event gestures.
- `src/ui/render.ts` projects state into the two-sided accessible interface.
- `src/main.ts` connects the animation clock, lifecycle, fullscreen, feedback,
  rendering, and engine.

Card deadlines use monotonic timestamps. Pausing shifts every pending deadline,
preventing hidden tabs from deciding a match. A seed controls deck shuffling so
the same command stream produces the same result.

## GitHub Pages

The Vite build uses relative asset URLs, so it works at `/Haken/` and in local
previews. [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
tests, builds, and deploys `dist/` whenever `main` changes.

For a new repository, open **Settings → Pages** once and select **GitHub
Actions** as the source. After the workflow succeeds, the game is available at:

<https://kronbergerspiele.github.io/Haken/>

## Browser support

Current Safari and Chromium-based mobile browsers are supported. Fullscreen,
vibration, and generated sound are progressive enhancements; declining or
muting them does not affect gameplay. The layout targets portrait viewports from
320×568 through 430×932 and provides reduced-motion behavior.