// Shared view helpers: escaping, theme colours read from CSS tokens, fixed-order category colours.
import { t } from '../i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function theme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    surface: v('--surface'), ink: v('--ink'), ink2: v('--ink-2'), muted: v('--muted'), grid: v('--grid'), axis: v('--axis'),
    critical: v('--critical'), warning: v('--warning'), accent: v('--accent'),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v('--s' + i)),
  };
}

// Shapes are the second cue next to colour, so categories stay distinguishable without colour vision.
export const SYMBOLS = ['circle', 'rect', 'triangle', 'diamond', 'roundRect', 'pin', 'arrow'];
export const MAX_SLOTS = 7;

/**
 * Category -> { color, symbol, label }. Colour follows the entity: the order comes from `ordered` (whole book, not the
 * current filter), so a filter never repaints the survivors. Past seven categories everything folds into "Other".
 */
export function categoryScale(ordered, th, labelOf = (k) => k, unknownLabel = t('color.unknown')) {
  const map = new Map();
  ordered.slice(0, MAX_SLOTS).forEach((k, i) => map.set(k, { key: k, color: th.series[i], symbol: SYMBOLS[i], label: labelOf(k) }));
  // two neutrals: "other" (folded categories) is darker than "unknown / blank"
  const other = { key: '__other', color: th.muted, symbol: 'circle', label: t('color.other') };
  const unknown = { key: '__unknown', color: th.axis, symbol: 'circle', label: unknownLabel };
  return {
    get: (k) => (k == null || k === '' ? unknown : map.get(k) || other),
    list: () => [...map.values(), ...(ordered.length > MAX_SLOTS ? [other] : [])],
    unknown,
  };
}

/** Values ordered by how often they occur (ties: first seen). */
export function byFrequency(values) {
  const n = new Map();
  values.forEach((v) => v != null && v !== '' && n.set(v, (n.get(v) || 0) + 1));
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

export function legendHtml(items, extra = '') {
  return (
    items.map((i) => `<span><i class="sw ${i.hollow ? 'hollow' : ''}" style="background:${i.color}"></i>${esc(i.label)}</span>`).join('') + extra
  );
}

/** The visible text of a `{ms, prec}` date cell, preferring what the author typed. */
export const cellText = (d) => (d ? d.text || '' : '');
