// Story-agnostic consistency checks over a loaded StoryDB. Each check is a small function: (db) -> findings.
// Loader issues (missing sheets, duplicate IDs, broken references, unreadable dates) are already in db.issues.
// To add a check: write a function below and add it to CHECKS.
import { isDropped, sameOrNested, locName, charFull, stayAt, SHEET } from './load.js';
import { fmtDate } from './dates.js';

const SEV = { error: 0, warning: 1, info: 2 };
const live = (db, list) => list.filter((o) => !isDropped(db, o));
const cname = (db, id) => charFull(db.byId.characters.get(id)) || id;
const loc = (db, id) => locName(db, id) || '?';
const where = (o) => ({ sheet: o._sheet, row: o._row });

/** C01 · on stage before birth or after death (the event's whole possible span must be outside life). */
function lifespan(db) {
  const out = [];
  for (const c of live(db, db.characters)) {
    const b = c.birth?.ms ?? null;
    const d = c.death?.ms ?? null;
    if (b == null && d == null) continue;
    for (const a of db.appsByChar.get(c.id) || []) {
      if (!a.span || a.mentioned || isDropped(db, a.ev)) continue;
      const when = fmtDate(a.dateMs, a.ev.prec);
      if (b != null && a.span[1] < b)
        out.push({ sev: 'error', code: 'C01', ...where(a.ev), eventId: a.event, chars: [c.id], dateMs: a.dateMs,
          msg: { zh: `${cname(db, c.id)} 在出生（${fmtDate(b, '日')}）之前出场：${when}「${a.ev.title}」`, en: `${charFull(c, 'en')} appears before birth (${fmtDate(b, '日', 'en')}): ${when} "${a.ev.title}"` } });
      if (d != null && a.span[0] > d)
        out.push({ sev: 'error', code: 'C01', ...where(a.ev), eventId: a.event, chars: [c.id], dateMs: a.dateMs,
          msg: { zh: `${cname(db, c.id)} 在去世（${fmtDate(d, '日')}）之后出场：${when}「${a.ev.title}」（只是被提到的话，把「参与方式」填成「提及」）`, en: `${charFull(c, 'en')} appears after death (${fmtDate(d, '日', 'en')}): ${when} "${a.ev.title}" (if only mentioned, set Part to 提及)` } });
    }
  }
  for (const k of live(db, db.knowledge)) {
    const c = db.byId.characters.get(k.char);
    if (k.when?.ms != null && c?.birth?.ms != null && k.when.ms < c.birth.ms)
      out.push({ sev: 'error', code: 'C01', ...where(k), chars: [k.char], dateMs: k.when.ms,
        msg: { zh: `${cname(db, k.char)} 在出生之前就得知「${k.secret}」`, en: `${charFull(c, 'en')} learns "${k.secret}" before being born` } });
  }
  return out;
}

/** C02 · same character in two places on the same exact day. */
function twoPlaces(db) {
  const out = [];
  for (const [cid, apps] of db.appsByChar) {
    const byDay = new Map();
    for (const a of apps) {
      if (a.dateMs == null || a.ev.prec !== '日' || a.ev.end?.ms || a.mentioned || !a.locId || isDropped(db, a.ev)) continue;
      if (!byDay.has(a.dateMs)) byDay.set(a.dateMs, []);
      byDay.get(a.dateMs).push(a);
    }
    for (const [ms, list] of byDay)
      for (let i = 1; i < list.length; i++)
        if (!sameOrNested(db, list[0].locId, list[i].locId))
          out.push({ sev: 'warning', code: 'C02', ...where(list[i].ev), eventId: list[i].event, chars: [cid], dateMs: ms,
            msg: { zh: `${cname(db, cid)} ${fmtDate(ms, '日')} 同时在「${loc(db, list[0].locId)}」（${list[0].event}）和「${loc(db, list[i].locId)}」（${list[i].event}）`, en: `${charFull(db.byId.characters.get(cid), 'en')} is at "${loc(db, list[0].locId)}" (${list[0].event}) and "${loc(db, list[i].locId)}" (${list[i].event}) on ${fmtDate(ms, '日', 'en')}` } });
  }
  return out;
}

/** C03 · appearance contradicts a 行踪 (whereabouts) interval; overlapping intervals at different places. */
function whereabouts(db) {
  const out = [];
  for (const [cid, apps] of db.appsByChar)
    for (const a of apps) {
      if (a.dateMs == null || a.ev.prec !== '日' || a.mentioned || !a.locId || a.locSource === 'stay' || isDropped(db, a.ev)) continue;
      const s = stayAt(db, cid, a.dateMs);
      if (s && !sameOrNested(db, s.loc, a.locId))
        out.push({ sev: 'warning', code: 'C03', ...where(a.ev), eventId: a.event, chars: [cid], dateMs: a.dateMs,
          msg: { zh: `${cname(db, cid)} 按「行踪」第 ${s._row} 行此时在「${loc(db, s.loc)}」，却出现在「${loc(db, a.locId)}」：${fmtDate(a.dateMs, '日')}「${a.ev.title}」`, en: `${charFull(db.byId.characters.get(cid), 'en')} should be at "${loc(db, s.loc)}" (Whereabouts row ${s._row}) but appears at "${loc(db, a.locId)}": ${fmtDate(a.dateMs, '日', 'en')} "${a.ev.title}"` } });
    }
  for (const [cid, stays] of db.staysByChar) {
    const list = live(db, stays).sort((x, y) => x.startMs - y.startMs);
    for (let i = 1; i < list.length; i++)
      for (let j = 0; j < i; j++)
        if (list[i].startMs <= list[j].endMs && !sameOrNested(db, list[i].loc, list[j].loc))
          out.push({ sev: 'warning', code: 'C03', ...where(list[i]), chars: [cid], dateMs: list[i].startMs,
            msg: { zh: `${cname(db, cid)} 的两段行踪重叠但地点不同：第 ${list[j]._row} 行「${loc(db, list[j].loc)}」与第 ${list[i]._row} 行「${loc(db, list[i].loc)}」`, en: `${charFull(db.byId.characters.get(cid), 'en')} has overlapping whereabouts at different places: rows ${list[j]._row} and ${list[i]._row}` } });
  }
  return out;
}

/** C04 · end date before start date. */
function endBeforeStart(db) {
  const out = [];
  const test = (o, s, e, label) => {
    if (s != null && e != null && e < s)
      out.push({ sev: 'error', code: 'C04', ...where(o), chars: [o.char, o.a, o.b].filter(Boolean), dateMs: s,
        msg: { zh: `「${o._sheet}」第 ${o._row} 行：结束日期早于开始日期（${label}）`, en: `"${o._sheet}" row ${o._row}: end date is before start date (${label})` } });
  };
  for (const e of db.events) test(e, e.date?.ms, e.end?.ms, e.id);
  for (const s of db.stays) test(s, s.start?.ms, s.end?.ms, cname(db, s.char));
  for (const r of db.relationships) test(r, r.start?.ms, r.end?.ms, r.id);
  return out;
}

/** C05 · a row marked as decided still contains open markers such as 【缺】 or 待定. */
function decidedButOpen(db) {
  const S = db.settings;
  if (!S.decidedStatus || !S.openMarkerList.length) return [];
  const out = [];
  for (const key of ['characters', 'relationships', 'locations', 'events', 'stays', 'knowledge']) {
    for (const o of db[key] || []) {
      if (o.status !== S.decidedStatus) continue;
      const open = (v) => typeof v === 'string' && S.openMarkerList.some((m) => v.includes(m));
      const fieldName = (k, lang) => SHEET[key].fields.find((f) => f.key === k)?.[lang] || k;
      const cols = Object.keys(o).filter((k) => !k.startsWith('_') && open(o[k]));
      const extra = Object.keys(o.extra || {}).filter((k) => open(o.extra[k]));
      const list = (lang) => [...cols.map((k) => fieldName(k, lang)), ...extra].join(lang === 'en' ? ', ' : '、');
      if (cols.length || extra.length)
        out.push({ sev: 'info', code: 'C05', ...where(o), eventId: key === 'events' ? o.id : undefined, chars: key === 'characters' ? [o.id] : [o.char, o.a, o.b].filter(Boolean), dateMs: o.dateMs ?? null,
          msg: { zh: `「${o._sheet}」第 ${o._row} 行（${o.id || o.name || ''}）状态是「${S.decidedStatus}」，但这些列还有未定标记：${list('zh')}`, en: `"${o._sheet}" row ${o._row} (${o.id || o.name || ''}) is "${S.decidedStatus}" but still has open markers in: ${list('en')}` } });
    }
  }
  return out;
}

/** C06 · foreshadowing paid off before (or in a chapter without order relative to) the chapter it is planted in. */
function foreshadowing(db) {
  const out = [];
  const ord = (id) => db.chapterOrder.get(id);
  for (const f of db.foreshadowing) {
    if (!f.planted || !f.paid) continue;
    const a = ord(f.planted);
    const b = ord(f.paid);
    if (a != null && b != null && b < a)
      out.push({ sev: 'error', code: 'C06', ...where(f), chars: [],
        msg: { zh: `伏笔 ${f.id} 在 ${f.paid} 回收，却在更晚的 ${f.planted} 才埋下`, en: `Setup ${f.id} pays off in ${f.paid}, before it is planted in ${f.planted}` } });
  }
  return out;
}

/** C07 · a relationship with itself, or the same pair and type twice. */
function relationships(db) {
  const out = [];
  const seen = new Map();
  for (const r of live(db, db.relationships)) {
    if (r.a && r.a === r.b)
      out.push({ sev: 'warning', code: 'C07', ...where(r), chars: [r.a], msg: { zh: `关系 ${r.id} 的两端是同一个人`, en: `Relationship ${r.id} links a character to themself` } });
    const k = [r.a, r.b].sort().join('|') + '|' + r.type;
    if (seen.has(k))
      out.push({ sev: 'warning', code: 'C07', ...where(r), chars: [r.a, r.b], msg: { zh: `关系 ${r.id} 与 ${seen.get(k)} 重复（同一对人物、同一关系类型）`, en: `Relationship ${r.id} duplicates ${seen.get(k)} (same pair and type)` } });
    else seen.set(k, r.id);
  }
  return out;
}

/** C08 · a main character with no events at all. */
function mainWithoutEvents(db) {
  if (db.mainSource === 'auto') return []; // picked by activity, so they have events by construction
  return db.main
    .filter((id) => !(db.appsByChar.get(id) || []).length)
    .map((id) => {
      const c = db.byId.characters.get(id);
      return { sev: 'info', code: 'C08', ...where(c), chars: [id], msg: { zh: `主要人物 ${cname(db, id)} 还没有任何事件`, en: `Main character ${charFull(c, 'en')} has no events yet` } };
    });
}

/** C09 · events with neither a date nor a time note, listed once so they are easy to place later. */
function undated(db) {
  const list = live(db, db.events).filter((e) => e.dateMs == null && !e.timeNote);
  if (!list.length) return [];
  return [{ sev: 'info', code: 'C09', sheet: list[0]._sheet, row: list[0]._row, chars: [],
    msg: { zh: `${list.length} 个事件没有日期也没有时间说明：${list.map((e) => e.id).join('、')}`, en: `${list.length} events have neither a date nor a time note: ${list.map((e) => e.id).join(', ')}` } }];
}

export const CHECKS = [lifespan, twoPlaces, whereabouts, endBeforeStart, decidedButOpen, foreshadowing, relationships, mainWithoutEvents, undated];

/** All findings (loader issues + checks), worst first, each with a stable id. */
export function runChecks(db) {
  const all = [...db.issues.map((i) => ({ ...i, code: i.code })), ...CHECKS.flatMap((c) => c(db))];
  all.sort((a, b) => SEV[a.sev] - SEV[b.sev] || (a.dateMs ?? Infinity) - (b.dateMs ?? Infinity) || String(a.sheet).localeCompare(String(b.sheet)) || (a.row ?? 0) - (b.row ?? 0));
  all.forEach((f, i) => (f.id = `f${i}`));
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of all) counts[f.sev]++;
  // worst severity per "eventId|charId", to outline timeline markers
  const marks = new Map();
  for (const f of all)
    if (f.eventId)
      for (const c of f.chars.length ? f.chars : ['*']) {
        const k = `${f.eventId}|${c}`;
        if (!marks.has(k) || SEV[f.sev] < SEV[marks.get(k)]) marks.set(k, f.sev);
      }
  return { findings: all, counts, marks };
}
