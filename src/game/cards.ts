import type { CardDefinition, Zone } from './types';

export const BALANCE = {
  zoneHealth: 3,
  startingTokens: 3,
  maxTokens: 6,
  tokenIntervalMs: 1_200,
  handSize: 4,
  refillDelayMs: 900,
  announcementMs: 1_100,
  minFlickDistance: 28,
  minTravelMs: 220,
  maxTravelMs: 480,
} as const;

export const ZONE_LABELS: Record<Zone, string> = {
  kontext: 'Kontext',
  logik: 'Logik',
  output: 'Ausgabe',
};

export const ZONE_SYMBOLS: Record<Zone, string> = {
  kontext: '▣',
  logik: '⌘',
  output: '›_',
};

export const CARD_DEFINITIONS = [
  {
    id: 'system-hammer',
    name: 'System-Hammer',
    shortName: 'Angriff',
    kind: 'attack',
    cost: 2,
    copies: 12,
    zone: 'choice',
    durationMs: 2_600,
    damage: 1,
    description: 'Wähle eine Spur. Verursacht dort 1 Treffer.',
  },
  {
    id: 'guardrail',
    name: 'Guardrail',
    shortName: 'Schutz',
    kind: 'guard',
    cost: 1,
    copies: 10,
    zone: 'choice',
    durationMs: 4_000,
    description: 'Wähle eine Spur. Blockt dort den nächsten Angriff.',
  },
] as const satisfies readonly CardDefinition[];

export const CARD_BY_ID: ReadonlyMap<string, CardDefinition> = new Map(
  CARD_DEFINITIONS.map((card) => [card.id, card]),
);
