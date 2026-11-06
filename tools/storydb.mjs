#!/usr/bin/env node
// StoryDB command line. Reads a workbook (never writes to it) and prints checks or writes reports.
//
//   node tools/storydb.mjs check  <workbook.xlsx | project id>          print findings; exit code 1 if any error
//   node tools/storydb.mjs report <workbook.xlsx | project id> [--out DIR] [--lang zh|en]
//        writes 检查报告.md, 人物年表.md, 故事数据.json  (default DIR: story-dashboard/out/<project or file name>/)
//   node tools/storydb.mjs fields [--lang zh|en]                          print the template's field reference (Markdown)
//
// Project ids come from projects.json (or projects.example.json), e.g. "example".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStoryDb, schema } from '../src/std/load.js';
import { runChecks } from '../src/std/checks.js';
import { reportMarkdown, chronicleMarkdown, snapshotJson } from '../src/std/export.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, target, ...rest] = process.argv.slice(2);
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : dflt;
};
const lang = opt('lang', 'zh');

function sheetJs() {
  const mod = { exports: {} };
  new Function('module', 'exports', fs.readFileSync(path.join(root, 'vendor/xlsx.full.min.js'), 'utf8'))(mod, mod.exports);
  return mod.exports;
}

function resolveTarget(t) {
  const file = ['projects.json', 'projects.example.json'].map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
  const projects = file ? JSON.parse(fs.readFileSync(file, 'utf8')).projects : [];
  const p = projects.find((x) => x.id === t);
  if (p) {
    if (!p.workbook) throw new Error(`Project "${t}" has no StoryDB workbook (it links to ${p.link || 'nothing'})`);
    return { file: path.resolve(root, p.workbook), settings: p.settings || {}, name: p.id, title: p.title };
  }
  return { file: path.resolve(t), settings: {}, name: path.basename(t, path.extname(t)) };
}

function load(t) {
  const r = resolveTarget(t);
  const db = loadStoryDb(sheetJs(), fs.readFileSync(r.file), { settings: r.settings });
  if (!db.title.zh && r.title) db.title = { zh: r.title.zh || r.title, en: r.title.en || r.title.zh || r.title };
  if (!db.title.zh) db.title = { zh: r.name, en: r.name };
  return { ...r, db, checks: runChecks(db) };
}

function fieldsMarkdown() {
  const L = (zh, en) => (lang === 'en' ? en : zh);
  const out = [`# ${L('故事数据库模板 · 字段说明', 'StoryDB template · field reference')} (v${schema.version})`, '', schema.about[lang], '', `${L('日期写法', 'Dates')}: ${schema.conventions.dateGrammar[lang]}`, ''];
  const V = schema.conventions.vocab;
  const words = (kind, codes) => codes.map((c) => (lang === 'en' ? V[kind][c][0] : c));
  out.push(lang === 'en'
    ? `Status values: ${words('status', schema.conventions.statusValues).join(', ')}. Coded columns (Status, Precision, Part, Direction) also accept the codes used in the Chinese template.`
    : `状态取值: ${schema.conventions.statusValues.map((v) => `${v} = ${schema.conventions.statusLabels[v].zh}`).join(' · ')}（英文 ${words('status', schema.conventions.statusValues).join(' / ')} 也认）`, '');
  const en = lang === 'en';
  const latin = (list) => (en ? (list || []).filter((a) => /^[\x20-\x7e]+$/.test(a)) : list || []);
  const sep = en ? ', ' : '、';
  if (en) out.push('Sheet and column names from the Chinese template are read the same way, so a workbook may mix both.', '');
  for (const s of schema.sheets) {
    out.push(en ? `## ${s.en}${s.required ? ' (required)' : ' (optional)'}` : `## ${s.zh} / ${s.en}${s.required ? '（必需）' : '（可选）'}`, '', s.desc[lang], '');
    if (latin(s.aliases).length) out.push(`${L('也认作', 'Also recognised as')}: ${latin(s.aliases).join(sep)}`, '');
    out.push(en ? '| Column | Type | Req. | Notes | Also accepted |' : '| 列名 | 英文列名 | 类型 | 必填 | 说明 | 也认作 |', en ? '|---|---|---|---|---|' : '|---|---|---|---|---|---|');
    for (const f of s.fields) {
      const type = f.auto ? L('公式（自动）', 'formula (auto)') : f.ref ? `${f.type} → ${schema.sheets.find((x) => x.key === f.ref)[lang]}` : f.type;
      const values = f.type === 'status' ? words('status', schema.conventions.statusValues) : en && f.enumEn ? f.enumEn : f.vocab ? words(f.vocab, f.enum) : f.enum;
      const note = [f.desc?.[lang], values && !(f.desc?.[lang] || '').startsWith(values.join(' / ')) ? values.join(' / ') : ''].filter(Boolean).join(' · ');
      out.push(en ? `| ${f.en} | ${type} | ${f.required ? '✓' : ''} | ${note} | ${latin(f.aliases).join(sep)} |` : `| ${f.zh} | ${f.en} | ${type} | ${f.required ? '✓' : ''} | ${note} | ${(f.aliases || []).join('、')} |`);
    }
    if (s.settings) {
      out.push('', `| ${L('项目', 'Key')} | ${L('默认', 'Default')} | ${L('说明', 'Notes')} |`, '|---|---|---|');
      for (const k of s.settings) out.push(en ? `| ${k.en} | ${k.defaultEn || k.default} | ${k.desc.en} |` : `| ${k.zh} (${k.en}) | ${k.default} | ${k.desc.zh} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

try {
  if (cmd === 'fields') {
    process.stdout.write(fieldsMarkdown());
  } else if (cmd === 'check' && target) {
    const { db, checks, file } = load(target);
    console.log(`${path.basename(file)}: ${db.characters.length} characters, ${db.events.length} events, ${db.apps.length} appearances, ${db.relationships.length} relationships`);
    console.log(`sheets: ${Object.entries(db.sheets).map(([k, v]) => `${k}=${v.name}`).join(', ')}`);
    for (const f of checks.findings) console.log(`[${f.sev}] ${f.code} ${f.sheet ?? ''}${f.row ? '#' + f.row : ''} ${f.msg[lang]}`);
    console.log(`${checks.counts.error} errors, ${checks.counts.warning} warnings, ${checks.counts.info} notes`);
    process.exitCode = checks.counts.error ? 1 : 0;
  } else if (cmd === 'report' && target) {
    const { db, checks, file, name } = load(target);
    const out = path.resolve(opt('out', path.join(root, 'out', name)));
    fs.mkdirSync(out, { recursive: true });
    const src = path.basename(file);
    const files = {
      [lang === 'en' ? 'check-report.md' : '检查报告.md']: reportMarkdown(db, checks, lang, src),
      [lang === 'en' ? 'chronicles.md' : '人物年表.md']: chronicleMarkdown(db, lang),
      [lang === 'en' ? 'story-data.json' : '故事数据.json']: snapshotJson(db, checks, src),
    };
    for (const [n, body] of Object.entries(files)) fs.writeFileSync(path.join(out, n), body, 'utf8');
    console.log(`wrote ${Object.keys(files).join(', ')} to ${out}`);
    console.log(`${checks.counts.error} errors, ${checks.counts.warning} warnings, ${checks.counts.info} notes`);
  } else {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 10).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exitCode = 2;
  }
} catch (e) {
  if (e.code === 'NOT_STORYDB') console.error(`Not a StoryDB workbook. Sheets found: ${e.sheets.join(', ')}. See templates/转换指南.md.`);
  else console.error(e.message);
  process.exitCode = 2;
}
