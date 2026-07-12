import { describe, expect, it } from 'vitest';
import { allManifestIds, CATALOG, findManifest } from './catalog';

describe('catalog', () => {
  it('registers unique game ids with valid metadata', () => {
    const ids = allManifestIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('haken');
  });

  it('loads every registered game module', async () => {
    for (const manifest of CATALOG) {
      const module = await manifest.load();
      expect(typeof module.createSession).toBe('function');
    }
  });

  it('finds manifests by id', () => {
    expect(findManifest('haken')?.title).toBe('Haken');
    expect(findManifest('missing')).toBeUndefined();
  });
});
