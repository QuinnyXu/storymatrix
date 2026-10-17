// StoryDB dashboard: pick a book (projects.json, else projects.example.json), a local file, or drop an .xlsx; read it (never write); render.
import { t, getLang, setLang, label, LANGS } from './i18n.js';
import { loadStoryDb, isDropped, charFull } from './load.js';
import { runChecks } from './checks.js';
import { reportMarkdown, chronicleMarkdown, snapshotJson } from './export.js';
import { makeSource, resolveUrl } from '../source.js';
import { DAY } from './dates.js';
import { esc, theme } from './views/common.js';
import { timelineOption, timelineLegend, narrativeOption, eventDetailHtml, laneIds, LANE_H } from './views/timeline.js';
import { graphOption, graphLegend, relTableHtml, relDateRange } from './views/graph.js';
import { overviewHtml, profileHtml, checksHtml } from './views/panels.js';

const $ = (s) => document.querySelector(s);
const store = (k, v) => {
  try {
    if (v === undefined) return localStorage.getItem('sdb.' + k);
    localStorage.setItem('sdb.' + k, v);
  } catch {
    return null;
  }
};

const state = {
  tab: store('tab') || 'overview',
  chars: new Set(),
  charsTouched: false,
  showDropped: false,
  colorBy: store('colorBy') || 'location',
  event: null,
  profile: null,
  zoom: null,
  graph: { coapp: false, labels: true, asOf: null },
  openSev: new Set(['error', 'warning']),
};
let projects = [];
let project = null; // current projects.json entry, or null for a local file
let source = null;
let db = null;
let checks = null;
let loadedAt = null;
const charts = {};

// ---------- loading ----------
async function loadProjects() {
  try {
    // projects.json is the author's own (not in the repository); projects.example.json ships with it
    let res = await fetch('projects.json', { cache: 'no-store' });
    if (!res.ok) res = await fetch('projects.example.json', { cache: 'no-store' });
    projects = (await res.json()).projects || [];
  } catch {
    projects = [];
  }
}

function useProject(p) {
  if (p.link) return void (location.href = p.link);
  project = p;
  store('project', p.id);
  source = makeSource(resolveUrl(p.workbook, location.href));
  const q = new URLSearchParams(location.search);
  q.set('project', p.id);
  history.replaceState(null, '', '?' + q);
  resetSelection();
  return reload();
}

function fileSource(file) {
  return { name: file.name, modified: file.lastModified, read: () => file.arrayBuffer(), changed: async () => false };
}

function useFile(src) {
  project = null;
  source = src;
  history.replaceState(null, '', location.pathname);
  resetSelection();
  return reload();
}

function resetSelection() {
  state.charsTouched = false;
  state.event = null;
  state.profile = null;
  state.zoom = null;
  state.graph.asOf = null;
}

async function reload(quiet = false) {
  if (!source) return render();
  if (!quiet) $('#srcInfo').textContent = t('src.loading');
  try {
    const buf = await source.read();
    const prev = db ? new Set(db.characters.map((c) => c.id)) : null;
    db = loadStoryDb(XLSX, buf, { settings: project?.settings });
    if (!db.title.zh) {
      const pt = project?.title || source.name.replace(/\.xls[xm]?$/i, '');
      db.title = typeof pt === 'string' ? { zh: pt, en: pt } : { zh: pt.zh, en: pt.en || pt.zh };
    }
    checks = runChecks(db);
    syncSelection(prev);
    loadedAt = new Date();
    banner(null);
  } catch (e) {
    db = null;
    showError(e);
  }
  render();
}

function syncSelection(prev) {
  const ids = db.characters.map((c) => c.id);
  if (!state.charsTouched) state.chars = new Set(db.main);
  else state.chars = new Set(ids.filter((id) => state.chars.has(id) || (prev && !prev.has(id) && db.main.includes(id))));
  if (state.profile && !db.byId.characters.has(state.profile)) state.profile = null;
  if (!state.profile) state.profile = db.main[0] || ids[0] || null;
  if (state.event && !db.byId.events.has(state.event)) state.event = null;
}

function banner(html, isError = false) {
  $('#banner').innerHTML = html ? `<div class="banner ${isError ? 'error' : ''}">${html}</div>` : '';
}

function showError(e) {
  let msg;
  if (e.code === 'FETCH') msg = t('err.fetch', { url: decodeURIComponent(e.url) });
  else if (e.code === 'NOT_STORYDB') msg = t('err.notStorydb', { sheets: e.sheets.join('、') });
  else msg = t('err.generic', { msg: e.message });
  banner(`<b>${t('err.title')}</b><br>${esc(msg)}`, true);
  console.error(e);
}

// ---------- rendering ----------
function applyStaticText() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  $('#btnLang').textContent = t('lang.switch');
  const title = db ? label(db.title) || t('app.title') : t('app.title');
  $('#title').textContent = title;
  document.title = title;
  const sel = $('#project');
  sel.innerHTML = `<option value="">${t(project || !source ? 'project.pick' : 'project.file')}</option>` + projects.map((p) => `<option value="${esc(p.id)}" ${project?.id === p.id ? 'selected' : ''}>${esc(label(p.title))}</option>`).join('');
}

const fmtTime = (ms) => new Date(ms).toLocaleString(getLang() === 'zh' ? 'zh-CN' : 'en-GB', { hour12: false });

function render() {
  applyStaticText();
  const hasDb = !!db;
  $('#tabs').style.display = hasDb ? '' : 'none';
  if (!hasDb) {
    $('#filters').innerHTML = '';
    if (!source) $('#srcInfo').textContent = t('src.none');
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === 'view-empty'));
    $('#view-empty').innerHTML = `<div class="empty"><p>${t('src.none')}</p><div class="projects">${projects.map((p) => `<button data-project="${esc(p.id)}"><b>${esc(label(p.title))}</b><div class="small muted">${esc(p.workbook || p.link)}</div></button>`).join('')}</div></div>`;
    return;
  }
  $('#srcInfo').textContent = t('src.loaded', { name: source.name, modified: source.modified ? fmtTime(source.modified) : '?', time: loadedAt.toLocaleTimeString() });
  const n = checks.counts.error;
  $('#checkBadge').innerHTML = `<span class="badge ${n ? 'error' : ''}">${n || checks.counts.warning || checks.counts.info || 0}</span>`;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === 'view-' + state.tab));
  $('#filters').innerHTML = filtersHtml();
  if (state.tab === 'overview') $('#view-overview').innerHTML = overviewHtml(db, checks);
  if (state.tab === 'profile') $('#view-profile').innerHTML = profileHtml(db, checks, state.profile);
  if (state.tab === 'checks') $('#view-checks').innerHTML = checksHtml(db, checks, state.openSev);
  if (state.tab === 'timeline') renderTimeline();
  if (state.tab === 'graph') renderGraph();
}

function filtersHtml() {
  if (!['timeline', 'graph'].includes(state.tab)) return '';
  const lang = getLang();
  const chips = db.characters
    .filter((c) => state.showDropped || !isDropped(db, c))
    .map((c) => `<label class="chip ${state.chars.has(c.id) ? 'on' : ''}" title="${esc(c.id + (c.role ? ' · ' + c.role : ''))}"><input type="checkbox" data-char="${esc(c.id)}" ${state.chars.has(c.id) ? 'checked' : ''}>${esc(charFull(c, lang))}</label>`)
    .join('');
  const chars = `<div class="fgroup"><span class="flabel">${t('filter.chars')}</span><button class="link" data-charmode="main">${t('filter.main')}</button><button class="link" data-charmode="all">${t('filter.all')}</button><button class="link" data-charmode="none">${t('filter.none')}</button>${chips}</div>`;
  const color =
    state.tab === 'timeline'
      ? `<div class="fgroup"><span class="flabel">${t('filter.colorBy')}</span><select id="colorBy">${['location', 'locType', 'region', 'category', 'status'].map((m) => `<option value="${m}" ${state.colorBy === m ? 'selected' : ''}>${t('color.' + m)}</option>`).join('')}</select></div>`
      : '';
  const dropped = `<label class="chip ${state.showDropped ? 'on' : ''}"><input type="checkbox" id="showDropped" ${state.showDropped ? 'checked' : ''}>${t('filter.dropped')}</label>`;
  return chars + color + dropped;
}

function chart(id) {
  const el = document.getElementById(id);
  if (!charts[id] || charts[id].getDom() !== el) charts[id] = echarts.init(el, null, { renderer: 'canvas' });
  return charts[id];
}

function renderTimeline() {
  const th = theme();
  const lanes = laneIds(db, state);
  const el = $('#timeline');
  el.style.height = `${Math.max(1, lanes.length) * LANE_H + 80}px`;
  const tl = chart('timeline');
  tl.resize();
  tl.setOption(timelineOption({ db, checks, state, th }), true);
  if (!tl.__wired) {
    tl.__wired = true;
    tl.on('click', (p) => {
      if (p.data?.app == null) return;
      state.event = db.apps[p.data.app].event;
      renderTimeline();
    });
    tl.on('datazoom', () => {
      const dz = tl.getOption().dataZoom[0];
      state.zoom = { start: dz.start, end: dz.end };
    });
  }
  $('#tlLegend').innerHTML = lanes.length ? timelineLegend(db, state, th) : `<span>${t('tl.noDated')}</span>`;
  $('#eventDetail').innerHTML = eventDetailHtml(db, checks, state.event, getLang());

  const nar = narrativeOption({ db, state, th });
  const nel = $('#narrative');
  if (!nar) {
    if (charts.narrative) charts.narrative.clear();
    nel.style.height = '0px';
    $('#narLegend').innerHTML = `<span>${t('tl.noChapters')}</span>`;
    return;
  }
  nel.style.height = `${nar.height}px`;
  const nc = chart('narrative');
  nc.resize();
  nc.setOption(nar.option, true);
  $('#narLegend').innerHTML = nar.legend;
  if (!nc.__wired) {
    nc.__wired = true;
    nc.on('click', (p) => p.data?.ev && focusEvent(p.data.ev));
  }
}

function renderGraph() {
  const th = theme();
  const rr = relDateRange(db);
  const asOf = rr
    ? `<label class="chip on">${t('g.asOf')} <input type="range" id="asOf" min="${rr.from}" max="${rr.to}" step="${DAY}" value="${state.graph.asOf ?? rr.to}" style="display:inline;width:140px"> <span id="asOfLabel">${state.graph.asOf == null ? t('g.asOfAll') : new Date(state.graph.asOf).toISOString().slice(0, 10)}</span></label><button class="link" data-act="asOfAll">${t('g.asOfAll')}</button>`
    : '';
  $('#graphControls').innerHTML = `
    <label class="chip ${state.graph.labels ? 'on' : ''}"><input type="checkbox" id="gLabels" ${state.graph.labels ? 'checked' : ''}>${t('g.labels')}</label>
    <label class="chip ${state.graph.coapp ? 'on' : ''}"><input type="checkbox" id="gCoapp" ${state.graph.coapp ? 'checked' : ''}>${t('g.coapp')}</label>${asOf}`;
  $('#graphLegend').innerHTML = graphLegend(db, state, th);
  const g = chart('graph');
  g.resize();
  g.setOption(graphOption({ db, state, th }), true);
  if (!g.__wired) {
    g.__wired = true;
    g.on('click', (p) => p.dataType === 'node' && openProfile(p.data.char));
  }
  $('#relTable').innerHTML = relTableHtml(db, state);
}

// ---------- navigation ----------
function setTab(tab) {
  state.tab = tab;
  store('tab', tab);
  render();
}

function openProfile(id) {
  state.profile = id;
  setTab('profile');
  window.scrollTo(0, 0);
}

function focusEvent(eventId) {
  const e = db.byId.events.get(eventId);
  if (!e) return;
  for (const c of e.chars || []) state.chars.add(c);
  db.apps.filter((a) => a.event === eventId).forEach((a) => state.chars.add(a.char));
  state.charsTouched = true;
  state.event = eventId;
  state.zoom = e.dateMs != null ? { startValue: e.dateMs - 400 * DAY, endValue: (e.end?.ms ?? e.dateMs) + 400 * DAY } : null;
  setTab('timeline');
  window.scrollTo(0, 0);
}

function jump(fid) {
  const f = checks.findings.find((x) => x.id === fid);
  if (!f) return;
  if (f.eventId && db.byId.events.get(f.eventId)?.dateMs != null) return focusEvent(f.eventId);
  if (f.chars?.length && db.byId.characters.has(f.chars[0])) return openProfile(f.chars[0]);
}

// ---------- export ----------
function download(name, data, type) {
  const a = document.createElement('a');
  a.href = typeof data === 'string' && data.startsWith('data:') ? data : URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function exportAs(kind) {
  if (!db) return;
  const lang = getLang();
  const base = (label(db.title) || 'story').replace(/[\\/:*?"<>|]/g, '_');
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === 'report') download(`${base}_${lang === 'en' ? 'check-report' : '检查报告'}_${stamp}.md`, reportMarkdown(db, checks, lang, source.name), 'text/markdown');
  if (kind === 'chron') download(`${base}_${lang === 'en' ? 'chronicles' : '人物年表'}_${stamp}.md`, chronicleMarkdown(db, lang, [...state.chars].sort((a, b) => db.charOrder.get(a) - db.charOrder.get(b))), 'text/markdown');
  if (kind === 'json') download(`${base}_${lang === 'en' ? 'story-data' : '故事数据'}_${stamp}.json`, snapshotJson(db, checks, source.name), 'application/json');
  if (kind === 'png' || kind === 'timelinePng') {
    const tab = kind === 'png' ? 'graph' : 'timeline';
    if (state.tab !== tab) setTab(tab);
    requestAnimationFrame(() => {
      const c = charts[kind === 'png' ? 'graph' : 'timeline'];
      if (c) download(`${base}_${kind === 'png' ? (lang === 'en' ? 'relationships' : '关系图') : lang === 'en' ? 'timeline' : '人物时间线'}_${stamp}.png`, c.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: theme().surface }));
    });
  }
  $('#exportMenu').open = false;
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-tab],[data-profile],[data-event],[data-fid],[data-show-timeline],[data-act],[data-export],[data-charmode],[data-project]');
  if (!el) return;
  const d = el.dataset;
  if (d.tab) setTab(d.tab);
  else if (d.project) useProject(projects.find((p) => p.id === d.project));
  else if (d.profile) openProfile(d.profile);
  else if (d.event) focusEvent(d.event);
  else if (d.fid) jump(d.fid);
  else if (d.showTimeline) {
    state.chars.add(d.showTimeline);
    state.charsTouched = true;
    setTab('timeline');
  } else if (d.export) exportAs(d.export);
  else if (d.charmode) {
    state.chars = new Set(d.charmode === 'main' ? db.main : d.charmode === 'all' ? db.characters.map((c) => c.id) : []);
    state.charsTouched = true;
    render();
  } else if (d.act === 'asOfAll') {
    state.graph.asOf = null;
    render();
  } else if (d.act === 'copyMd') {
    const md = reportMarkdown(db, checks, getLang(), source.name);
    try {
      await navigator.clipboard.writeText(md);
      el.textContent = t('btn.copied');
      setTimeout(() => (el.textContent = t('btn.copyMd')), 1500);
    } catch {
      download('report.md', md, 'text/markdown');
    }
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.char) {
    el.checked ? state.chars.add(el.dataset.char) : state.chars.delete(el.dataset.char);
    state.charsTouched = true;
  } else if (el.id === 'colorBy') store('colorBy', (state.colorBy = el.value));
  else if (el.id === 'showDropped') state.showDropped = el.checked;
  else if (el.id === 'gLabels') state.graph.labels = el.checked;
  else if (el.id === 'gCoapp') state.graph.coapp = el.checked;
  else if (el.id === 'project') {
    const p = projects.find((x) => x.id === el.value);
    if (p) useProject(p);
    return;
  } else if (el.id === 'fileInput') {
    if (el.files[0]) useFile(fileSource(el.files[0]));
    return;
  } else if (el.id === 'chkAuto') return store('auto', el.checked ? '1' : '0');
  else return;
  render();
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'asOf') return;
  state.graph.asOf = +e.target.value;
  $('#asOfLabel').textContent = new Date(state.graph.asOf).toISOString().slice(0, 10);
  const th = theme();
  charts.graph?.setOption(graphOption({ db, state, th }), true);
  $('#relTable').innerHTML = relTableHtml(db, state);
});

document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.dataset?.sev) d.open ? state.openSev.add(d.dataset.sev) : state.openSev.delete(d.dataset.sev);
}, true);

$('#btnReload').onclick = () => reload();
$('#btnOpen').onclick = async () => {
  if (window.showOpenFilePicker) {
    try {
      const src = makeSource('');
      await src.choose();
      return useFile(src);
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  $('#fileInput').click();
};
$('#btnLang').onclick = () => {
  const next = LANGS[(LANGS.indexOf(getLang()) + 1) % LANGS.length];
  setLang(next);
  store('lang', next);
  render();
};
$('#btnTheme').onclick = () => {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const cur = document.documentElement.dataset.theme || (dark ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store('theme', next);
  render();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render());
window.addEventListener('resize', () => Object.values(charts).forEach((c) => c.resize()));

// drag and drop an .xlsx anywhere
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
  dragDepth++;
  $('#drop').classList.add('on');
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) $('#drop').classList.remove('on');
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('#drop').classList.remove('on');
  const f = e.dataTransfer.files[0];
  if (f) useFile(fileSource(f));
});

// ---------- start ----------
window.addEventListener('error', (e) => banner(`<b>${t('err.title')}</b><br>${esc(e.message)}`, true));
window.addEventListener('unhandledrejection', (e) => banner(`<b>${t('err.title')}</b><br>${esc(e.reason?.message || e.reason)}`, true));

async function start() {
  setLang(store('lang') || 'zh');
  if (store('theme')) document.documentElement.dataset.theme = store('theme');
  if (store('auto') === '0') $('#chkAuto').checked = false;
  await loadProjects();
  const q = new URLSearchParams(location.search);
  if (['overview', 'timeline', 'profile', 'graph', 'checks'].includes(q.get('tab'))) state.tab = q.get('tab');
  if (q.get('lang')) setLang(q.get('lang'));
  const p = projects.find((x) => x.id === (q.get('project') || (!q.get('workbook') && store('project'))));
  if (q.get('workbook')) {
    project = { id: 'url', title: q.get('workbook'), workbook: q.get('workbook'), settings: {} };
    source = makeSource(resolveUrl(q.get('workbook'), location.href));
    await reload();
  } else if (p && !p.link) await useProject(p);
  else render();
  if (db && q.get('event')) focusEvent(q.get('event'));
  if (db && q.get('char')) openProfile(q.get('char'));
  setInterval(async () => {
    if (!$('#chkAuto').checked || !source || document.hidden) return;
    if (await source.changed()) {
      await reload(true);
      $('#srcInfo').textContent += ' · ' + t('src.changed');
    }
  }, 2500);
}
start();
