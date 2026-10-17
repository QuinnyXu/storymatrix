// StoryDB workbook -> normalized story model. Sheets and columns are matched by NAME (zh, en or an alias from
// schema/storydb.schema.json), never by position. Read-only: nothing here writes to the workbook.
import schema from '../../schema/storydb.schema.json' with { type: 'json' };
import { parseStoryDate, spanOf } from './dates.js';

export { schema };
export const SHEET = Object.fromEntries(schema.sheets.map((s) => [s.key, s]));
const MULTI = new RegExp(schema.conventions.multiSeparator);
const AUTO = new RegExp(schema.conventions.autoHeaderPattern, 'i');
const DEFAULT_SETTINGS = Object.fromEntries(SHEET.settings.settings.map((s) => [s.key, s.default]));

export const norm = (s) => String(s ?? '').replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')').toLowerCase();
const text = (v) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());
export const splitMulti = (v) => text(v).split(MULTI).map((s) => s.trim()).filter(Boolean);
const names = (def) => [def.zh, def.en, ...(def.aliases || [])];

function issue(db, sev, code, msg, extra = {}) {
  db.issues.push({ sev, code, msg, chars: [], ...extra });
}

function findSheet(wb, def) {
  const want = names(def).map(norm);
  return wb.SheetNames.find((n) => want.includes(norm(n))) ?? null;
}

/** headers -> { fieldKey: columnIndex }, plus the unclaimed (extra) columns. Exact names win over "name（remark）". */
export function mapColumns(headers, def) {
  const H = headers.map(norm);
  const col = {};
  const taken = new Set(H.map((h, i) => (!h || AUTO.test(headers[i]) ? i : -1)).filter((i) => i >= 0));
  const fields = def.fields.filter((f) => !f.auto);
  for (const pass of ['exact', 'prefix'])
    for (const f of fields) {
      if (col[f.key] != null) continue;
      for (const n of names(f).map(norm)) {
        const i = H.findIndex((h, j) => !taken.has(j) && (pass === 'exact' ? h === n : h.startsWith(n + '(')));
        if (i >= 0) {
          col[f.key] = i;
          taken.add(i);
          break;
        }
      }
    }
  const extra = H.map((h, i) => (taken.has(i) ? -1 : i)).filter((i) => i >= 0).map((i) => ({ i, header: text(headers[i]) }));
  return { col, extra };
}

function readTable(XLSX, wb, def, db) {
  const sheetName = findSheet(wb, def);
  if (!sheetName) {
    if (def.required) issue(db, 'error', 'missingSheet', { zh: `缺少「${def.zh}」表`, en: `Missing sheet "${def.en}"` }, { sheet: def.zh });
    return null;
  }
  const ws = wb.Sheets[sheetName];
  const first = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.r : 0;
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  const headers = aoa[0] || [];
  const { col, extra } = mapColumns(headers, def);
  db.sheets[def.key] = { name: sheetName, columns: Object.keys(col), extra: extra.map((e) => e.header) };
  for (const f of def.fields.filter((x) => x.required && !x.auto))
    if (col[f.key] == null)
      issue(db, 'error', 'missingColumn', { zh: `「${sheetName}」表缺少列「${f.zh}」`, en: `Sheet "${sheetName}" has no column "${f.en}"` }, { sheet: sheetName });
  const rows = [];
  aoa.slice(1).forEach((r, i) => {
    const raw = {};
    let any = false;
    for (const [k, c] of Object.entries(col)) {
      raw[k] = r[c];
      if (text(r[c]) !== '') any = true;
    }
    if (!any) return;
    const ex = {};
    for (const e of extra) if (text(r[e.i]) !== '') ex[e.header] = text(r[e.i]);
    rows.push({ raw, extra: ex, _sheet: sheetName, _row: first + 2 + i });
  });
  return rows;
}

function readSettings(XLSX, wb, db, overrides) {
  const out = { ...DEFAULT_SETTINGS };
  const rows = readTable(XLSX, wb, SHEET.settings, db) || [];
  const byName = new Map(SHEET.settings.settings.flatMap((s) => [s.key, s.zh, s.en].map((n) => [norm(n), s.key])));
  for (const r of rows) {
    const k = byName.get(norm(r.raw.key));
    if (k && text(r.raw.value) !== '') out[k] = text(r.raw.value);
  }
  for (const [k, v] of Object.entries(overrides || {})) if (v != null && v !== '') out[k] = String(v);
  out.statusList = splitMulti(out.statusValues);
  out.openMarkerList = splitMulti(out.openMarkers);
  return out;
}

/** Festival table: long form (年 | 名称 | 日期) or the wide form (公历年 | 春节 | 元宵 …). -> Map "year|name" -> ms */
function readFestivals(XLSX, wb, db) {
  const map = new Map();
  const sheetName = findSheet(wb, SHEET.festivals);
  if (!sheetName) return map;
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
  const { col } = mapColumns(aoa[0] || [], SHEET.festivals);
  db.sheets.festivals = { name: sheetName, columns: Object.keys(col), extra: [] };
  const put = (y, n, v) => {
    const d = parseStoryDate(v);
    if (y && n && d?.ms != null) map.set(`${y}|${n}`, d.ms);
  };
  if (col.name != null && col.date != null) for (const r of aoa.slice(1)) put(parseInt(r[col.year], 10), text(r[col.name]), r[col.date]);
  else if (col.year != null) {
    const heads = (aoa[0] || []).map(text);
    for (const r of aoa.slice(1)) heads.forEach((h, i) => i !== col.year && h && put(parseInt(r[col.year], 10), h, r[i]));
  }
  return map;
}

function coerce(f, v, row, db, ctx) {
  switch (f.type) {
    case 'id':
    case 'ref':
      return text(v);
    case 'refs':
      return splitMulti(v);
    case 'number':
    case 'int': {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    }
    case 'bool':
      return /^(是|y|yes|true|1|主要|✓|√)$/i.test(text(v));
    case 'date': {
      const s = text(v);
      if (!s) return null;
      const d = parseStoryDate(v, ctx.festivals);
      if (d.error) {
        if (!f.lenient)
          issue(db, 'warning', 'badDate', { zh: `「${row._sheet}」第 ${row._row} 行：${f.zh}「${s}」看不懂${d.error === 'festival' ? '（「节日」表里没有这一年的这个节日）' : ''}`, en: `"${row._sheet}" row ${row._row}: cannot read ${f.en} "${s}"${d.error === 'festival' ? ' (festival not in the Festivals sheet for that year)' : ''}` }, { sheet: row._sheet, row: row._row });
        return { ms: null, prec: null, text: s };
      }
      return d;
    }
    default:
      return text(v);
  }
}

/**
 * @param XLSX SheetJS
 * @param data ArrayBuffer / Uint8Array of the .xlsx
 * @param options { settings?: overrides (e.g. from projects.json) }
 */
export function loadStoryDb(XLSX, data, options = {}) {
  const wb = XLSX.read(data, { type: data instanceof ArrayBuffer ? 'array' : 'buffer', cellDates: false });
  const db = { schemaVersion: schema.version, sheets: {}, issues: [] };
  const known = schema.sheets.filter((s) => s.key !== 'settings').some((s) => findSheet(wb, s));
  if (!known) {
    throw Object.assign(new Error('NOT_STORYDB'), { code: 'NOT_STORYDB', sheets: wb.SheetNames });
  }
  db.settings = readSettings(XLSX, wb, db, options.settings);
  const festivals = readFestivals(XLSX, wb, db);
  const ctx = { festivals };

  for (const def of schema.sheets) {
    if (['settings', 'festivals'].includes(def.key)) continue;
    const rows = readTable(XLSX, wb, def, db) || [];
    const fields = def.fields.filter((f) => !f.auto);
    const idField = fields.find((f) => f.type === 'id');
    const seen = new Map();
    db[def.key] = [];
    for (const r of rows) {
      const o = { _sheet: r._sheet, _row: r._row, extra: r.extra };
      for (const f of fields) o[f.key] = coerce(f, r.raw[f.key], r, db, ctx);
      if (idField) {
        if (!o.id) {
          issue(db, 'warning', 'noId', { zh: `「${r._sheet}」第 ${r._row} 行有内容但没有${idField.zh}，已跳过`, en: `"${r._sheet}" row ${r._row} has data but no ${idField.en}; skipped` }, { sheet: r._sheet, row: r._row });
          continue;
        }
        if (idField.unique !== false) {
          if (seen.has(o.id)) {
            issue(db, 'error', 'dupId', { zh: `${idField.zh}「${o.id}」重复（第 ${seen.get(o.id)} 行和第 ${r._row} 行）`, en: `Duplicate ${idField.en} "${o.id}" (rows ${seen.get(o.id)} and ${r._row})` }, { sheet: r._sheet, row: r._row });
            continue;
          }
          seen.set(o.id, r._row);
        }
      }
      for (const f of fields.filter((x) => x.required && x.type !== 'id'))
        if (o[f.key] == null || o[f.key] === '' || (Array.isArray(o[f.key]) && !o[f.key].length))
          issue(db, 'warning', 'required', { zh: `「${r._sheet}」第 ${r._row} 行：「${f.zh}」没填`, en: `"${r._sheet}" row ${r._row}: "${f.en}" is blank` }, { sheet: r._sheet, row: r._row });
      db[def.key].push(o);
    }
  }

  resolveRefs(db);
  derive(db);
  return db;
}

// ---------- references ----------
function resolveRefs(db) {
  db.byId = {};
  for (const k of ['characters', 'locations', 'events', 'chapters', 'relationships', 'scenes', 'foreshadowing'])
    db.byId[k] = new Map((db[k] || []).map((o) => [o.id, o]));
  const charByName = new Map();
  for (const c of db.characters) for (const n of [c.name, c.short, c.nameEn]) if (n && !charByName.has(n)) charByName.set(n, c.id);
  const locByName = new Map(db.locations.map((l) => [l.name, l.id]));
  const nameHint = { characters: charByName, locations: locByName };

  for (const def of schema.sheets) {
    for (const f of def.fields.filter((x) => (x.type === 'ref' || x.type === 'refs') && !x.auto)) {
      const target = db.byId[f.ref];
      if (!target) continue;
      for (const o of db[def.key] || []) {
        const vals = f.type === 'refs' ? o[f.key] : o[f.key] ? [o[f.key]] : [];
        const fixed = [];
        for (const v of vals) {
          // a placeholder such as 【缺】 or 待定 in an ID cell means "not decided yet", not a broken reference
          if (/^【[^】]*】$/.test(v) || db.settings.openMarkerList.includes(v)) continue;
          if (target.has(v)) {
            fixed.push(v);
            continue;
          }
          const byName = nameHint[f.ref]?.get(v);
          if (f.lenient) {
            fixed.push(byName || v);
            continue;
          }
          fixed.push(v);
          issue(db, 'error', 'badRef', {
            zh: `「${o._sheet}」第 ${o._row} 行：${f.zh}「${v}」不存在${byName ? `（是不是 ${byName}？）` : ''}`,
            en: `"${o._sheet}" row ${o._row}: ${f.en} "${v}" does not exist${byName ? ` (did you mean ${byName}?)` : ''}`,
          }, { sheet: o._sheet, row: o._row });
        }
        o[f.key] = f.type === 'refs' ? fixed : fixed[0] || '';
      }
    }
  }
}

// ---------- derived data ----------
export const isDropped = (db, o) => !!o?.status && o.status === db.settings.droppedStatus;

function derive(db) {
  const S = db.settings;
  // the title can come from the settings sheet, else the caller fills it in
  db.title = { zh: S.title || '', en: S.titleEn || S.title || '' };

  // location ancestry, guarding against cycles
  db.locAncestors = new Map();
  for (const l of db.locations) {
    const chain = [];
    let p = l.parent;
    while (p && db.byId.locations.has(p) && !chain.includes(p) && p !== l.id) {
      chain.push(p);
      p = db.byId.locations.get(p).parent;
    }
    if (p === l.id || chain.includes(p))
      issue(db, 'error', 'locCycle', { zh: `地点「${l.id}」的上级地点绕成了圈`, en: `Location "${l.id}" has a parent cycle` }, { sheet: l._sheet, row: l._row });
    db.locAncestors.set(l.id, chain);
  }

  // event spans
  for (const e of db.events) {
    e.dateMs = e.date?.ms ?? null;
    e.prec = e.precision || e.date?.prec || null;
    e.span = e.dateMs == null ? null : spanOf(e.dateMs, e.prec, e.end?.ms ?? null);
  }

  // appearances: rows of the 出场 sheet, plus bare ones from 事件.涉及人物ID
  const apps = [];
  const key = new Set();
  for (const a of db.appearances) {
    key.add(`${a.event}|${a.char}`);
    apps.push({ ...a, source: 'sheet' });
  }
  for (const e of db.events)
    for (const c of e.chars || []) if (!key.has(`${e.id}|${c}`)) {
      key.add(`${e.id}|${c}`);
      apps.push({ event: e.id, char: c, action: '', loc: '', part: '', notes: '', source: 'event', _sheet: e._sheet, _row: e._row, extra: {} });
    }
  for (const a of apps) {
    const e = db.byId.events.get(a.event);
    a.ev = e || null;
    a.dateMs = e?.dateMs ?? null;
    a.span = e?.span ?? null;
    a.mentioned = a.part === '提及' || /^mention/i.test(a.part || '');
    const at = locationOf(db, a);
    a.locId = at.id;
    a.locSource = at.source;
  }
  db.apps = apps.filter((a) => a.ev && db.byId.characters.has(a.char));
  db.appsByChar = new Map(db.characters.map((c) => [c.id, []]));
  for (const a of db.apps) db.appsByChar.get(a.char).push(a);
  for (const list of db.appsByChar.values()) list.sort(byDate);

  db.staysByChar = new Map(db.characters.map((c) => [c.id, []]));
  for (const s of db.stays) {
    s.startMs = s.start?.ms ?? null;
    s.endMs = s.end?.ms ?? s.startMs;
    if (db.staysByChar.has(s.char) && s.startMs != null) db.staysByChar.get(s.char).push(s);
  }

  // main characters: settings -> 主要人物 column -> the most connected
  const degree = (id) => (db.appsByChar.get(id)?.length || 0) + db.relationships.filter((r) => r.a === id || r.b === id).length;
  const fromSettings = splitMulti(S.mainCharacters).filter((id) => db.byId.characters.has(id));
  const fromColumn = db.characters.filter((c) => c.main).map((c) => c.id);
  db.mainSource = fromSettings.length ? 'settings' : fromColumn.length ? 'column' : 'auto';
  db.main = fromSettings.length
    ? fromSettings
    : fromColumn.length
      ? fromColumn
      : db.characters.filter((c) => !isDropped(db, c)).map((c) => c.id).sort((a, b) => degree(b) - degree(a)).slice(0, 8);

  db.charOrder = new Map(db.characters.map((c, i) => [c.id, i]));
  db.chapterOrder = new Map(db.chapters.map((c, i) => [c.id, c.order ?? i + 1]));
  const dated = db.events.filter((e) => e.dateMs != null).map((e) => e.dateMs);
  db.dateRange = dated.length ? { from: Math.min(...dated), to: Math.max(...db.events.filter((e) => e.span).map((e) => e.span[1])) } : null;
  db.referenceMs = parseStoryDate(S.referenceDate)?.ms ?? null;
}

const byDate = (a, b) => (a.dateMs ?? Infinity) - (b.dateMs ?? Infinity) || (a.ev?._row ?? 0) - (b.ev?._row ?? 0);

/** Where a character is in an appearance: own location > event location > a whereabouts row covering the date. */
export function locationOf(db, a) {
  if (a.loc) return { id: a.loc, source: 'own' };
  const e = a.ev ?? db.byId.events.get(a.event);
  if (e?.loc?.length) return { id: e.loc[0], source: 'event' };
  const s = e?.dateMs != null ? stayAt(db, a.char, e.dateMs) : null;
  if (s) return { id: s.loc, source: 'stay' };
  return { id: null, source: null };
}

export function stayAt(db, charId, ms) {
  return (db.stays || []).find((s) => s.char === charId && s.start?.ms != null && ms >= s.start.ms && ms <= (s.end?.ms ?? s.start.ms) && !isDropped(db, s)) || null;
}

/** Same place, or one contains the other (dorm ⊂ campus). */
export function sameOrNested(db, a, b) {
  if (!a || !b || a === b) return true;
  return (db.locAncestors.get(a) || []).includes(b) || (db.locAncestors.get(b) || []).includes(a);
}

export const ageAt = (ch, ms) => (ch?.birth?.ms == null || ms == null ? null : (ms - ch.birth.ms) / (365.2425 * 86400000));
export const charLabel = (c, lang = 'zh') => (!c ? '' : lang === 'en' ? c.nameEn || c.short || c.name : c.short || c.name);
export const charFull = (c, lang = 'zh') => (!c ? '' : lang === 'en' ? c.nameEn || c.name : c.name);
export const locName = (db, id) => db.byId.locations.get(id)?.name || id || '';
