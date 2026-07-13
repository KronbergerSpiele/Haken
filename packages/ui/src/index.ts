import { registerCollectionExitElement } from './collection-exit';
import { registerLauncherElement } from './launcher';

let registered = false;

/** Register all shared UI custom elements once per page. Safe to call repeatedly. */
export function registerUiElements(): void {
  if (registered) return;
  registerCollectionExitElement();
  registerLauncherElement();
  registered = true;
}

export {
  SPIELE_COLLECTION_EXIT_TAG,
  SpieleCollectionExit,
  mountCollectionExit,
  registerCollectionExitElement,
} from './collection-exit';
export { LightDomElement } from './light-dom-element';
export {
  SPIELE_LAUNCHER_TAG,
  SpieleLauncher,
  registerLauncherElement,
} from './launcher';
export {
  SPIELE_LAUNCHER_CARD_TAG,
  SpieleLauncherCard,
  registerLauncherCardElement,
} from './launcher-card';
export type { LauncherLoadState } from './launcher-labels';
