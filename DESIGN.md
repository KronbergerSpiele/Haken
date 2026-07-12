# Haken — game design document

## Product

Haken is a local battle between two fictional German AI models, K.I. Klaus and
Bot Brigitte, played simultaneously on one phone. One player sits at each end of
a portrait-oriented device. Both spend tokens and flick cards from their staging
areas into a shared three-lane arena; there are no turns, rounds, or
active-player locks.

The presentation combines German bureaucratic humor with cartoon AI chaos:
overheated servers, stern guardrails, terminal symbols, impact stars, and absurd
model names. It contains no gore and does not imitate or demean real people.

## Match rules

### Objective

Each model has three system zones:

- **Kontext**, symbol ▣
- **Logik**, symbol ⌘
- **Ausgabe**, symbol ›_

Every zone starts with 3 health. A zone is *kaputt* at zero health. Breaking two
of the opponent's zones wins. Damage due in the same simulation step is applied
as one batch. If both fighters break a second zone in that batch, the result is
**Doppel-K.O.**

### Tokens and staging

- Each model starts with 3 tokens, can hold 6, and gains 1 every 1,200 ms.
- The two decks are identical but shuffled independently from a reproducible
  match seed.
- Four face-up cards are staged for each player.
- A legal release reserves its tokens immediately. The emptied slot receives a
  new card 900 ms after the played card lands.
- When the draw pile is empty, shuffle the discard pile into a new draw pile.

### Flicking

The bottom fighter flicks upward; the top fighter flicks downward. A valid flick
moves at least 28 CSS pixels toward the center or exceeds the configured release
velocity. Weak, backward, unaffordable, and otherwise illegal flicks return to
their slots without changing game state.

Fixed-zone cards can only be released into their printed lane. The two wildcard
cards can be released into any lane and use the horizontal release position.
Only a valid intended lane is highlighted during the drag; releasing over
another lane returns the card to its slot. Travel lasts 220–480 ms, based on
release speed. A card's timeout starts only when it lands.

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
- Attacks do not cancel attacks. Exchanged hits and double knockouts are valid.

The engine processes each timestamp in this order:

1. land due cards;
2. expire guards;
3. resolve due attacks;
4. apply the complete damage batch;
5. determine the result.

Commands are ordered by monotonic release time and stable card instance ID.
Player assignment to the first ID alternates with the match seed. Pausing or
hiding the page freezes travel, regeneration, refills, and center deadlines.

### Initial 22-card deck

- **Kontextzertrümmerungshammer** ×3 — attack, Kontext, cost 2, damage 1, fuse 2,700 ms.
- **Logikverdrehungsmaschine** ×3 — attack, Logik, cost 2, damage 1, fuse 2,400 ms.
- **Ausgabeverwüstungskanone** ×3 — attack, Ausgabe, cost 2, damage 1, fuse 2,100 ms.
- **Rechenleistungsüberlastungsgewitter** ×2 — attack, chosen lane, cost 4,
  damage 2, fuse 3,900 ms.
- **Kontextzusammenprallschutzpolster** ×3 — guard, Kontext, cost 1,
  duration 4,200 ms.
- **Logikfehlerabwehrschild** ×3 — guard, Logik, cost 1, duration 3,900 ms.
- **Ausgabeschadensbegrenzungsfilter** ×3 — guard, Ausgabe, cost 1,
  duration 3,600 ms.
- **Bundesrundumverteidigungszaun** ×2 — guard, chosen lane, cost 2,
  duration 3,000 ms.

All values are balance constants. A typical match should last 90–150 seconds.

## Screen and feedback

The board fills `100dvh` and respects safe-area insets. The upper player's
controls are rotated 180 degrees. The shared center uses mirrored labels so each
side can read status. Landscape orientation displays a request to rotate.

The first match teaches the complete rules: break two zones, match fixed cards
to their printed lane, and spend more for flexible wildcard cards. A mirrored
three-second countdown follows. A start button requests browser fullscreen;
refusal does not prevent play.

Each result combines motion, text, symbol, and color: `TREFFER` or `GEBLOCKT`.
Sound and vibration are optional and never required. Reduced-motion mode
replaces travel and shake effects with short fades. Large controls, high
contrast, semantic buttons, visible focus, and live status announcements
support non-gesture and assistive use.

## Acceptance criteria

- Two people can drag different cards at once; neither blocks the other.
- A complete match is playable at 320×568 through 430×932 portrait sizes
  without document scrolling.
- Every card leaves the center through resolution, consumption, or timeout.
- Tokens cannot become negative and one staged card cannot be played twice.
- Same seed and timestamped command sequence produce the same result.
- Simultaneous lethal damage produces Doppel-K.O.
- Hiding the page cannot resolve cards or regenerate resources.
- Tap controls can complete a match without flick gestures.
- Reduced motion and muted sound preserve all gameplay information.
- A production build works from a GitHub repository subpath.
