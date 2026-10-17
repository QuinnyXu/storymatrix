// Story dates. All values are UTC-midnight milliseconds. Precision says how exact a date is and widens the span
// that checks compare against (an event dated "2031 春" is not before a birthday on 2031-04-02).
export const DAY = 86400000;

/** Date.UTC that also works for years 0–99 and BC (astronomical numbering: 1 BC = year 0). */
export function ymd(y, m = 1, d = 1) {
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  t.setUTCHours(0, 0, 0, 0);
  return t.getTime();
}

const SEASON = { 春: [4, 15], 夏: [7, 15], 秋: [10, 15], 冬: [12, 15], spring: [4, 15], summer: [7, 15], autumn: [10, 15], fall: [10, 15], winter: [12, 15] };
const PART = { 初: 5, 上旬: 5, 中: 15, 中旬: 15, 底: 25, 末: 25, 下旬: 25 };

/**
 * Parse one date cell.
 *  2031-07-11 · 2031/7/11 · 2031年7月11日 · 2031-07 · 2031 · 2031 春 · 2031-03 底 · 2031 春节 · 约 1850 · 前722 · Excel serial/Date
 * @returns {{ms:number, prec:string, text:string}} | {error:string, text:string} | null for blank
 */
export function parseStoryDate(v, festivals = new Map()) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return { ms: ymd(v.getFullYear(), v.getMonth() + 1, v.getDate()), prec: '日', text: '' };
  if (typeof v === 'number') {
    if (Number.isInteger(v) && v >= -3000 && v < 3000) return { ms: ymd(v, 7, 1), prec: '年', text: String(v) };
    if (v > 0) return { ms: Math.round((Math.floor(v) - 25569) * DAY), prec: '日', text: '' };
    return { error: 'number', text: String(v) };
  }
  let s = String(v).trim();
  const raw = s;
  let approx = false;
  const ap = /^(约|大约|约莫|circa|ca\.?|c\.)\s*/i.exec(s);
  if (ap) {
    approx = true;
    s = s.slice(ap[0].length);
  }
  if (/(前后|左右)$/.test(s)) {
    approx = true;
    s = s.replace(/(前后|左右)$/, '').trim();
  }
  // year, with optional BC prefix (前 / 公元前 / BC) or a leading minus
  const ym = /^(公元前|前|BC\s*|-)?(\d{1,4})\s*年?/i.exec(s);
  if (!ym) return { error: 'format', text: raw };
  const y = ym[1] ? 1 - parseInt(ym[2], 10) : parseInt(ym[2], 10);
  let rest = s.slice(ym[0].length).trim();
  const out = (ms, prec) => ({ ms, prec: approx ? '约' : prec, text: raw });
  if (!rest) return out(ymd(y, 7, 1), '年');
  rest = rest.replace(/^[-/.]/, '').trim();
  const md = /^(\d{1,2})\s*[-/.月]?\s*(?:(\d{1,2})\s*日?)?\s*(初|上旬|中旬|中|下旬|底|末)?$/.exec(rest);
  if (md) {
    const m = +md[1];
    const d = md[2] ? +md[2] : md[3] ? PART[md[3]] : 15;
    if (m < 1 || m > 12 || d < 1 || d > 31) return { error: 'range', text: raw };
    return out(ymd(y, m, d), md[2] ? '日' : '月');
  }
  const se = /^(春|夏|秋|冬|spring|summer|autumn|fall|winter)(季|天)?$/i.exec(rest);
  if (se) {
    const [m, d] = SEASON[se[1].toLowerCase()];
    return out(ymd(y, m, d), '季');
  }
  const fest = festivals.get(`${y}|${rest}`);
  if (fest != null) return out(fest, '日');
  if (/^[\p{Script=Han}A-Za-z]+$/u.test(rest)) return { error: 'festival', text: raw };
  return { error: 'format', text: raw };
}

const SLACK = { 日: 0, 月: 16, 季: 46, 年: 183, 约: 730, 学年: 183 };
/** [lo, hi] in ms: the stretch of time the date could mean, widened by its precision and extended to the end date. */
export function spanOf(ms, prec, endMs = null) {
  const s = (SLACK[prec] ?? 0) * DAY;
  return [ms - s, Math.max(endMs ?? ms, ms) + s];
}

export function parts(ms) {
  const d = new Date(ms);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
export const yearLabel = (y, lang = 'zh') => (y > 0 ? String(y) : lang === 'en' ? `${1 - y} BC` : `前${1 - y}`);
export const iso = (ms) => {
  if (ms == null) return '';
  const p = parts(ms);
  return `${yearLabel(p.y, 'en').padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
};

/** Human date at the precision it was written with. */
export function fmtDate(ms, prec, lang = 'zh') {
  if (ms == null) return lang === 'en' ? 'undated' : '未定日期';
  const p = parts(ms);
  const y = yearLabel(p.y, lang);
  const mm = String(p.m).padStart(2, '0');
  const season = ['冬', '冬', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬'][p.m - 1];
  const seasonEn = { 春: 'spring', 夏: 'summer', 秋: 'autumn', 冬: 'winter' }[season];
  switch (prec) {
    case '年':
    case '学年':
      return y;
    case '约':
      return lang === 'en' ? `c. ${y}` : `约 ${y}`;
    case '季':
      return lang === 'en' ? `${seasonEn} ${y}` : `${y} ${season}`;
    case '月':
      return `${y}-${mm}`;
    default:
      return `${y}-${mm}-${String(p.d).padStart(2, '0')}`;
  }
}
