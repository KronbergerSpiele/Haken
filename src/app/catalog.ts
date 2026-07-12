import type { GameManifest } from '../engine/contracts';

export const CATALOG: readonly GameManifest[] = [
  {
    id: 'haken',
    title: 'Haken',
    description:
      'Gleichzeitiges Karten-Gerangel für zwei Personen an einem Handy. Zertrümmere zwei gegnerische Systemzonen.',
    players: { min: 2, max: 2 },
    device: 'shared-screen',
    orientation: 'portrait',
    load: () =>
      import('../games/haken/session').then(({ createHakenSession }) => ({
        createSession: createHakenSession,
      })),
  },
];

export function findManifest(id: string): GameManifest | undefined {
  return CATALOG.find((entry) => entry.id === id);
}

export function allManifestIds(): string[] {
  return CATALOG.map((entry) => entry.id);
}
