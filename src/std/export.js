// Text outputs shared by the dashboard (download buttons) and the CLI (tools/storydb.mjs):
// check report (Markdown), character chronicles (Markdown), normalized data (JSON).
import { isDropped, ageAt, charFull, locName } from './load.js';
import { fmtDate, iso } from './dates.js';

const L = (lang, zh, en) => (lang === 'en' ? en : zh);
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const SEV_LABEL = { error: ['错误', 'Errors'], warning: ['警告', 'Warnings'], info: ['提示', 'Notes'] };
const SEV_ICON = { error: '⛔', warning: '⚠️', info: 'ℹ️' };

export function reportMarkdown(db, checks, lang = 'zh', sourceName = '') {
  const T = db.title[lang] || sourceName;
  const out = [
    `# ${L(lang, '检查报告', 'Check report')} · ${T}`,
    '',
    `${L(lang, '文件', 'File')}: ${sourceName} · ${L(lang, '生成于', 'Generated')} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    `${L(lang, '人物', 'Characters')} ${db.characters.length} · ${L(lang, '事件', 'Events')} ${db.events.length} · ${L(lang, '关系', 'Relationships')} ${db.relationships.length} · ${L(lang, '地点', 'Locations')} ${db.locations.length} · ${L(lang, '章节', 'Chapters')} ${db.chapters.length}`,
    '',
    `**${checks.counts.error}** ${L(lang, '错误', 'errors')} · **${checks.counts.warning}** ${L(lang, '警告', 'warnings')} · **${checks.counts.info}** ${L(lang, '提示', 'notes')}`,
  ];
  for (const sev of ['error', 'warning', 'info']) {
    const list = checks.findings.filter((f) => f.sev === sev);
    if (!list.length) continue;
    out.push('', `## ${SEV_ICON[sev]} ${SEV_LABEL[sev][lang === 'en' ? 1 : 0]} (${list.length})`, '');
    out.push(`| ${L(lang, '代码', 'Code')} | ${L(lang, '位置', 'Where')} | ${L(lang, '说明', 'Message')} |`, '|---|---|---|');
    for (const f of list) out.push(`| ${f.code} | ${cell(f.sheet ? `${f.sheet}${f.row ? ' #' + f.row : ''}` : '')} | ${cell(f.msg[lang] || f.msg.zh)} |`);
  }
  return out.join('\n') + '\n';
}

/** One section per character: every event they are in, in story order, with age and location. */
export function chronicleMarkdown(db, lang = 'zh', charIds = db.main) {
  const out = [`# ${L(lang, '人物年表', 'Character chronicles')} · ${db.title[lang] || ''}`, ''];
  for (const id of charIds) {
    const c = db.byId.characters.get(id);
    if (!c) continue;
    out.push(`## ${charFull(c, lang)} (${c.id})${c.role ? ' · ' + c.role : ''}`, '');
    if (c.birth?.ms != null) out.push(`${L(lang, '出生', 'Born')} ${fmtDate(c.birth.ms, c.birth.prec, lang)}${c.death?.ms != null ? ` · ${L(lang, '去世', 'Died')} ${fmtDate(c.death.ms, c.death.prec, lang)}` : ''}`, '');
    out.push(`| ${L(lang, '日期', 'Date')} | ${L(lang, '年龄', 'Age')} | ${L(lang, '地点', 'Location')} | ${L(lang, '事件', 'Event')} | ${L(lang, '行动', 'Action')} | ${L(lang, '章', 'Ch.')} |`, '|---|---|---|---|---|---|');
    const rows = [
      ...(db.appsByChar.get(id) || []).filter((a) => !isDropped(db, a.ev)).map((a) => ({
        ms: a.dateMs, date: fmtDate(a.dateMs, a.ev.prec, lang) + (a.ev.timeNote ? ` (${a.ev.timeNote})` : ''), loc: locName(db, a.locId), title: a.ev.title,
        action: (a.mentioned ? L(lang, '〔提及〕', '[mentioned] ') : '') + (a.action || ''), ch: a.ev.chapter,
      })),
      ...(db.staysByChar.get(id) || []).filter((s) => !isDropped(db, s)).map((s) => ({
        ms: s.startMs, date: `${fmtDate(s.startMs, s.start.prec, lang)} → ${fmtDate(s.endMs, s.end?.prec || s.start.prec, lang)}`, loc: locName(db, s.loc), title: L(lang, '〔行踪〕', '[whereabouts]'), action: s.notes, ch: '',
      })),
    ].sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity));
    for (const r of rows) {
      const age = ageAt(c, r.ms);
      out.push(`| ${cell(r.date)} | ${age == null ? '' : age.toFixed(1)} | ${cell(r.loc)} | ${cell(r.title)} | ${cell(r.action)} | ${cell(r.ch)} |`);
    }
    const rels = db.relationships.filter((r) => !isDropped(db, r) && (r.a === id || r.b === id));
    if (rels.length) {
      out.push('', `${L(lang, '关系', 'Relationships')}:`);
      for (const r of rels) out.push(`- ${charFull(db.byId.characters.get(r.a === id ? r.b : r.a), lang)}: ${r.type}${r.status ? ` [${r.status}]` : ''}`);
    }
    out.push('');
  }
  return out.join('\n');
}

/** Plain JSON of the normalized model (dates as ISO strings) for Claude or other tools. */
export function snapshotJson(db, checks, sourceName = '') {
  const d = (x) => (x && x.ms != null ? { iso: iso(x.ms), precision: x.prec, text: x.text || undefined } : x?.text ? { text: x.text } : null);
  const strip = (o) => {
    const r = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === 'ev' || k === 'span' || k.endsWith('Ms')) continue;
      r[k] = v && typeof v === 'object' && 'ms' in v ? d(v) : v;
    }
    return r;
  };
  const out = {
    format: 'StoryDB',
    schemaVersion: db.schemaVersion,
    source: sourceName,
    generated: new Date().toISOString(),
    title: db.title,
    settings: db.settings,
    sheets: db.sheets,
    mainCharacters: db.main,
  };
  for (const k of ['characters', 'relationships', 'locations', 'events', 'stays', 'chapters', 'scenes', 'foreshadowing', 'knowledge']) out[k] = (db[k] || []).map(strip);
  out.appearances = db.apps.map((a) => ({ event: a.event, char: a.char, date: a.dateMs == null ? null : iso(a.dateMs), action: a.action, location: a.locId, locationSource: a.locSource, part: a.part || undefined, source: a.source }));
  out.findings = checks.findings.map(({ id, ...f }) => f);
  return JSON.stringify(out, null, 2);
}
