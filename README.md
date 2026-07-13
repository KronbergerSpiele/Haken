# Spielesammlung

Browser-based collection of small multiplayer game prototypes. Haken is a
simultaneous battle between two fictional German AI models on one
portrait-oriented phone. Zoff in the Sky is a calm two-player card duel on one
device. A shared launcher lets players choose a game and return to the
collection without reloading the site.

The collection is a static TypeScript monorepo built with Vite. Shared UI uses
Lit custom elements in `@spiele/ui` (light DOM only); there is no full
application framework. It has no accounts, backend, tracking, or network
multiplayer.

## Play

Open the deployed site or run `pnpm dev` locally. The launcher lists every
registered game with player count, orientation, and shared-device requirements.
Use `?game=haken` or `?game=zoff-in-the-sky` to open a game directly.

Haken quick start:

1. Put the phone between both players in portrait orientation.
2. Press **Los geht's**. The browser will offer fullscreen mode.
3. Flick a staged card toward its printed lane. Cards marked **Freie Wahl** can
   target any lane.
4. Attacks fire when their countdown empties. A defense in that lane catches
   one attack.
5. Crash two zones—Kontext, Logik, or Ausgabe—to win.

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
pnpm test       # deterministic engine and DOM smoke tests across the workspace
pnpm build      # type-check and create dist/
pnpm preview    # serve the production build locally
```

## Monorepo layout

| Package | Responsibility |
| --- | --- |
| `@spiele/shell` (`apps/shell`) | Vite entry, launcher host, router, session host, shell CSS |
| `@spiele/ui` (`packages/ui`) | Shared Lit custom elements (light DOM): collection exit, launcher |
| `@spiele/engine` (`packages/engine`) | Clock, contracts, input, seeded random |
| `@spiele/graphics` (`packages/graphics`) | Shared primitives, effects, feedback, shared theme tokens |
| `@spiele/game-haken` (`packages/game-haken`) | Haken rules, view, theme tokens, and styles |
| `@spiele/game-zoff-in-the-sky` (`packages/game-zoff-in-the-sky`) | Zoff rules, view, theme tokens, styles, and card artwork |

Games register in `apps/shell/src/app/catalog.ts` with lazy dynamic imports so
each game ships as its own Vite chunk. Production output is written to the
repository-root `dist/` directory.

## GitHub Pages

The Vite build uses relative asset URLs, so it works at `/Haken/` and in local
previews. [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
tests, builds, and deploys `dist/` whenever `main` changes.

For a new repository, open **Settings → Pages** once and select **GitHub
Actions** as the source. After the workflow succeeds, the game is available at:

<https://kronbergerspiele.github.io/Haken/>

## Pull request previews

Every pull request against `main` gets a temporary preview deployment via
[`.github/workflows/preview-pages.yml`](.github/workflows/preview-pages.yml).
The workflow runs the same tests and build as production, publishes the result
to GitHub Pages, and posts a sticky comment on the pull request with the
preview link. You can also open the link from the **Pages Preview** check on the
PR.

Previews are removed automatically when the pull request closes. Because the
build uses relative asset URLs, each preview works at the path GitHub assigns
without extra configuration—handy for trying changes on a phone before merge.
Add `?game=haken` to the preview URL to open Haken directly.

## Browser support

Current Safari and Chromium-based mobile browsers are supported. Fullscreen,
vibration, and generated sound are progressive enhancements; declining or
muting them does not affect gameplay. The layout targets portrait viewports from
320×568 through 430×932 and provides reduced-motion behavior.