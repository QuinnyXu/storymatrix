// Character swimlanes (one lane per character, x = story date) and the narrative-order chart.
import { t, getLang } from '../i18n.js';
import { isDropped, ageAt, charLabel, charFull, locName } from '../load.js';
import { fmtDate, DAY, parts, yearLabel, parseStoryDate } from '../dates.js';
import { esc, categoryScale, byFrequency, legendHtml } from './common.js';

export const LANE_H = 44;

/** What a mark is coloured by, per colour mode. */
export function colorKeyFn(db, mode) {
  const loc = (id) => db.byId.locations.get(id);
  switch (mode) {
    case 'locType':
      return (a) => (a.locId ? loc(a.locId)?.type || '' : null);
    case 'region':
      return (a) => (a.locId ? loc(a.locId)?.region || '' : null);
    case 'status':
      return (a) => a.ev.status || '';
    case 'category':
      return (a) => a.ev.category || '';
    default:
      return (a) => a.locId || null;
  }
}

export function colorScale(db, mode, th) {
  const key = colorKeyFn(db, mode);
  const ordered = mode === 'status' ? [...db.settings.statusList] : byFrequency(db.apps.map(key));
  const labelOf = mode === 'location' ? (k) => locName(db, k) : (k) => k || t('color.none');
  const scale = categoryScale(ordered, th, labelOf);
  return { key, scale };
}

export const visibleApps = (db, state) =>
  db.apps.filter((a) => state.chars.has(a.char) && a.dateMs != null && (state.showDropped || !isDropped(db, a.ev)));

const axisDate = (v) => {
  const p = parts(v);
  return p.m === 1 && p.d === 1 ? yearLabel(p.y, getLang()) : `${yearLabel(p.y, getLang())}-${String(p.m).padStart(2, '0')}`;
};

export function laneIds(db, state) {
  return db.characters.filter((c) => state.chars.has(c.id) && (state.showDropped || !isDropped(db, c))).map((c) => c.id);
}

export function timelineOption({ db, checks, state, th }) {
  const lang = getLang();
  const lanes = laneIds(db, state);
  const laneOf = new Map(lanes.map((id, i) => [id, i]));
  const apps = visibleApps(db, state).filter((a) => laneOf.has(a.char));
  const { key, scale } = colorScale(db, state.colorBy, th);
  const range = db.dateRange || { from: Date.UTC(2000, 0, 1), to: Date.UTC(2001, 0, 1) };
  const pad = Math.max(60 * DAY, (range.to - range.from) * 0.03);
  const xmin = range.from - pad;
  const xmax = range.to + pad;
  const zoom = state.zoom || defaultWindow(db, apps, pad);

  // lifelines: from birth (or the left edge) to death (or the right edge)
  const life = lanes.map((id, i) => {
    const c = db.byId.characters.get(id);
    return [Math.max(c.birth?.ms ?? xmin, xmin), Math.min(c.death?.ms ?? xmax, xmax), i];
  });
  const stays = lanes.flatMap((id, i) =>
    (db.staysByChar.get(id) || []).filter((s) => state.showDropped || !isDropped(db, s)).map((s) => {
      const k = state.colorBy === 'location' ? s.loc : colorKeyFn(db, state.colorBy)({ locId: s.loc, ev: {} });
      return { value: [s.startMs, s.endMs + DAY, i], stay: s, color: scale.get(k).color };
    }),
  );
  const ranges = apps.filter((a) => a.ev.end?.ms != null).map((a) => ({ value: [a.dateMs, a.ev.end.ms + DAY, laneOf.get(a.char)], color: scale.get(key(a)).color }));

  const groups = new Map();
  apps.forEach((a) => {
    const cat = scale.get(key(a));
    if (!groups.has(cat.key)) groups.set(cat.key, { cat, data: [] });
    const sev = checks.marks.get(`${a.event}|${a.char}`) || checks.marks.get(`${a.event}|*`);
    const selected = a.event === state.event;
    groups.get(cat.key).data.push({
      value: [a.dateMs, laneOf.get(a.char)],
      app: db.apps.indexOf(a),
      symbol: a.mentioned ? 'emptyCircle' : cat.symbol,
      symbolSize: selected ? 19 : 13,
      itemStyle: {
        color: a.mentioned ? th.surface : cat.color,
        borderColor: sev === 'error' ? th.critical : sev === 'warning' ? th.warning : selected ? th.ink : a.mentioned ? cat.color : th.surface,
        borderWidth: sev === 'error' || sev === 'warning' || selected ? 3 : a.mentioned ? 2 : 1.5,
        opacity: isDropped(db, a.ev) ? 0.35 : 1,
      },
    });
  });

  const band = (h, color, op) => (params, api) => {
    const s = api.coord([api.value(0), api.value(2)]);
    const e = api.coord([api.value(1), api.value(2)]);
    const laneH = api.size([0, 1])[1];
    const rect = echarts.graphic.clipRectByRect({ x: s[0], y: s[1] + h.dy * laneH - h.h / 2, width: Math.max(e[0] - s[0], 2), height: h.h }, { x: params.coordSys.x, y: params.coordSys.y, width: params.coordSys.width, height: params.coordSys.height });
    return rect && { type: 'rect', shape: { ...rect, r: h.h / 2 }, style: { fill: color ?? api.visual('color'), opacity: op } };
  };

  return {
    animation: false,
    grid: { left: 96, right: 24, top: 10, bottom: 56 },
    tooltip: { trigger: 'item', confine: true, backgroundColor: th.surface, borderColor: th.grid, textStyle: { color: th.ink }, extraCssText: 'max-width:360px;white-space:normal', formatter: (p) => tooltip(db, p, lang) },
    xAxis: { type: 'time', min: xmin, max: xmax, axisLabel: { color: th.muted, formatter: axisDate, hideOverlap: true }, axisLine: { lineStyle: { color: th.axis } }, splitLine: { show: true, lineStyle: { color: th.grid } } },
    yAxis: { type: 'category', inverse: true, data: lanes.map((id) => charLabel(db.byId.characters.get(id), lang)), axisLabel: { color: th.ink, fontSize: 13 }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } },
    dataZoom: [
      { type: 'slider', xAxisIndex: 0, filterMode: 'none', height: 18, bottom: 8, borderColor: th.grid, textStyle: { color: th.muted }, labelFormatter: (v) => axisDate(v), ...zoom },
      { type: 'inside', xAxisIndex: 0, filterMode: 'none', ...zoom },
    ],
    series: [
      { type: 'custom', name: '__life', silent: true, renderItem: band({ dy: 0, h: 2 }, th.grid, 1), encode: { x: [0, 1], y: 2 }, data: life, z: 1 },
      { type: 'custom', name: '__stays', renderItem: (p, api) => band({ dy: 0.3, h: 7 }, stays[p.dataIndex].color, 0.45)(p, api), encode: { x: [0, 1], y: 2 }, data: stays, z: 2 },
      { type: 'custom', name: '__ranges', silent: true, renderItem: (p, api) => band({ dy: 0, h: 4 }, ranges[p.dataIndex].color, 0.8)(p, api), encode: { x: [0, 1], y: 2 }, data: ranges, z: 3 },
      ...[...groups.values()].map((g) => ({ type: 'scatter', name: g.cat.label, data: g.data, z: 5, emphasis: { scale: 1.3 } })),
    ],
  };
}

/**
 * First view of the timeline: 设置.显示起始/显示结束 when given; otherwise start at the 10th-percentile date, so one
 * far-back backstory event does not squeeze the main story into a sliver. The slider still reaches everything.
 */
function defaultWindow(db, apps, pad) {
  const from = parseStoryDate(db.settings.rangeFrom)?.ms;
  const to = parseStoryDate(db.settings.rangeTo)?.ms;
  if (from != null || to != null) return { ...(from != null && { startValue: from }), ...(to != null && { endValue: to }) };
  const ds = apps.map((a) => a.dateMs).sort((a, b) => a - b);
  if (ds.length < 10) return {};
  return { startValue: ds[Math.floor(ds.length * 0.1)] - pad };
}

export function timelineLegend(db, state, th) {
  const { key, scale } = colorScale(db, state.colorBy, th);
  const used = new Set(visibleApps(db, state).map((a) => scale.get(key(a)).key));
  const items = scale.list().filter((i) => used.has(i.key));
  if (used.has('__unknown')) items.push(scale.unknown);
  const extra = `<span><i class="sw hollow"></i>${t('f.mentioned')}</span><span><i class="sw bar" style="background:${th.series[0]}"></i>${t('f.stay')}</span>`;
  return legendHtml(items, extra);
}

function tooltip(db, p, lang) {
  if (p.seriesName === '__stays') {
    const s = p.data.stay;
    return `<b>${esc(charFull(db.byId.characters.get(s.char), lang))}</b> · ${t('f.stay')}<br>${esc(locName(db, s.loc))}<br>${fmtDate(s.startMs, s.start.prec, lang)} ${t('f.until')} ${fmtDate(s.endMs, s.end?.prec || s.start.prec, lang)}${s.notes ? '<br>' + esc(s.notes) : ''}`;
  }
  if (p.data?.app == null) return '';
  return appHtml(db, db.apps[p.data.app], lang, true);
}

export function appHtml(db, a, lang, withTitle) {
  const c = db.byId.characters.get(a.char);
  const e = a.ev;
  const age = ageAt(c, a.dateMs);
  const ch = db.byId.chapters.get(e.chapter);
  const lines = [
    withTitle ? `<b>${esc(e.title)}</b>` : '',
    `${esc(charFull(c, lang))}${age != null ? ` · ${t('f.ageAt', { age: age.toFixed(1) })}` : ''}${a.mentioned ? ` <span class="tag">${t('f.mentioned')}</span>` : ''}`,
    `${fmtDate(a.dateMs, e.prec, lang)}${e.end?.ms != null ? ' → ' + fmtDate(e.end.ms, e.end.prec, lang) : ''}${e.timeNote ? ` · ${esc(e.timeNote)}` : ''}`,
    a.locId ? `${t('f.location')}: ${esc(locName(db, a.locId))} <span class="tag">${t('loc.' + a.locSource)}</span>` : '',
    a.action ? `${t('f.action')}: ${esc(a.action)}` : '',
    ch ? `${t('f.chapter')}: ${esc(ch.id)} ${esc(ch.title || '')}` : e.chapter ? `${t('f.chapter')}: ${esc(e.chapter)}` : '',
    e.status ? `${t('f.status')}: ${esc(e.status)}` : '',
  ];
  return lines.filter(Boolean).join('<br>');
}

/** Right-hand panel: the clicked event with every participant. */
export function eventDetailHtml(db, checks, eventId, lang) {
  const e = db.byId.events.get(eventId);
  if (!e) return `<p class="hint">${t('tl.pick')}</p>`;
  const ch = db.byId.chapters.get(e.chapter);
  const kv = [
    [t('f.date'), `${fmtDate(e.dateMs, e.prec, lang)}${e.end?.ms != null ? ' → ' + fmtDate(e.end.ms, e.end.prec, lang) : ''}${e.timeNote ? ` · ${esc(e.timeNote)}` : ''}`],
    [t('f.location'), esc((e.loc || []).map((id) => locName(db, id)).join('、'))],
    [t('f.chapter'), ch ? `${esc(ch.id)} ${esc(ch.title || '')}` : esc(e.chapter || '')],
    [t('f.category'), esc(e.category || '')],
    [t('f.status'), esc(e.status || '')],
    [t('f.notes'), esc(e.notes || '')],
    ...Object.entries(e.extra || {}).map(([k, v]) => [esc(k), esc(v)]),
  ].filter(([, v]) => v);
  const apps = db.apps.filter((a) => a.event === e.id).sort((x, y) => db.charOrder.get(x.char) - db.charOrder.get(y.char));
  const findings = checks.findings.filter((f) => f.eventId === e.id);
  return `
    <div class="ev-head">${esc(e.id)} · ${esc(e.title)}</div>
    <dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <h3>${t('f.who')} (${apps.length})</h3>
    <ul class="who">${apps
      .map((a) => {
        const c = db.byId.characters.get(a.char);
        const age = ageAt(c, a.dateMs);
        return `<li><button class="link" data-profile="${esc(c.id)}"><b>${esc(charFull(c, lang))}</b></button>${age != null ? ` <span class="muted small">${t('f.ageAt', { age: age.toFixed(1) })}</span>` : ''}${a.mentioned ? ` <span class="tag">${t('f.mentioned')}</span>` : ''}
          ${a.locId ? `<div class="small">${esc(locName(db, a.locId))} <span class="tag">${t('loc.' + a.locSource)}</span></div>` : ''}
          ${a.action ? `<div class="small ink2">${esc(a.action)}</div>` : ''}</li>`;
      })
      .join('')}</ul>
    ${findings.length ? `<h3>${t('tab.checks')}</h3>${findings.map((f) => `<div class="small"><span class="sev ${f.sev}"></span> ${esc(f.msg[lang] || f.msg.zh)}</div>`).join('')}` : ''}
    <p class="small muted">${t('f.sheetRow', { sheet: esc(e._sheet), row: e._row })}</p>`;
}

// ---------- narrative order ----------
export function narrativeOption({ db, state, th }) {
  const lang = getLang();
  const chapters = [...db.chapters].sort((a, b) => (db.chapterOrder.get(a.id) ?? 0) - (db.chapterOrder.get(b.id) ?? 0));
  const idx = new Map(chapters.map((c, i) => [c.id, i]));
  const evs = db.events.filter((e) => e.dateMs != null && idx.has(e.chapter) && (state.showDropped || !isDropped(db, e)));
  if (!evs.length) return null;
  const catOf = (e) => e.category || t('color.none');
  const scale = categoryScale(byFrequency(db.events.map(catOf)), th);
  const groups = new Map();
  for (const e of evs) {
    const c = scale.get(catOf(e));
    if (!groups.has(c.key)) groups.set(c.key, { c, data: [] });
    groups.get(c.key).data.push({ value: [e.dateMs, idx.get(e.chapter)], ev: e.id, symbol: c.symbol, itemStyle: { color: c.color, borderColor: th.surface, borderWidth: 1.5 } });
  }
  return {
    option: {
      animation: false,
      grid: { left: 150, right: 24, top: 10, bottom: 30 },
      tooltip: { trigger: 'item', confine: true, backgroundColor: th.surface, borderColor: th.grid, textStyle: { color: th.ink }, extraCssText: 'max-width:340px;white-space:normal',
        formatter: (p) => { const e = db.byId.events.get(p.data.ev); return `<b>${esc(e.title)}</b><br>${fmtDate(e.dateMs, e.prec, lang)} · ${esc(e.chapter)}${e.category ? ' · ' + esc(e.category) : ''}`; } },
      xAxis: { type: 'time', min: (v) => v.min - Math.max(60 * DAY, (v.max - v.min) * 0.03), max: (v) => v.max + Math.max(60 * DAY, (v.max - v.min) * 0.03), axisLabel: { color: th.muted, formatter: axisDate, hideOverlap: true }, axisLine: { lineStyle: { color: th.axis } }, splitLine: { show: true, lineStyle: { color: th.grid } } },
      yAxis: { type: 'category', inverse: true, data: chapters.map((c) => `${c.id} ${c.title || ''}`.slice(0, 18)), axisLabel: { color: th.ink2, fontSize: 12 }, axisTick: { show: false }, axisLine: { lineStyle: { color: th.axis } }, splitLine: { show: true, lineStyle: { color: th.grid } } },
      series: [...groups.values()].map((g) => ({ type: 'scatter', name: g.c.label, symbolSize: 11, data: g.data })),
    },
    height: Math.max(180, chapters.length * 22 + 50),
    legend: legendHtml([...groups.values()].map((g) => g.c)),
  };
}
