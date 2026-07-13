import type { CardInstance, Species } from './model';

export const SPECIES = [
  'whale',
  'elephant',
  'crocodile',
  'polar-bear',
  'lion',
  'seal',
  'fox',
  'perch',
  'hedgehog',
  'fish',
  'mouse',
  'mosquito',
] as const satisfies readonly Species[];

export const DECK_COMPOSITION: Readonly<Record<Species, number>> = {
  whale: 5,
  elephant: 5,
  crocodile: 5,
  'polar-bear': 5,
  lion: 5,
  seal: 5,
  fox: 5,
  perch: 5,
  hedgehog: 5,
  fish: 5,
  mouse: 5,
  mosquito: 4,
};

export const CARD_VALUES: Readonly<Record<Species, number>> = {
  mosquito: -1,
  fish: 0,
  mouse: 0,
  whale: 0,
  hedgehog: 1,
  perch: 1,
  fox: 2,
  lion: 2,
  seal: 2,
  crocodile: 3,
  'polar-bear': 3,
  elephant: 4,
};

const PREDATOR_OF: Readonly<Record<Species, readonly Species[]>> = {
  mosquito: ['mouse', 'hedgehog', 'fish'],
  mouse: ['hedgehog', 'polar-bear', 'seal', 'lion', 'crocodile', 'fox'],
  hedgehog: ['fox'],
  fish: ['perch', 'whale', 'seal', 'crocodile'],
  fox: ['polar-bear', 'crocodile', 'lion', 'elephant'],
  perch: ['polar-bear', 'seal', 'crocodile', 'whale'],
  seal: ['polar-bear', 'whale'],
  crocodile: ['elephant'],
  lion: ['elephant'],
  'polar-bear': ['elephant', 'whale'],
  elephant: ['mouse'],
  whale: [],
};

const PREDATOR_LOOKUP: ReadonlyMap<Species, ReadonlySet<Species>> = new Map(
  SPECIES.map((prey) => [prey, new Set(PREDATOR_OF[prey])]),
);

export function canEat(predator: Species, prey: Species): boolean {
  return PREDATOR_LOOKUP.get(prey)?.has(predator) ?? false;
}

export function cardValue(species: Species): number {
  return CARD_VALUES[species];
}

export function totalDeckSize(): number {
  return SPECIES.reduce((sum, species) => sum + DECK_COMPOSITION[species], 0);
}

export function createDeck(): CardInstance[] {
  const deck: CardInstance[] = [];
  let instanceId = 0;
  for (const species of SPECIES) {
    for (let copy = 0; copy < DECK_COMPOSITION[species]; copy += 1) {
      deck.push({ instanceId, species });
      instanceId += 1;
    }
  }
  return deck;
}

export const PREDATOR_GRAPH = PREDATOR_OF;
