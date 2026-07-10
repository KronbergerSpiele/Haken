# Haken — technical design document

This document records the implementation architecture and technical decisions
for Haken. Product behavior, gameplay rules, balance, and player-facing
requirements are defined in [the game design document](DESIGN.md).

## Architecture

The site is framework-free TypeScript built by Vite. Native DOM rendering,
Pointer Events, CSS, `requestAnimationFrame`, and the Fullscreen API are enough;
there is no server, account, persistence, or network play.

The game engine is a pure state transition layer. UI code emits timestamped
commands and renders snapshots. Seeded randomization makes every deck and test
reproducible. Absolute monotonic deadlines prevent timer drift. Visibility
changes are represented as explicit pause/resume commands.

Primary modules:

- `src/game/types.ts`: state, card, command, and event contracts.
- `src/game/cards.ts`: deck definitions and balance constants.
- `src/game/engine.ts`: seeded setup and deterministic state transitions.
- `src/ui/flick-controller.ts`: pointer ownership and gesture interpretation.
- `src/ui/render.ts`: DOM projection and accessible fallback controls.
- `src/main.ts`: clock, lifecycle, fullscreen, sound, and application wiring.

## Design-document boundary

Technical decisions belong here when they affect architecture, module
responsibilities, state or event contracts, algorithms, dependencies, build or
deployment, persistence or networking, platform integration, performance,
security, accessibility implementation, or testing strategy.

Player-visible behavior and requirements belong in `DESIGN.md`. A decision that
changes both implementation and player-visible behavior must update both
documents.
