// Relationship map: characters as nodes, rows of the Relationships sheet as edges, optional co-appearance links.
import { t, getLang } from '../i18n.js';
import { isDropped, charLabel, charFull } from '../load.js';
import { fmtDate } from '../dates.js';
import { esc, categoryScale, byFrequency, legendHtml } from './common.js';

const relActive = (r, asOf) => asOf == null || ((r.start?.ms == null || r.start.ms <= asOf) && (r.end?.ms == null || r.end.ms >= asOf));

export function visibleRelationships(db, state) {
  return db.relationships.filter(
    (r) => state.chars.has(r.a) && state.chars.has(r.b) && (state.showDropped || !isDropped(db, r)) && relActive(r, state.graph.asOf),
  );
}

export function relDateRange(db) {
  const ds = db.relationships.flatMap((r) => [r.start?.ms, r.end?.ms]).filter((x) => x != null);
  return ds.length ? { from: Math.min(...ds), to: Math.max(...ds) } : null;
}

// characters without a group get the neutral "blank" colour rather than a palette slot
function groupScale(db, th) {
  const s = categoryScale(byFrequency(db.characters.map((c) => c.group)), th, (k) => k, t('color.none'));
  return { ...s, items: () => [...s.list(), s.unknown] };
}

export function graphLegend(db, state, th) {
  const scale = groupScale(db, th);
  const used = new Set(db.characters.filter((c) => state.chars.has(c.id)).map((c) => scale.get(c.group).key));
  return legendHtml(scale.items().filter((i) => used.has(i.key)));
}

export function graphOption({ db, state, th }) {
  const lang = getLang();
  const scale = groupScale(db, th);
  const chars = db.characters.filter((c) => state.chars.has(c.id) && (state.showDropped || !isDropped(db, c)));
  const ids = new Set(chars.map((c) => c.id));
  const count = (id) => (db.appsByChar.get(id) || []).filter((a) => !a.mentioned).length;
  const nodes = chars.map((c) => {
    const g = scale.get(c.group);
    return {
      id: c.id,
      name: charLabel(c, lang),
      symbolSize: Math.min(56, 16 + 5 * Math.sqrt(count(c.id))),
      itemStyle: { color: g.color, borderColor: th.surface, borderWidth: 2 },
      label: { show: true, color: th.ink, fontSize: db.main.includes(c.id) ? 14 : 12, fontWeight: db.main.includes(c.id) ? 600 : 400, position: 'right' },
      char: c.id,
    };
  });

  const rels = visibleRelationships(db, state).filter((r) => ids.has(r.a) && ids.has(r.b));
  const pairN = new Map();
  const decided = db.settings.decidedStatus;
  const links = rels.map((r) => {
    const k = [r.a, r.b].sort().join('|');
    const n = pairN.get(k) || 0;
    pairN.set(k, n + 1);
    const firm = !r.status || r.status === decided;
    return {
      source: r.a,
      target: r.b,
      rel: r.id,
      symbol: ['none', r.direction === 'A→B' ? 'arrow' : 'none'],
      symbolSize: 9,
      lineStyle: { color: th.ink2, width: [1.4, 1.4, 2.4, 3.6][Math.round(r.strength || 1)] ?? 1.6, opacity: firm ? 0.85 : 0.45, type: firm ? 'solid' : 'dashed', curveness: n ? 0.18 * n : 0.04 },
      label: { show: state.graph.labels, formatter: (r.type || '').slice(0, 10), color: th.ink2, fontSize: 11 },
    };
  });

  if (state.graph.coapp) {
    const shared = new Map();
    const byEvent = new Map();
    for (const a of db.apps) {
      if (a.mentioned || !ids.has(a.char) || isDropped(db, a.ev)) continue;
      if (!byEvent.has(a.event)) byEvent.set(a.event, new Set());
      byEvent.get(a.event).add(a.char);
    }
    for (const s of db.scenes) if (!s.event) byEvent.set('scene:' + s.id, new Set((s.chars || []).filter((c) => ids.has(c))));
    for (const set of byEvent.values()) {
      const l = [...set];
      for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
        const k = [l[i], l[j]].sort().join('|');
        shared.set(k, (shared.get(k) || 0) + 1);
      }
    }
    for (const [k, n] of shared) {
      const [a, b] = k.split('|');
      links.push({ source: a, target: b, shared: n, lineStyle: { color: th.muted, width: Math.min(5, 0.8 + Math.log2(n + 1)), type: 'dotted', opacity: 0.7, curveness: -0.12 }, label: { show: false } });
    }
  }

  return {
    animationDurationUpdate: 300,
    tooltip: {
      confine: true, backgroundColor: th.surface, borderColor: th.grid, textStyle: { color: th.ink }, extraCssText: 'max-width:340px;white-space:normal',
      formatter: (p) => (p.dataType === 'node' ? nodeTip(db, p.data.char, lang) : edgeTip(db, p.data, lang)),
    },
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true, zoom: 1.1,
      force: { repulsion: 900, edgeLength: [140, 260], gravity: 0.05, friction: 0.15 },      emphasis: { focus: 'adjacency', lineStyle: { opacity: 1 } },
      edgeLabel: { show: state.graph.labels },
      data: nodes, links,
    }],
  };
}

function nodeTip(db, id, lang) {
  const c = db.byId.characters.get(id);
  const n = (db.appsByChar.get(id) || []).length;
  return `<b>${esc(charFull(c, lang))}</b> (${esc(c.id)})${c.role ? '<br>' + esc(c.role) : ''}${c.group ? '<br>' + esc(c.group) : ''}<br>${t('o.events')}: ${n}`;
}

function edgeTip(db, d, lang) {
  const nm = (id) => esc(charFull(db.byId.characters.get(id), lang));
  if (d.shared) return `${nm(d.source)} — ${nm(d.target)}<br>${t('g.shared', { n: d.shared })}`;
  const r = db.byId.relationships.get(d.rel);
  const when = [r.start?.ms != null ? fmtDate(r.start.ms, r.start.prec, lang) : '', r.end?.ms != null ? fmtDate(r.end.ms, r.end.prec, lang) : ''].filter(Boolean).join(' → ');
  const extra = Object.entries(r.extra || {}).map(([k, v]) => `<br><span style="opacity:.7">${esc(k)}:</span> ${esc(v)}`).join('');
  return `<b>${nm(r.a)} ${r.direction === 'A→B' ? '→' : '—'} ${nm(r.b)}</b><br>${esc(r.type)}${r.status ? ` <span class="tag">${esc(r.status)}</span>` : ''}${when ? '<br>' + when : ''}${extra}${r.notes ? '<br>' + esc(r.notes) : ''}`;
}

export function relTableHtml(db, state) {
  const lang = getLang();
  const rels = visibleRelationships(db, state);
  if (!db.relationships.length) return `<p class="hint">${t('g.empty')}</p>`;
  const extraCols = [...new Set(rels.flatMap((r) => Object.keys(r.extra || {})))];
  const nm = (id) => `<button class="link" data-profile="${esc(id)}">${esc(charFull(db.byId.characters.get(id), lang) || id)}</button>`;
  return `<table><thead><tr><th>ID</th><th>A</th><th></th><th>B</th><th>${t('f.type')}</th><th>${t('f.status')}</th>${extraCols.map((c) => `<th>${esc(c)}</th>`).join('')}<th>${t('f.notes')}</th></tr></thead><tbody>${rels
    .map((r) => `<tr><td>${esc(r.id)}</td><td>${nm(r.a)}</td><td>${r.direction === 'A→B' ? '→' : '—'}</td><td>${nm(r.b)}</td><td>${esc(r.type)}</td><td>${esc(r.status || '')}</td>${extraCols.map((c) => `<td class="small">${esc(r.extra?.[c] || '')}</td>`).join('')}<td class="small">${esc(r.notes || '')}</td></tr>`)
    .join('')}</tbody></table>`;
}
