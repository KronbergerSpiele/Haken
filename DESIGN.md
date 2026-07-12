# Mini-game collection — game design document

## Product

The product is a browser-based collection of small multiplayer game prototypes.
Each registered game supplies its own title, instructions, player-count and
device requirements, controls, rules, and visual theme. A shared launcher lets
players choose a game and return to the collection without reloading the site.
The collection is deployed as a static site so a current build can be opened
from a phone while travelling. Installing the site, creating an account, and
connecting to a backend are not required.

### Launcher and game links

The launcher is the collection's home screen. It presents every available game
as a card with its title, short description, player count, orientation, and
shared-device requirements. Each card has a clear play action and a share
action. A game can be opened directly with a stable link such as
`?game=haken`; opening that link starts the requested game after its code loads.

Leaving a game returns to the launcher. Browser Back returns to the launcher
when the game was started there, and browser Forward can reopen it. An unknown
or unavailable game link shows a short message on the launcher instead of a
broken screen. Deep links identify a game, not a running match: scores, seeds,
private state, and in-progress sessions are never included in the URL.

Haken is the first game in the collection. It is a local battle between two
fictional German AI models, K.I. Klaus and Bot Brigitte, played simultaneously
on one phone. One player sits at each end of a portrait-oriented device. Both
spend tokens and flick cards from their staging areas into a shared three-lane
arena; there are no turns, rounds, or active-player locks.

The presentation combines German bureaucratic humor with cartoon AI chaos:
overheated servers, stern guardrails, terminal symbols, impact stars, and absurd
model names. It contains no gore and does not imitate or demean real people.

Zoff in the Sky is the second game in the collection. It is a local,
single-round duel for two people on one portrait phone, inspired by Skyjo grid
play and the non-transitive animal hierarchy from Frank's Zoo (*Zoff im Zoo*).
Players alternate turns, manage hidden three-by-five grids, and try to finish
with the lowest total value. The tone is playful sky-high zoo chaos with
hand-drawn animal cards and no text on the artwork.

## Haken — match rules

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

## Haken — screen and feedback

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

## Zoff in the Sky — match rules

### Objective

Each player owns a personal three-row by five-column grid of fifteen slots.
Every slot starts hidden. The player with the lower sum of face-up card values
after one scored round wins. Equal totals are a draw.

### Setup

- Two players share one device in portrait orientation.
- The match is a single round; there is no match clock.
- Shuffle a fifty-nine-card deck from a reproducible match seed: five copies of
  each of eleven ordinary species plus four Mosquitoes.
- Deal fifteen cards face down into each grid, filling every slot.
- Reveal exactly two hidden cards per player.
- Place the remaining cards face down as the draw pile. Start with an empty
  discard pile.

### Species, values, and deck

Twelve species appear in the deck. Values apply only for end-of-round scoring:

| Species | Value |
| --- | --- |
| Mosquito | −1 |
| Fish, Mouse, Whale | 0 |
| Hedgehog, Perch | 1 |
| Fox, Lion, Seal | 2 |
| Crocodile, Polar Bear | 3 |
| Elephant | 4 |

There is no Joker. Mosquito and Elephant have no special combo rules from
Frank's Zoo.

### Predator graph

Eating uses the original Frank's Zoo non-transitive predator graph restricted
to these twelve species. Each species lists the predators that outrank it in
the source game:

| Species | Outranked by (predators) |
| --- | --- |
| Mosquito | Mouse, Fish |
| Mouse | Hedgehog, Fox |
| Fish | Hedgehog, Crocodile, Seal, Polar Bear, Whale |
| Hedgehog | Fox |
| Fox | Lion, Crocodile, Polar Bear, Elephant |
| Lion | Crocodile, Elephant |
| Crocodile | Polar Bear, Elephant |
| Polar Bear | Elephant, Whale |
| Elephant | Mouse, Whale |
| Whale | Seal |
| Seal | Perch |
| Perch | — |

In a left-to-right chain, each face-up card on the right eats its immediate
left neighbor when the right card's species is a listed predator of the left
card's species.

### Turn structure

Players alternate turns. On a turn the active player chooses exactly one of
these options:

1. **Take discard** — remove the top discard card, if any, and place it into
   one of the active player's occupied slots or empty gaps. A replaced face-up
   card goes to the discard pile. Placing into an empty gap discards nothing.
2. **Inspect draw** — privately look at the top draw card without showing the
   opponent, then either:
   - place that card into an occupied slot or gap with the same replacement
     and discard rules as option 1; or
   - discard the drawn card face up and reveal one still-hidden card in the
     active player's grid.

When the draw pile is empty, shuffle the discard pile to form a new draw pile.

### Horizontal chains

After any placement or reveal, scan each row left to right. For every maximal
contiguous run of three or more face-up cards, repeatedly remove a card when
its immediate right neighbor's species is a listed predator of the left species.
Stop when no such eat remains inside that run. Gaps break contiguity, so chain
resolution never crosses an empty slot. Removed cards do not fall, slide, or
snap closed; gaps stay empty and may be filled on later turns.

### Final turn and scoring

When a player reveals the last hidden card in their own grid, the opponent
receives exactly one more turn. After that turn, reveal every remaining hidden
card, resolve all horizontal chains on both grids, sum each player's face-up
values, and end the round. The lower sum wins; equal sums are a draw.

## Zoff in the Sky — screen and feedback

The board fills `100dvh` and respects safe-area insets. Landscape orientation
displays a request to rotate.

The active player sees their full grid and a compact read-only opponent grid.
Inspected draw cards use pass-device privacy: only the active player may view
the drawn card before placing or discarding it.

Each card shows playful hand-drawn bold-outline animal art. Local optimized
assets are text-free on the card faces; a separate card back is used for hidden
slots.

Eating relationships are communicated twice:

- **Compact edge indicators** on each face-up card: the left edge lists prey the
  card can eat; the right edge lists predators that can eat it.
- **Contextual valid-link connectors** that emphasize legal eat pairs among
  currently adjacent face-up neighbors.

Accessible labels state the relationships in words. Icons and color are never
the only cue for who eats whom.

Sound and vibration are optional and never required. Reduced-motion mode keeps
chain removal and turn changes readable without relying on motion alone. Large
controls, high contrast, semantic buttons, visible focus, and live status
announcements support non-gesture and assistive use.

## Acceptance criteria

### Collection

- The launcher lists every registered game and communicates its player and
  device requirements before play.
- Every registered game has a copyable deep link that works when opened in a
  new tab from the deployed repository subpath.
- Launcher selection, browser Back/Forward, direct game links, and unknown game
  links resolve without a full-page navigation or an error screen.
- A player can leave a game, release its input and effects, and start another
  game without reloading the page.
- Shared presentation components remain consistent, while each game can provide
  its own theme and game-specific artwork.
- Reduced motion and muted sound preserve all gameplay information.
- A production build works from a GitHub repository subpath.

### Haken

- Two people can drag different cards at once; neither blocks the other.
- A complete match is playable at 320×568 through 430×932 portrait sizes
  without document scrolling.
- Every card leaves the center through resolution, consumption, or timeout.
- Tokens cannot become negative and one staged card cannot be played twice.
- Same seed and timestamped command sequence produce the same result.
- Simultaneous lethal damage produces Doppel-K.O.
- Hiding the page cannot resolve cards or regenerate resources.
- Tap controls can complete a match without flick gestures.

### Zoff in the Sky

- A complete single-round match is playable at 320×568 through 430×932 portrait
  sizes without document scrolling.
- Each grid uses fifteen fixed slots; gaps remain after chain removal and can
  be filled later.
- A turn accepts only the documented discard, inspect-and-place, or
  inspect-discard-and-reveal actions.
- Inspected draw cards stay private to the active player until placed or
  discarded.
- Replaced occupied cards enter the discard pile; placements into gaps do not.
- Horizontal chains resolve only inside contiguous face-up runs of three or more
  cards; repeated left-to-right predator eats remove cards and leave gaps with
  no falling or snapping.
- Revealing the last hidden card in a grid grants the opponent exactly one
  further turn before automatic full reveal, chain resolution, and scoring.
- Lowest total value wins; equal totals are a draw.
- Same seed and command sequence produce the same grid, chains, and score.
- Eating indicators and accessible labels express predator and prey relations
  without relying on color or icons alone.
- All twelve species and the card back render from bundled local artwork with
  no text on card faces.
