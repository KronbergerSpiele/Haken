import { describe, expect, it } from 'vitest';
import {
  buildShareUrl,
  buildUrl,
  readRouteState,
} from './router';

describe('router', () => {
  const base = new URL('https://example.test/repo/page/');

  it('reads and writes the game query parameter', () => {
    expect(readRouteState(base)).toEqual({ gameId: null });

    const withGame = new URL('https://example.test/repo/page/?game=haken&noise=1', base);
    expect(readRouteState(withGame)).toEqual({ gameId: 'haken' });
    expect(buildUrl('haken', withGame)).toBe('https://example.test/repo/page/?game=haken');
    expect(buildUrl(null, withGame)).toBe('https://example.test/repo/page/');
  });

  it('builds share urls with only the game parameter', () => {
    const location = new URL('https://example.test/repo/page/?game=haken&foo=bar#section', base);
    expect(buildShareUrl('haken', location)).toBe('https://example.test/repo/page/?game=haken');
  });

  it('decodes encoded game ids exactly once', () => {
    const location = new URL('https://example.test/repo/page/?game=haken%20beta', base);
    expect(readRouteState(location)).toEqual({ gameId: 'haken beta' });
  });
});
