import type { EffectHandle, EffectService, SemanticEffect } from '../engine/contracts';

interface ActiveEffect {
  handle: EffectHandle;
  timeoutId: number;
}

export class DomEffectService implements EffectService {
  private readonly active = new Set<ActiveEffect>();
  private readonly reducedMotion: boolean;

  constructor() {
    this.reducedMotion =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
  }

  play(
    kind: SemanticEffect,
    target: HTMLElement | null,
    options?: { text?: string },
  ): EffectHandle {
    const effect: ActiveEffect = {
      handle: { cancel: () => undefined },
      timeoutId: 0,
    };

    if (target) {
      target.classList.add(`effect-${kind}`);
      if (this.reducedMotion) target.classList.add('effect-reduced');
      if (options?.text) target.dataset.effectText = options.text;
    }

    effect.handle = {
      cancel: () => this.cancelEffect(effect, target),
    };
    effect.timeoutId = window.setTimeout(() => this.cancelEffect(effect, target), this.reducedMotion ? 180 : 420);
    this.active.add(effect);
    return effect.handle;
  }

  cancelAll(): void {
    for (const effect of [...this.active]) {
      effect.handle.cancel();
    }
  }

  private cancelEffect(effect: ActiveEffect, target: HTMLElement | null): void {
    window.clearTimeout(effect.timeoutId);
    this.active.delete(effect);
    if (!target) return;
    target.classList.remove('effect-impact', 'effect-block', 'effect-celebrate', 'effect-warning', 'effect-reduced');
    delete target.dataset.effectText;
  }
}

export function createEffectService(): DomEffectService {
  return new DomEffectService();
}
