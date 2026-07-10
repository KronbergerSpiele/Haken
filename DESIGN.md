# Haken — game and implementation specification

## Product

Haken is a local, two-player card brawl played simultaneously on one phone. One
player sits at each end of a portrait-oriented device. Both flick cards from
their staging areas into a shared three-lane arena; there are no turns, rounds,
or active-player locks.

The presentation is fictional cartoon slapstick: grumbling rivals, impact stars,
rubber-hose motion, and absurd card names. It contains no gore and does not
imitate or demean real people.

## Match rules

### Objective

Each fighter has three body zones:

- **Kopf** (head), symbol ▲
- **Bauch** (belly), symbol ●
- **Beine** (legs), symbol ║

Every zone starts with 3 health. A zone is *kaputt* at zero health. Breaking two
of the opponent's zones wins. Damage due in the same simulation step is applied
as one batch. If both fighters break a second zone in that batch, the result is
**Doppel-K.O.**

### Dampf and staging

- Each fighter starts with 3 Dampf, can hold 6, and gains 1 every 900 ms.
- The two decks are identical but shuffled independently from a reproducible
  match seed.
- Four face-up cards are staged for each player.
- A legal release reserves its Dampf immediately. The emptied slot receives a
  new card 700 ms after the played card lands.
- When the draw pile is empty, shuffle the discard pile into a new draw pile.
- Dragging a card sideways recycles it for free and locks that slot for
  1,200 ms. A recycled card goes to the discard pile.

### Flicking

The bottom fighter flicks upward; the top fighter flicks downward. A valid flick
moves at least 28 CSS pixels toward the center or exceeds the configured release
velocity. Weak, backward, unaffordable, and otherwise illegal flicks return to
their slots without changing game state.

Fixed-zone cards curve into their printed lane. Wild and lane-selecting cards
use the horizontal release position; the intended lane is highlighted during
the drag. Travel lasts 180–350 ms, based on release speed. A card's timeout
starts only when it lands.

Pointer capture and pointer IDs isolate simultaneous drags. The same card cannot
be claimed twice. A tap fallback lets a player select a card, select a lane when
needed, and use a large `SPIELEN` button with identical cost and timing.

### Center resolution

Any number of cards may coexist. Every card displays its owner, zone, and
remaining lifetime.

- Attacks arm on landing. When their fuse expires, the oldest active enemy guard
  in the lane absorbs the attack; otherwise its damage is applied.
- Guards activate on landing, absorb one matching attack, and are discarded. An
  unused guard is discarded at the end of its duration.
- Specials apply on landing, remain visible for 600 ms, and then discard.
- Attacks do not cancel attacks. Exchanged hits and double knockouts are valid.

The engine processes each timestamp in this order:

1. land due cards;
2. apply landing special effects;
3. expire guards;
4. resolve due attacks;
5. apply the complete damage batch;
6. determine the result.

Commands are ordered by monotonic release time and stable card instance ID.
Player assignment to the first ID alternates with the match seed. Pausing or
hiding the page freezes travel, regeneration, refills, and center deadlines.

### Initial 20-card deck

- **Kopfnuss** ×3 — attack, Kopf, cost 2, damage 1, fuse 1,800 ms.
- **Bauchklatscher** ×3 — attack, Bauch, cost 2, damage 1, fuse 1,600 ms.
- **Schienbein-Schreck** ×3 — attack, Beine, cost 2, damage 1, fuse 1,400 ms.
- **Doppelwumms** ×1 — attack, chosen lane, cost 4, damage 2, fuse 2,600 ms.
- **Dickschädel** ×2 — guard, Kopf, cost 1, duration 3,000 ms.
- **Bauch rein!** ×2 — guard, Bauch, cost 1, duration 2,800 ms.
- **Hopser** ×2 — guard, Beine, cost 1, duration 2,400 ms.
- **Retourkutsche** ×2 — special, chosen lane, cost 3. Discard the oldest armed
  enemy attack there and create a friendly 1-damage return attack with a
  1,500 ms fuse. It visibly fizzles when there is no target.
- **Ablenkungsmanöver** ×1 — special, chosen lane, cost 2. Move the oldest armed
  enemy attack there to the next healthy zone in the order Kopf → Bauch → Beine.
  It visibly fizzles when no alternative is healthy.
- **Jetzt erst recht!** ×1 — special, cost 2. Reduce all currently armed friendly
  attack deadlines by 600 ms, but never below 300 ms from now.

All values are balance constants. A typical match should last 60–120 seconds.

## Screen and feedback

The board fills `100dvh` and respects safe-area insets. The upper player's
controls are rotated 180 degrees. The shared center uses mirrored labels so each
side can read status. Landscape orientation displays a request to rotate.

The first match teaches three facts: break two zones, flick attacks, and answer
before the ring empties. A mirrored three-second countdown follows. A start
button requests browser fullscreen; refusal does not prevent play.

Each result combines motion, text, symbol, and color: `TREFFER`, `GEBLOCKT`,
`UMGELEITET`, `KONTER`, or `VERPUFFT`. Sound and vibration are optional and
never required. Reduced-motion mode replaces travel and shake effects with
short fades. Large controls, high contrast, semantic buttons, visible focus,
and live status announcements support non-gesture and assistive use.

## Technical design

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

## Acceptance criteria

- Two people can drag different cards at once; neither blocks the other.
- A complete match is playable at 320×568 through 430×932 portrait sizes
  without document scrolling.
- Every card leaves the center through resolution, consumption, or timeout.
- Dampf cannot become negative and one staged card cannot be played twice.
- Same seed and timestamped command sequence produce the same result.
- Simultaneous lethal damage produces Doppel-K.O.
- Hiding the page cannot resolve cards or regenerate resources.
- Tap controls can complete a match without flick gestures.
- Reduced motion and muted sound preserve all gameplay information.
- A production build works from a GitHub repository subpath.
