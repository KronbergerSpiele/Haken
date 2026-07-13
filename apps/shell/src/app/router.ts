const GAME_PARAM = 'game';

type UrlLike = Pick<Location, 'href'>;

export interface RouteState {
  gameId: string | null;
}

export function readRouteState(location: UrlLike = window.location): RouteState {
  const params = new URLSearchParams(new URL(location.href).search);
  const raw = params.get(GAME_PARAM);
  if (!raw) return { gameId: null };
  const decoded = decodeURIComponent(raw).trim();
  return decoded ? { gameId: decoded } : { gameId: null };
}

export function buildUrl(gameId: string | null, location: UrlLike = window.location): string {
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  if (gameId) url.searchParams.set(GAME_PARAM, gameId);
  return url.toString();
}

export function buildShareUrl(gameId: string, location: UrlLike = window.location): string {
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  url.searchParams.set(GAME_PARAM, gameId);
  return url.toString();
}

export function pushGameRoute(gameId: string, fromLauncher = false): void {
  history.pushState({ gameId, fromLauncher }, '', buildUrl(gameId));
}

export function replaceGameRoute(gameId: string | null): void {
  history.replaceState({ gameId }, '', buildUrl(gameId));
}

export function clearInvalidGameRoute(): void {
  replaceGameRoute(null);
}

export type RouteListener = (state: RouteState) => void;

export function subscribeRoute(listener: RouteListener): () => void {
  const handler = (): void => listener(readRouteState());
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}

export function routeStartedFromLauncher(): boolean {
  return history.state?.fromLauncher === true;
}
