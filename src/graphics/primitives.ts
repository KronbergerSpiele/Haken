import type { GraphicsService } from '../engine/contracts';

export class DomGraphicsService implements GraphicsService {
  createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  }

  setText(element: HTMLElement, text: string): void {
    element.textContent = text;
  }

  applyThemeScope(root: HTMLElement, themeId: string): void {
    root.dataset.theme = themeId;
  }

  clearThemeScope(root: HTMLElement): void {
    delete root.dataset.theme;
  }
}

export function createGraphicsService(): DomGraphicsService {
  return new DomGraphicsService();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function svgMarkup(
  className: string,
  body: string,
  viewBox = '0 0 64 64',
  attributes = '',
): string {
  return `<svg class="${className}" viewBox="${viewBox}" ${attributes} aria-hidden="true" focusable="false">${body}</svg>`;
}
