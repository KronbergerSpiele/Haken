import type { GameManifest } from '@spiele/engine/contracts';

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
      import('@spiele/game-haken/session').then(({ createHakenSession }) => ({
        createSession: createHakenSession,
      })),
  },
  {
    id: 'zoff-in-the-sky',
    title: 'Zoff in the Sky',
    description:
      'Ruhiges Tier-Duell für zwei Personen an einem Handy. Verwalte verdeckte Karten und sammle möglichst wenige Punkte.',
    players: { min: 2, max: 2 },
    device: 'shared-screen',
    orientation: 'portrait',
    load: () =>
      import('@spiele/game-zoff-in-the-sky/session').then(({ createZoffSession }) => ({
        createSession: createZoffSession,
      })),
  },
];

export function findManifest(id: string): GameManifest | undefined {
  return CATALOG.find((entry) => entry.id === id);
}

export function allManifestIds(): string[] {
  return CATALOG.map((entry) => entry.id);
}
