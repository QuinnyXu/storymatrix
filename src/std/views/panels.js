// HTML panels: overview, character profile, checks list.
import { t, getLang } from '../i18n.js';
import { schema, isDropped, ageAt, charFull, charLabel, locName } from '../load.js';
import { fmtDate } from '../dates.js';
import { esc } from './common.js';

const L = () => getLang();

// ---------- overview ----------
export function overviewHtml(db, checks) {
  const lang = L();
  const decided = db.events.filter((e) => e.status === db.settings.decidedStatus).length;
  const tile = (v, k) => `<div class="tile"><div class="v">${v}</div><div class="k">${k}</div></div>`;
  const tiles = [
    tile(db.characters.length, t('o.characters')),
    tile(db.events.length, t('o.events')),
    tile(db.apps.length, t('o.apps')),
    tile(db.relationships.length, t('o.relationships')),
    tile(db.locations.length, t('o.locations')),
    tile(db.chapters.length, t('o.chapters')),
  ].join('');
  const span = db.dateRange ? t('o.span', { from: fmtDate(db.dateRange.from, '日', lang), to: fmtDate(db.dateRange.to, '日', lang) }) : '';
  const pct = db.events.length ? Math.round((100 * decided) / db.events.length) : 0;

  const statusMix = [...db.settings.statusList, '']
    .map((s) => [s, db.events.filter((e) => (e.status || '') === s).length])
    .filter(([, n]) => n)
    .map(([s, n]) => `<span class="tag">${esc(s || t('color.none'))} ${n}</span>`)
    .join(' ');

  const mainList = db.main.map((id) => `<button class="link" data-profile="${esc(id)}">${esc(charFull(db.byId.characters.get(id), lang))}</button>`).join(' ');

  const sheetRows = schema.sheets
    .map((s) => {
      const f = db.sheets[s.key];
      const status = f ? t('o.found', { name: esc(f.name), n: f.columns.length }) : `<span class="muted">${t('o.missing')}</span>`;
      const extra = f?.extra?.length ? `<div class="small muted">${t('o.extra', { cols: esc(f.extra.join('、')) })}</div>` : '';
      return `<tr><td><b>${esc(s[lang])}</b>${s.required ? ' *' : ''}<div class="small muted">${esc(s.desc[lang])}</div></td><td>${status}${extra}</td></tr>`;
    })
    .join('');

  const undated = db.events.filter((e) => e.dateMs == null && !isDropped(db, e));
  const undatedHtml = undated.length
    ? `<table><tbody>${undated.map((e) => `<tr class="click" data-event="${esc(e.id)}"><td>${esc(e.id)}</td><td>${esc(e.title)}</td><td class="small muted">${esc(e.timeNote || '')}</td><td class="small">${esc((e.chars || []).map((c) => charLabel(db.byId.characters.get(c), lang) || c).join('、'))}</td></tr>`).join('')}</tbody></table>`
    : `<p class="muted">${t('none')}</p>`;

  const open = db.foreshadowing.filter((f) => !f.paid);
  const openHtml = open.length
    ? `<table><tbody>${open.map((f) => `<tr><td>${esc(f.id)}</td><td>${esc(f.content)}</td><td class="small muted">${esc(f.planted || '')} → ${esc(f.plan || '?')}</td></tr>`).join('')}</tbody></table>`
    : `<p class="muted">${t('none')}</p>`;

  return `
    <div class="tiles">${tiles}</div>
    <div class="card">
      <div>${span}${span ? ' · ' : ''}${t('o.decided', { p: pct })} · <span class="sev error"></span> ${checks.counts.error} · <span class="sev warning"></span> ${checks.counts.warning} · <span class="sev info"></span> ${checks.counts.info}</div>
      <div class="small" style="margin-top:6px">${t('o.statusMix')}: ${statusMix}</div>
      <div class="small" style="margin-top:6px">${t('o.main', { src: t('o.main.' + db.mainSource) })}: ${mainList}</div>
    </div>
    <div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
      <div class="card"><h2>${t('o.undated')} (${undated.length})</h2>${undatedHtml}</div>
      <div class="card"><h2>${t('o.openSetups')} (${open.length})</h2>${openHtml}</div>
    </div>
    <div class="card"><h2>${t('o.sheets')}</h2><p class="hint">${t('o.sheetsHint')}</p><div class="tablewrap"><table><tbody>${sheetRows}</tbody></table></div></div>`;
}

// ---------- character profile ----------
export function profileHtml(db, checks, charId) {
  const lang = L();
  const order = [...db.main, ...db.characters.map((c) => c.id).filter((id) => !db.main.includes(id))];
  const list = order
    .map((id) => db.byId.characters.get(id))
    .filter((c) => c && !isDropped(db, c))
    .map((c, i) => `${i === db.main.length && i ? '<hr style="border:none;border-top:1px solid var(--grid);width:100%">' : ''}<button data-profile="${esc(c.id)}" class="${c.id === charId ? 'on' : ''}">${esc(charFull(c, lang))} <span class="muted small">${esc(c.id)}</span></button>`)
    .join('');
  const c = db.byId.characters.get(charId);
  if (!c) return `<div class="profile-grid"><div class="plist card">${list}</div><div class="card"><p class="hint">${t('p.pick')}</p></div></div>`;

  const refAge = db.referenceMs != null ? ageAt(c, db.referenceMs) : null;
  const kv = [
    ['ID', esc(c.id)],
    [lang === 'en' ? 'Name' : '姓名', esc([c.name, c.short && c.short !== c.name ? c.short : '', c.nameEn].filter(Boolean).join(' · '))],
    [lang === 'en' ? 'Role' : '定位', esc(c.role || '')],
    [lang === 'en' ? 'Group' : '分组', esc(c.group || '')],
    [lang === 'en' ? 'Gender / species' : '性别 / 物种', esc([c.gender, c.species].filter(Boolean).join(' · '))],
    [t('f.born'), c.birth?.ms != null ? fmtDate(c.birth.ms, c.birth.prec, lang) + (refAge != null ? ` · ${t('f.ageRef', { date: fmtDate(db.referenceMs, '日', lang), age: Math.floor(refAge) })}` : '') : esc(c.birth?.text || '')],
    [t('f.died'), c.death?.ms != null ? fmtDate(c.death.ms, c.death.prec, lang) : ''],
    [lang === 'en' ? 'Identity' : '身份', esc(c.identity || '')],
    [lang === 'en' ? 'First chapter' : '首次出场章', esc(c.firstChapter || '')],
    [t('f.status'), esc(c.status || '')],
    [lang === 'en' ? 'Profile' : '简介', esc(c.profile || '')],
    [t('f.notes'), esc(c.notes || '')],
    ...Object.entries(c.extra || {}).map(([k, v]) => [esc(k), esc(v)]),
  ].filter(([, v]) => v);

  const apps = (db.appsByChar.get(c.id) || []).filter((a) => !isDropped(db, a.ev));
  const stays = (db.staysByChar.get(c.id) || []).filter((s) => !isDropped(db, s));
  const rows = [
    ...apps.map((a) => ({ ms: a.dateMs, html: chronRow(db, c, a, lang) })),
    ...stays.map((s) => ({
      ms: s.startMs,
      html: `<tr><td class="num">${fmtDate(s.startMs, s.start.prec, lang)} → ${fmtDate(s.endMs, s.end?.prec || s.start.prec, lang)}</td><td class="num">${fmtAge(c, s.startMs)}</td><td>${esc(locName(db, s.loc))}</td><td><span class="tag">${t('f.stay')}</span></td><td class="small ink2">${esc(s.notes || '')}</td><td></td></tr>`,
    })),
  ].sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity));
  const chron = rows.length
    ? `<div class="tablewrap"><table><thead><tr><th>${t('f.date')}</th><th>${t('f.age')}</th><th>${t('f.location')}</th><th>${t('f.event')}</th><th>${t('f.action')}</th><th>${t('f.chapter')}</th></tr></thead><tbody>${rows.map((r) => r.html).join('')}</tbody></table></div>`
    : `<p class="muted">${t('p.noEvents')}</p>`;

  const places = new Map();
  for (const a of apps) if (a.locId && !a.mentioned) places.set(a.locId, (places.get(a.locId) || 0) + 1);
  const placesHtml = [...places.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => `<span class="tag">${esc(locName(db, id))} ×${n}</span>`).join(' ');

  const rels = db.relationships.filter((r) => (r.a === c.id || r.b === c.id) && !isDropped(db, r));
  const relHtml = rels.length
    ? `<table><tbody>${rels
        .map((r) => {
          const other = r.a === c.id ? r.b : r.a;
          const arrow = r.direction === 'A→B' ? (r.a === c.id ? '→' : '←') : '—';
          const extra = Object.entries(r.extra || {}).map(([k, v]) => `<div class="small muted">${esc(k)}: ${esc(v)}</div>`).join('');
          return `<tr><td>${arrow}</td><td><button class="link" data-profile="${esc(other)}">${esc(charFull(db.byId.characters.get(other), lang) || other)}</button></td><td>${esc(r.type)}${r.status ? ` <span class="tag">${esc(r.status)}</span>` : ''}${extra}${r.notes ? `<div class="small">${esc(r.notes)}</div>` : ''}</td></tr>`;
        })
        .join('')}</tbody></table>`
    : `<p class="muted">${t('none')}</p>`;

  const knows = db.knowledge.filter((k) => k.char === c.id && !isDropped(db, k));
  const knowsHtml = knows.length
    ? `<table><thead><tr><th>${t('f.secret')}</th><th>${t('f.when')}</th><th>${t('f.how')}</th></tr></thead><tbody>${knows.map((k) => `<tr><td>${esc(k.id)} ${esc(k.secret)}</td><td class="num">${k.when?.ms != null ? fmtDate(k.when.ms, k.when.prec, lang) : esc(k.when?.text || '')}</td><td class="small">${esc(k.how || '')}</td></tr>`).join('')}</tbody></table>`
    : '';

  const fs = checks.findings.filter((f) => f.chars.includes(c.id));
  const fsHtml = fs.length ? fs.map((f) => `<div class="finding" data-fid="${f.id}"><span class="sev ${f.sev}"></span><span>${esc(f.msg[lang] || f.msg.zh)}</span></div>`).join('') : '';

  return `<div class="profile-grid">
    <div class="plist card">${list}</div>
    <div>
      <div class="card"><h2>${esc(charFull(c, lang))} <button class="link small" data-show-timeline="${esc(c.id)}">${t('p.openTimeline')}</button></h2><dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        ${placesHtml ? `<h3>${t('p.places')}</h3>${placesHtml}` : ''}</div>
      <div class="card"><h2>${t('p.chron')} (${apps.length})</h2>${chron}</div>
      <div class="card"><h2>${t('p.rels')} (${rels.length})</h2>${relHtml}</div>
      ${knowsHtml ? `<div class="card"><h2>${t('p.knows')} (${knows.length})</h2>${knowsHtml}</div>` : ''}
      ${fsHtml ? `<div class="card"><h2>${t('p.issues')} (${fs.length})</h2>${fsHtml}</div>` : ''}
    </div></div>`;
}

const fmtAge = (c, ms) => {
  const a = ageAt(c, ms);
  return a == null ? '' : a.toFixed(1);
};

function chronRow(db, c, a, lang) {
  const e = a.ev;
  const ch = db.byId.chapters.get(e.chapter);
  return `<tr class="click" data-event="${esc(e.id)}"><td class="num">${fmtDate(a.dateMs, e.prec, lang)}${e.timeNote ? `<div class="small muted">${esc(e.timeNote)}</div>` : ''}</td><td class="num">${fmtAge(c, a.dateMs)}</td>
    <td>${a.locId ? esc(locName(db, a.locId)) + (a.locSource !== 'event' ? ` <span class="tag">${t('loc.' + a.locSource)}</span>` : '') : '<span class="muted">?</span>'}</td>
    <td>${esc(e.title)}${a.mentioned ? ` <span class="tag">${t('f.mentioned')}</span>` : ''}</td><td class="small ink2">${esc(a.action || '')}</td><td class="small">${esc(ch ? ch.id : e.chapter || '')}</td></tr>`;
}

// ---------- checks ----------
export function checksHtml(db, checks, open) {
  const lang = L();
  if (!checks.findings.length) return `<div class="card"><p>${t('c.none')}</p></div>`;
  const sec = (sev) => {
    const list = checks.findings.filter((f) => f.sev === sev);
    if (!list.length) return '';
    return `<details class="card" data-sev="${sev}" ${open.has(sev) ? 'open' : ''}><summary><span class="sev ${sev}">${t('sev.' + sev)}</span> (${list.length})</summary>
      ${list.map((f) => `<div class="finding" data-fid="${f.id}"><span class="code">${esc(f.code)}</span><span class="small muted" style="min-width:110px">${esc(f.sheet || '')}${f.row ? ' #' + f.row : ''}</span><span>${esc(f.msg[lang] || f.msg.zh)}</span></div>`).join('')}</details>`;
  };
  return `<p class="hint">${t('c.hint')} <button class="link" data-act="copyMd">${t('btn.copyMd')}</button></p>${sec('error')}${sec('warning')}${sec('info')}`;
}
