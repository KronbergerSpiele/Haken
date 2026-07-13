import animalsUrl from './assets/animals.webp';
import cardBackUrl from './assets/card-back.webp';
import { PREDATOR_GRAPH, SPECIES, canEat, cardValue } from './cards';
import type { PlayerId, Species } from './model';
import { html, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

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

export function speciesSpriteStyles(species: Species): Record<string, string> {
  const { x, y } = spritePosition(species);
  const posX = SPRITE_COLS > 1 ? (x / (SPRITE_COLS - 1)) * 100 : 0;
  const posY = SPRITE_ROWS > 1 ? (y / (SPRITE_ROWS - 1)) * 100 : 0;
  return {
    '--zoff-sprite-x': `${posX}%`,
    '--zoff-sprite-y': `${posY}%`,
  };
}

export function preyOf(species: Species): Species[] {
  return SPECIES.filter((prey) => canEat(species, prey));
}

export function predatorsOf(species: Species): Species[] {
  return [...PREDATOR_GRAPH[species]];
}

export function speciesIconTemplate(
  species: Species,
  variant: 'prey' | 'predator',
): TemplateResult {
  const label = speciesLabel(species);
  return html`
    <span
      class="zoff-eat-icon zoff-eat-icon--${variant}"
      style=${styleMap(speciesSpriteStyles(species))}
      role="img"
      aria-label=${label}
      title=${label}
    >
      <span
        class="zoff-eat-icon__art"
        style=${styleMap({ 'background-image': `url('${animalsUrl}')` })}
      ></span>
    </span>
  `;
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

export function eatingIndicatorsTemplate(species: Species): TemplateResult {
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

  return html`
    <div class="zoff-eat-indicators" aria-hidden="true">
      <span
        class="zoff-eat-indicators__prey"
        title=${preyText}
        aria-label=${`Beute: ${preyText}`}
      >
        ${prey.map((entry) => speciesIconTemplate(entry, 'prey'))}
      </span>
      <span
        class="zoff-eat-indicators__predators"
        title=${predatorText}
        aria-label=${`Jäger: ${predatorText}`}
      >
        ${predators.map((entry) => speciesIconTemplate(entry, 'predator'))}
      </span>
    </div>
  `;
}

export interface EatingChainGroup {
  player: PlayerId;
  row: number;
  species: readonly Species[];
}

export function eatingChainGroupTemplate(group: EatingChainGroup): TemplateResult {
  const names = group.species.map((entry) => speciesLabel(entry)).join(' → ');
  const label = `Fresskette in Reihe ${group.row + 1}: ${names}`;
  return html`
    <section
      class="zoff-eating-overlay"
      role="status"
      aria-live="polite"
      aria-label=${label}
    >
      <p class="zoff-eating-overlay__row">Reihe ${group.row + 1}</p>
      <div class="zoff-eating-overlay__burst" aria-hidden="true">
        ${group.species.map((entry, index) => html`
          ${speciesIconTemplate(entry, 'prey')}
          ${index < group.species.length - 1
            ? html`<span class="zoff-chain-bite" aria-hidden="true">→</span>`
            : ''}
        `)}
      </div>
      <p class="zoff-eating-overlay__label">Fresskette!</p>
      <p class="zoff-eating-overlay__names">${names}</p>
    </section>
  `;
}

export function eatingChainsOverlayTemplate(chains: readonly EatingChainGroup[]): TemplateResult {
  return html`${chains
    .filter((chain) => chain.species.length >= 3)
    .map((chain) => eatingChainGroupTemplate(chain))}`;
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

export function eatConnectorTemplate(link: AdjacentEatLink): TemplateResult {
  const chainClass = link.chainLength >= 3 ? ' zoff-eat-link--chain' : '';
  return html`
    <div
      class="zoff-eat-link${chainClass}"
      style=${styleMap({ '--zoff-link-col': String(link.col) })}
      aria-hidden="true"
    >
      <span class="zoff-eat-link__arrow">→</span>
      ${link.chainLength >= 3
        ? html`<span class="zoff-eat-link__chain">${link.chainLength}er-Kette</span>`
        : ''}
    </div>
  `;
}

export function cardFaceTemplate(species: Species, options?: { compact?: boolean }): TemplateResult {
  const compact = options?.compact ? ' zoff-card-face--compact' : '';
  return html`
    <div class="zoff-card-face${compact}" style=${styleMap(speciesSpriteStyles(species))}>
      <span
        class="zoff-card-art"
        style=${styleMap({ 'background-image': `url('${animalsUrl}')` })}
      ></span>
      <span class="zoff-card-caption">
        <strong>${speciesLabel(species)}</strong>
        <em>${speciesValueLabel(species)}</em>
      </span>
    </div>
  `;
}

export function cardBackTemplate(options?: { compact?: boolean }): TemplateResult {
  const compact = options?.compact ? ' zoff-card-back--compact' : '';
  return html`
    <div class="zoff-card-back${compact}" aria-hidden="true">
      <span
        class="zoff-card-art"
        style=${styleMap({ 'background-image': `url('${cardBackUrl}')` })}
      ></span>
    </div>
  `;
}

export function privateDrawTemplate(species: Species): TemplateResult {
  return html`
    <section class="zoff-private-draw" aria-label="Gezogene Karte nur für den aktiven Spieler">
      <p class="zoff-private-draw__hint">Nur du siehst diese Karte.</p>
      ${cardFaceTemplate(species)}
    </section>
  `;
}
