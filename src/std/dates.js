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
const MONTH_RE = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_PART = { early: '初', 'beginning of': '初', mid: '中', 'middle of': '中', late: '底', 'end of': '底' };
const EN_MONTH_DATE = new RegExp(String.raw`^(?:(early|mid|middle of|late|end of|beginning of)[\s-]+)?(?:(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?)?${MONTH_RE}(?:\s+(\d{1,2})(?:st|nd|rd|th)?)?,?\s+(\d{1,4})$`, 'i');
const EN_SEASON = /^(spring|summer|autumn|fall|winter)(?:\s+of)?,?\s+(\d{1,4})$/i;
const EN_NAMED = /^([A-Za-z][A-Za-z'’ .-]*?),?\s+(?:of\s+)?(\d{1,4})$/;

/** English word order -> the year-first form parsed below: "late March 2031" -> "2031-3 底", "spring 2031" -> "2031 spring",
 *  "Christmas 2031" -> "2031 Christmas". Returns the input unchanged when it is not one of these. */
function englishOrder(s) {
  let m = EN_MONTH_DATE.exec(s);
  if (m) {
    const [, part, d1, mon, d2, y] = m;
    const mm = MONTHS.indexOf(mon.slice(0, 3).toLowerCase()) + 1;
    const d = d1 || d2;
    return d ? `${y}-${mm}-${d}` : part ? `${y}-${mm} ${EN_PART[part.toLowerCase()]}` : `${y}-${mm}`;
  }
  m = EN_SEASON.exec(s);
  if (m) return `${m[2]} ${m[1]}`;
  m = EN_NAMED.exec(s);
  if (m && !/^(bce?|ad|ce)$/i.test(m[1].trim())) return `${m[2]} ${m[1].trim()}`;
  return s;
}

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
  const ap = /^(约|大约|约莫|circa|ca\.|c\.|ca\b|c\b|about|around|approx\.?|approximately|~)\s*/i.exec(s);
  if (ap) {
    approx = true;
    s = s.slice(ap[0].length);
  }
  if (/(前后|左右)$/.test(s)) {
    approx = true;
    s = s.replace(/(前后|左右)$/, '').trim();
  }
  const decade = /^(?:the\s+)?(\d{2,3})0['’]?s$/i.exec(s);
  if (decade) {
    approx = true;
    s = String(+decade[1] * 10 + 5);
  }
  // English era suffix (722 BC, 1066 AD) and English word order (late March 2031, spring 2031, Christmas 2031)
  let bc = false;
  const era = /(?<=[\d\s])(b\.?\s?c\.?(?:\s?e\.?)?|a\.?\s?d\.?|c\.?\s?e\.?)$/i.exec(s);
  if (era && /\d$/.test(s.slice(0, era.index).trim())) {
    bc = /^b/i.test(era[1]);
    s = s.slice(0, era.index).trim();
  }
  s = s.replace(/^(AD|A\.D\.)\s*(?=\d)/i, '');
  s = englishOrder(s);
  if (bc) s = '前' + s;
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
  if (/^[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z'’ .-]*$/u.test(rest)) return { error: 'festival', text: raw };
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
      return lang === 'en' ? `${MONTH_NAMES[p.m - 1]} ${y}` : `${y}-${mm}`;
    default:
      return `${y}-${mm}-${String(p.d).padStart(2, '0')}`;
  }
}
