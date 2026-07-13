import { nothing, svg, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import type { CardDefinition, PlayerId, Zone } from './model';

export type AvatarMood = 'ready' | 'winner' | 'bonk' | 'hit' | 'block' | 'action';

function svgGraphic(
  className: string,
  body: string,
  viewBox = '0 0 64 64',
  style?: string,
): TemplateResult {
  return svg`<svg
    class=${className}
    viewBox=${viewBox}
  aria-hidden="true"
    focusable="false"
    style=${style ?? nothing}
  >${unsafeSVG(body)}</svg>`;
}

export function fighterAvatar(
  player: PlayerId,
  mood: AvatarMood = 'ready',
  animationAgeMs = 0,
): TemplateResult {
  const face =
    mood === 'winner' || mood === 'action'
      ? '<path d="M22 39q10 12 20 0" fill="none" stroke="currentColor" stroke-width="3"/><path d="m18 28 4-4 4 4m12 0 4-4 4 4" fill="none" stroke="currentColor" stroke-width="3"/>'
      : mood === 'bonk' || mood === 'hit'
        ? '<path d="m18 24 8 8m0-8-8 8m20-8 8 8m0-8-8 8M24 43q8-7 16 0" fill="none" stroke="currentColor" stroke-width="3"/>'
        : '<g class="avatar-eyes"><circle cx="23" cy="28" r="3"/><circle cx="41" cy="28" r="3"/></g><path d="M24 41q8 6 16 0" fill="none" stroke="currentColor" stroke-width="3"/>';
  const style = `--avatar-delay:-${Math.max(0, animationAgeMs)}ms`;

  if (player === 0) {
    return svgGraphic(
      `fighter-avatar fighter-avatar--klaus fighter-avatar--${mood}`,
      `<path class="avatar-steam" d="M17 8c-7-6 5-7 0-13M47 8c7-6-5-7 0-13" fill="none" stroke="currentColor" stroke-width="3"/>
       <path d="M22 10 19 3m23 7 3-7M14 14h36l5 9v27l-8 8H17l-8-8V23z" fill="#8ed0e9" stroke="currentColor" stroke-width="3"/>
       <path d="M9 27 3 31v15l6 4m46-23 6 4v15l-6 4" fill="#ffc928" stroke="currentColor" stroke-width="3"/>
       <path d="M17 15h30l-3-6H20z" fill="#ffc928" stroke="currentColor" stroke-width="3"/>
       ${face}
       <path d="M28 51h8" stroke="currentColor" stroke-width="3"/>`,
      '0 0 64 64',
      style,
    );
  }

  return svgGraphic(
    `fighter-avatar fighter-avatar--brigitte fighter-avatar--${mood}`,
    `<path d="M13 23Q14 7 32 7t19 16v27l-8 8H21l-8-8z" fill="#fff0bd" stroke="currentColor" stroke-width="3"/>
     <path d="M12 25Q13 5 32 5t20 20l-10-7-8 6-8-6-14 9z" fill="#e84a34" stroke="currentColor" stroke-width="3"/>
     <path d="M12 27 5 32v15l8 3m39-23 7 5v15l-8 3" fill="#308ac4" stroke="currentColor" stroke-width="3"/>
     ${face}
     <g class="avatar-clipboard">
       <path d="M45 42h10v15H38V47z" fill="#fff" stroke="currentColor" stroke-width="3"/>
       <path d="m42 50 3 3 6-7" fill="none" stroke="#40a462" stroke-width="3"/>
     </g>`,
    '0 0 64 64',
    style,
  );
}

export function cardGraphic(card: CardDefinition): TemplateResult {
  const graphicById: Record<string, string> = {
    'kontext-kollaps':
      '<path d="m14 42 22-22 8 8-22 22zM35 15l7-7 14 14-7 7z" fill="#fff0bd" stroke="currentColor" stroke-width="3"/><path d="m10 18 8 4-7 5m35 14 8 4-7 5" fill="none" stroke="currentColor" stroke-width="3"/>',
    denkfehler:
      '<path d="M12 35c0-15 9-25 20-25s20 10 20 25c0 9-7 17-20 17S12 44 12 35Z" fill="#fff0bd" stroke="currentColor" stroke-width="3"/><path d="m18 31 9-8 8 10 11-9M20 42l8-6 7 8 10-7" fill="none" stroke="currentColor" stroke-width="3"/>',
    'output-salat':
      '<path d="M8 31h20l15-12v30L28 37H8z" fill="#fff0bd" stroke="currentColor" stroke-width="3"/><path d="m48 20 7-7m-6 18h11m-12 9 8 8" stroke="currentColor" stroke-width="3"/>',
    tokensturm:
      '<path d="M14 38c-9-12 6-23 16-14 5-14 27-7 24 8 12 6 2 20-8 18H18c-11 0-15-9-4-12Z" fill="#fff0bd" stroke="currentColor" stroke-width="3"/><path d="m34 30-8 12h8l-4 14 12-18h-8z" fill="#ffc928" stroke="currentColor" stroke-width="2"/>',
    'kontext-puffer':
      '<path d="M10 19q22-13 44 0v27q-22 13-44 0z" fill="#fff0bd" stroke="currentColor" stroke-width="3"/><path d="M17 23q15-8 30 0v19q-15 8-30 0z" fill="#8ed0e9" stroke="currentColor" stroke-width="2"/>',
    'plausi-check':
      '<path d="M32 6 53 15v16c0 14-10 23-21 27C21 54 11 45 11 31V15z" fill="#fff0bd" stroke="currentColor" stroke-width="3"/><path d="m20 31 8 8 17-19" fill="none" stroke="#40a462" stroke-width="5"/>',
    'output-filter':
      '<path d="M8 10h48L39 32v18l-14 7V32z" fill="#fff0bd" stroke="currentColor" stroke-width="3"/><path d="M18 18h28M23 25h18" stroke="currentColor" stroke-width="3"/>',
    'bundes-guardrail':
      '<path d="M7 17h50M7 34h50M13 10v42m13-42v42m13-42v42m13-42v42" stroke="currentColor" stroke-width="4"/><path d="m8 52 6-8 6 8 6-8 6 8 6-8 6 8 6-8 6 8" fill="#ffc928" stroke="currentColor" stroke-width="2"/>',
  };
  return svgGraphic('card-graphic', graphicById[card.id] ?? '');
}

export function zoneDoodle(zone: Zone): TemplateResult {
  const doodles: Record<Zone, string> = {
    kontext:
      '<path d="M8 18h20l5 7h23v29H8z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 12h20l5 7h17v6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 34h32M16 42h25" stroke="currentColor" stroke-width="3"/>',
    logik:
      '<path d="M20 8v10m24-10v10M20 46v10m24-10v10M8 20h10M8 44h10m28-24h10m-10 24h10M18 18h28v28H18z" fill="none" stroke="currentColor" stroke-width="3"/><path d="m25 32 5 5 10-12" fill="none" stroke="currentColor" stroke-width="4"/>',
    output:
      '<path d="M7 12h50v40H7z" fill="none" stroke="currentColor" stroke-width="3"/><path d="m15 25 8 7-8 7m13 0h18" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="14" cy="18" r="2"/><circle cx="21" cy="18" r="2"/>',
  };
  return svgGraphic(`zone-doodle zone-doodle--${zone}`, doodles[zone]);
}

export function impactGraphic(text: string): TemplateResult {
  const symbol = text.includes('BLOCK')
    ? '✓'
    : text.includes('VERPUFFT')
      ? '…'
      : text.includes('KONTER')
        ? '↩'
        : '!';
  return svgGraphic(
    'impact-graphic',
    `<path d="m32 2 7 15 16-7-5 17 12 7-15 8 5 17-18-6-9 10-5-15-18 4 8-17-9-10 17-4 1-18z" fill="#ffc928" stroke="currentColor" stroke-width="3"/><text x="32" y="42" text-anchor="middle">${symbol}</text>`,
  );
}
