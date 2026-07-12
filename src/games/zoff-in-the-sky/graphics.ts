import animalsUrl from './assets/animals.webp';
import cardBackUrl from './assets/card-back.webp';
import { PREDATOR_GRAPH, SPECIES, canEat, cardValue } from './cards';
import type { Species } from './model';
import { escapeHtml } from '../../graphics/primitives';

const SPRITE_COLS = 4;
const SPRITE_ROWS = 3;

const SPECIES_INDEX = new Map<Species, number>(
  SPECIES.map((species, index) => [species, index]),
);

export const SPECIES_LABELS: Readonly<Record<Species, string>> = {
  whale: 'Wal',
  elephant: 'Elefant',
  crocodile: 'Krokodil',
  'polar-bear': 'Eisbär',
  lion: 'Löwe',
  seal: 'Robbe',
  fox: 'Fuchs',
  perch: 'Barsch',
  hedgehog: 'Igel',
  fish: 'Fisch',
  mouse: 'Maus',
  mosquito: 'Mücke',
};

export function speciesLabel(species: Species): string {
  return SPECIES_LABELS[species];
}

export function speciesValueLabel(species: Species): string {
  const value = cardValue(species);
  return value > 0 ? `+${value}` : `${value}`;
}

function spritePosition(species: Species): { x: number; y: number } {
  const index = SPECIES_INDEX.get(species) ?? 0;
  return {
    x: index % SPRITE_COLS,
    y: Math.floor(index / SPRITE_COLS),
  };
}

export function speciesSpriteStyle(species: Species): string {
  const { x, y } = spritePosition(species);
  const posX = SPRITE_COLS > 1 ? (x / (SPRITE_COLS - 1)) * 100 : 0;
  const posY = SPRITE_ROWS > 1 ? (y / (SPRITE_ROWS - 1)) * 100 : 0;
  return `--zoff-sprite-x:${posX}%;--zoff-sprite-y:${posY}%;`;
}

export function preyOf(species: Species): Species[] {
  return SPECIES.filter((prey) => canEat(species, prey));
}

export function predatorsOf(species: Species): Species[] {
  return [...PREDATOR_GRAPH[species]];
}

export function speciesIconMarkup(
  species: Species,
  variant: 'prey' | 'predator',
): string {
  const label = speciesLabel(species);
  return `<span class="zoff-eat-icon zoff-eat-icon--${variant}" style="${speciesSpriteStyle(species)}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><span class="zoff-eat-icon__art" style="background-image:url('${animalsUrl}')"></span></span>`;
}

export function eatingRelationLabel(species: Species): string {
  const prey = preyOf(species);
  const predators = predatorsOf(species);
  const preyText =
    prey.length > 0
      ? prey.map((entry) => speciesLabel(entry)).join(', ')
      : 'keine Beute';
  const predatorText =
    predators.length > 0
      ? predators.map((entry) => speciesLabel(entry)).join(', ')
      : 'keine Jäger';
  return `Frisst: ${preyText}. Gefressen von: ${predatorText}.`;
}

export function eatingIndicatorsMarkup(species: Species): string {
  const prey = preyOf(species);
  const predators = predatorsOf(species);
  const preyText =
    prey.length > 0
      ? prey.map((entry) => speciesLabel(entry)).join(', ')
      : 'keine Beute';
  const predatorText =
    predators.length > 0
      ? predators.map((entry) => speciesLabel(entry)).join(', ')
      : 'keine Jäger';

  return `<div class="zoff-eat-indicators" aria-hidden="true">
    <span class="zoff-eat-indicators__prey" title="${escapeHtml(preyText)}" aria-label="Beute: ${escapeHtml(preyText)}">
      ${prey.map((entry) => speciesIconMarkup(entry, 'prey')).join('')}
    </span>
    <span class="zoff-eat-indicators__predators" title="${escapeHtml(predatorText)}" aria-label="Jäger: ${escapeHtml(predatorText)}">
      ${predators.map((entry) => speciesIconMarkup(entry, 'predator')).join('')}
    </span>
  </div>`;
}

export function eatingChainOverlayMarkup(species: readonly Species[]): string {
  const steps = species
    .map(
      (entry, index) =>
        `${speciesIconMarkup(entry, 'prey')}${
          index < species.length - 1
            ? '<span class="zoff-chain-bite" aria-hidden="true">→</span>'
            : ''
        }`,
    )
    .join('');
  const names = species.map((entry) => speciesLabel(entry)).join(' → ');
  return `<div class="zoff-eating-overlay" role="status" aria-live="polite" aria-label="Fresskette: ${escapeHtml(names)}">
    <div class="zoff-eating-overlay__burst" aria-hidden="true">${steps}</div>
    <p class="zoff-eating-overlay__label">Fresskette!</p>
    <p class="zoff-eating-overlay__names">${escapeHtml(names)}</p>
  </div>`;
}

export interface AdjacentEatLink {
  row: number;
  col: number;
  predator: Species;
  prey: Species;
  chainLength: number;
}

export function findAdjacentEatLinks(
  rowSpecies: Array<Species | null>,
): AdjacentEatLink[] {
  const links: AdjacentEatLink[] = [];
  for (let col = 0; col < rowSpecies.length - 1; col += 1) {
    const left = rowSpecies[col];
    const right = rowSpecies[col + 1];
    if (!left || !right) continue;
    if (!canEat(right, left)) continue;

    let start = col;
    while (start > 0) {
      const prev = rowSpecies[start - 1];
      const current = rowSpecies[start];
      if (!prev || !current || !canEat(current, prev)) break;
      start -= 1;
    }

    let end = col + 1;
    while (end < rowSpecies.length - 1) {
      const current = rowSpecies[end];
      const next = rowSpecies[end + 1];
      if (!current || !next || !canEat(next, current)) break;
      end += 1;
    }

    links.push({
      row: 0,
      col,
      predator: right,
      prey: left,
      chainLength: end - start + 1,
    });
  }
  return links;
}

export function eatConnectorMarkup(link: AdjacentEatLink): string {
  const chainClass = link.chainLength >= 3 ? ' zoff-eat-link--chain' : '';
  const chainNote =
    link.chainLength >= 3
      ? `<span class="zoff-eat-link__chain">${link.chainLength}er-Kette</span>`
      : '';
  return `<div class="zoff-eat-link${chainClass}" style="--zoff-link-col:${link.col}" aria-hidden="true">
    <span class="zoff-eat-link__arrow">→</span>
    ${chainNote}
  </div>`;
}

export function cardFaceMarkup(species: Species, options?: { compact?: boolean }): string {
  const compact = options?.compact ? ' zoff-card-face--compact' : '';
  return `<div class="zoff-card-face${compact}" style="${speciesSpriteStyle(species)}">
    <span class="zoff-card-art" style="background-image:url('${animalsUrl}')"></span>
    <span class="zoff-card-caption">
      <strong>${escapeHtml(speciesLabel(species))}</strong>
      <em>${speciesValueLabel(species)}</em>
    </span>
  </div>`;
}

export function cardBackMarkup(options?: { compact?: boolean }): string {
  const compact = options?.compact ? ' zoff-card-back--compact' : '';
  return `<div class="zoff-card-back${compact}" aria-hidden="true">
    <span class="zoff-card-art" style="background-image:url('${cardBackUrl}')"></span>
  </div>`;
}

export function privateDrawMarkup(species: Species): string {
  return `<section class="zoff-private-draw" aria-label="Gezogene Karte nur für den aktiven Spieler">
    <p class="zoff-private-draw__hint">Nur du siehst diese Karte.</p>
    ${cardFaceMarkup(species)}
  </section>`;
}
