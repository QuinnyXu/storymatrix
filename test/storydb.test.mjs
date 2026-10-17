// StoryDB loader + checks on small in-memory workbooks, plus the generated example workbook.
// Usage: node test/storydb.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStoryDb, mapColumns, SHEET } from '../src/std/load.js';
import { runChecks } from '../src/std/checks.js';
import { parseStoryDate, iso, fmtDate } from '../src/std/dates.js';
import { reportMarkdown, chronicleMarkdown, snapshotJson } from '../src/std/export.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const mod = { exports: {} };
new Function('module', 'exports', fs.readFileSync(path.join(root, 'vendor/xlsx.full.min.js'), 'utf8'))(mod, mod.exports);
const XLSX = mod.exports;

let failed = 0;
let n = 0;
function ok(cond, name, extra = '') {
  n++;
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}
const book = (sheets) => {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};
const codes = (c) => c.findings.map((f) => f.code);

console.log('dates');
const fest = new Map([['2031|春节', Date.UTC(2031, 0, 23)]]);
ok(iso(parseStoryDate('2031-07-11').ms) === '2031-07-11', 'ISO day');
ok(parseStoryDate('2031-07').prec === '月' && iso(parseStoryDate('2031-07').ms) === '2031-07-15', 'year-month -> mid-month');
ok(parseStoryDate('2031').prec === '年', 'bare year');
ok(parseStoryDate(2031).prec === '年', 'numeric year');
ok(iso(parseStoryDate(47935).ms) === '2031-03-28', 'Excel serial');
ok(parseStoryDate('2031 春').prec === '季', 'season');
ok(iso(parseStoryDate('2031-03 底').ms) === '2031-03-25', 'end of month');
ok(iso(parseStoryDate('2031 春节', fest).ms) === '2031-01-23', 'festival token');
ok(parseStoryDate('2032 春节', fest).error === 'festival', 'festival missing for year');
ok(parseStoryDate('约 1850').prec === '约' && iso(parseStoryDate('约 1850').ms) === '1850-07-01', 'circa, pre-1900');
ok(fmtDate(parseStoryDate('前722').ms, '年') === '前722', 'BC year (Spring and Autumn)');
ok(parseStoryDate('开春到入秋').error, 'unreadable text');

console.log('column matching');
const m = mapColumns(['人物ID', '姓名', '层标', '性格与设定（第二版）', '参照日年龄（自动）', '口头禅'], SHEET.characters);
ok(m.col.status === 2 && m.col.profile === 3, 'aliases + "name（remark）" prefix');
ok(m.extra.length === 1 && m.extra[0].header === '口头禅', 'auto columns ignored, unknown kept as extra');
const en = mapColumns(['Character ID', 'Name', 'Birth date'], SHEET.characters);
ok(en.col.id === 0 && en.col.birth === 2, 'English headers');

console.log('loader + checks (synthetic)');
const base = {
  人物: [['人物ID', '姓名', '出生日期', '去世日期', '主要人物', '状态'], ['C01', '甲', '2000-01-01', '', '是', '定'], ['C02', '乙', '1990-01-01', '2010-01-01', '是', '定'], ['C03', '丙', '', '', '', '']],
  地点: [['地点ID', '名称', '上级地点ID'], ['L1', '城', ''], ['L2', '屋', 'L1'], ['L3', '海', '']],
  事件: [
    ['事件ID', '日期', '事件', '涉及人物ID', '地点ID', '状态', '备注'],
    ['T1', '1999-06-01', '甲出生前', 'C01', 'L1', '定', ''],
    ['T2', '2020-05-05', '乙死后', 'C02', 'L1', '定', ''],
    ['T3', '2020-05-05', '在屋里', 'C01、C09', 'L2', '定', '【缺】'],
    ['T4', '2020-05-05', '在海上', 'C01', 'L3', '定', ''],
    ['T5', '2005 春', '季节精度', 'C01', 'L1', '暂', ''],
    ['T5', '2006', '重复ID', 'C01', '', '', ''],
  ],
  出场: [['事件ID', '人物ID', '行动', '地点ID', '参与方式'], ['T2', 'C02', '被回忆', '', '提及'], ['T4', 'C03', '', 'L2', '']],
  行踪: [['人物ID', '开始日期', '结束日期', '地点ID'], ['C03', '2020-05-01', '2020-05-31', 'L3']],
  关系: [['关系ID', '人物A_ID', '人物B_ID', '关系类型'], ['R1', 'C01', 'C02', '朋友'], ['R2', 'C02', 'C01', '朋友'], ['R3', 'C01', 'C01', '自己']],
  章节: [['章ID', '章序'], ['CH1', 1], ['CH2', 2]],
  伏笔: [['伏笔ID', '内容', '埋设章', '实际回收章'], ['F1', 'x', 'CH2', 'CH1']],
};
const db = loadStoryDb(XLSX, book(base));
const c = runChecks(db);
ok(db.characters.length === 3 && db.events.length === 5, 'rows read; duplicate ID dropped');
ok(codes(c).includes('dupId'), 'duplicate ID reported');
ok(c.findings.some((f) => f.code === 'badRef' && f.msg.zh.includes('C09')), 'broken character reference');
ok(c.findings.some((f) => f.code === 'C01' && f.chars[0] === 'C01'), 'before birth');
ok(!c.findings.some((f) => f.code === 'C01' && f.chars[0] === 'C02'), 'mentioned after death is fine');
ok(c.findings.some((f) => f.code === 'C02' && f.chars[0] === 'C01'), 'two places on one day (屋 vs 海)');
ok(!c.findings.some((f) => f.code === 'C02' && f.msg.zh.includes('「城」') && f.msg.zh.includes('「屋」')), 'nested places are not a conflict');
ok(c.findings.some((f) => f.code === 'C03' && f.chars[0] === 'C03'), 'own location contradicts whereabouts');
ok(c.findings.some((f) => f.code === 'C05' && f.eventId === 'T3'), 'decided row with open marker');
ok(c.findings.some((f) => f.code === 'C06'), 'payoff before setup');
ok(c.findings.filter((f) => f.code === 'C07').length === 2, 'self relationship + duplicate pair');
ok(db.main.join() === 'C01,C02', 'main characters from the 主要人物 column');
const t3c1 = db.apps.find((a) => a.event === 'T3' && a.char === 'C01');
ok(t3c1.locId === 'L2' && t3c1.locSource === 'event', 'location from the event');
ok(db.apps.find((a) => a.event === 'T4' && a.char === 'C03').locSource === 'own', 'own location from 出场');

const noDb = (() => {
  try {
    loadStoryDb(XLSX, book({ 草稿: [['年份', '阿青']], 杂项: [['备忘']] }));
  } catch (e) {
    return e.code;
  }
})();
ok(noDb === 'NOT_STORYDB', 'non-StoryDB workbook is rejected with a clear code');
const legacyLike = loadStoryDb(XLSX, book({ 人物: [['人物', '物种'], ['阿青', '狐狸']], 事件: [['事件ID', '事件'], ['T1', 'x']] }));
ok(legacyLike.issues.some((i) => i.code === 'missingColumn'), 'missing ID column is reported');
ok(reportMarkdown(db, c).includes('C06') && chronicleMarkdown(db).includes('甲') && JSON.parse(snapshotJson(db, c)).appearances.length === db.apps.length, 'exports');

console.log('generated example workbook');
const exPath = path.join(root, 'templates/示例_星河旅店.xlsx');
if (fs.existsSync(exPath)) {
  const ex = loadStoryDb(XLSX, fs.readFileSync(exPath));
  const ec = runChecks(ex);
  ok(ex.title.zh === '星河旅店（示例）', 'title from 设置');
  ok(iso(ex.byId.events.get('T04').dateMs) === '2031-01-23', '"2031 春节" resolved through 节日');
  for (const code of ['C01', 'badRef', 'C06', 'C02', 'C03', 'C05']) ok(codes(ec).includes(code), `example shows ${code}`);
  ok(ex.relationships.find((r) => r.id === 'R10').status === '弃', 'dropped relationship kept for references');
} else console.log('  skip (run tools/make_template.py first)');

console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
