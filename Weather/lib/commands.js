// VRG Időjárás — every command, in one dispatcher shared by the CLI, the pipelines, the daemon and the server.
// A command returns { ok, summary, text, data }: text for a person, data for --json and the page.
'use strict';

const { VARS, WMO } = require('./vars');
const { parseArgs, now, addH, hourFloor, local, config } = require('./common');
const { open, iso } = require('./db');
const { dbFile } = require('./common');
const S = require('./sources');
const P = require('./places');
const FETCH = require('./fetch');
const FUSE = require('./fuse');
const VERIFY = require('./verify');
const R = require('./rules');
const BRIEF = require('./brief');
const OPS = require('./ops');
const PIPE = require('./pipeline');

function context(opts = {}) {
  const cfg = config();
  const db = opts.db || open(opts.file || dbFile());
  S.sync(db, cfg.sources);
  P.seed(db, cfg.places);
  return { db, cfg, settings: cfg.settings, replay: opts.replay || null };
}

const pad = (s, n) => String(s ?? '').padEnd(n);
const n1 = x => (x == null ? '   -' : x.toFixed(1).padStart(5));
const hm = (t, tz) => { const l = local(t, tz); return `${l.date.slice(5)} ${String(l.hour).padStart(2, '0')}h`; };
const placeOr = (db, q) => { const p = q ? P.find(db, q) : P.find(db, 'budapest') || P.list(db)[0]; if (!p) throw new Error('nincs ilyen hely: ' + q); return p; };

const HELP = `VRG Idojaras - tobbforrasu idojaras-adatbazis es automatizalas
  node Weather/vrg-weather.js <parancs> [...]

  init                       adatbazis, forrasok, helyek
  status                     attekintes
  sources                    forrasok: licenc, kapu, utolso letoltes
  places [add "Nev" --lat --lon [--areas Pest] [--activities kulteri,kabel] | off <id> | on <id>]
  sync-jobs [--file helyek.json]   a folyamatban levo munkak helyszinei (VRG Terkep)
  fetch [forras...] [--place id] [--force] [--replay mappa]
  fuse [--place id]          konszenzus + bizonytalansag
  verify                     forrasok pontossaga a meresek alapjan (sulyok)
  alerts [--list]            szabalyok -> riasztasok, kezbesites
  ack <id>                   riasztas nyugtazasa
  now [hely]                 most: konszenzus + legkozelebbi meres
  forecast [hely] [--hours 24] [--var gust]
  windows [hely]             munkaablak tevekenysegenkent (48 ora)
  warnings                   hivatalos figyelmeztetesek
  brief [hely|--all] [--day today|tomorrow] [--save]
  pv <hely> [--kwp 10 --angle 35 --aspect 0 --loss 14]
  export                     data/export/latest.json (Asztal, Kapu, Mobile)
  pipelines | run <folyamat> folyamatok (config/pipelines.json)
  daemon [--once]            utemezo (config/pipelines.json schedule)
  doctor [--live]            egeszsegellenorzes
  sql "<SELECT ...>"         csak olvaso lekerdezes
  prune                      megorzesi idon tuli adatok torlese
  minden parancs: --json  (gepi kimenet), --replay <mappa> (halozat nelkul)`;

const CMDS = {
  help: async () => ({ ok: true, text: HELP }),
  init: async ctx => ({ ok: true, summary: 'kesz', text: `Adatbazis: ${dbFile()}\nForrasok: ${ctx.cfg.sources.length}, helyek: ${P.list(ctx.db).length}` }),

  status: async ctx => {
    const s = OPS.status(ctx);
    return { ok: true, data: s, text: [`Adatbazis: ${s.db}  (hasznalat: ${s.use})`, `Helyek: ${s.places}`,
      'Sorok: ' + Object.entries(s.rows).map(([k, v]) => `${k} ${v}`).join(', '),
      'Nyitott riasztasok: ' + (s.openAlerts.map(a => `${a.level} ${a.n}`).join(', ') || 'nincs'),
      'Utolso folyamat: ' + (s.lastRun ? `${s.lastRun.name} ${s.lastRun.started} ${s.lastRun.status}` : '-')].join('\n') };
  },

  sources: async ctx => {
    const list = OPS.sourceStatus(ctx);
    const text = list.map(s => `${s.run ? (s.stale ? 'REGI' : ' ok ') : ' -- '} ${pad(s.id, 22)} ${pad(s.kind, 12)} uzleti:${pad(s.commercial, 4)} ` +
      (s.run ? (s.lastOk ? `${s.ageMin} perce` : 'meg nem toltott') : s.why) + (s.verified !== 'yes' ? '  [nem ellenorzott]' : '')).join('\n');
    return { ok: true, data: list, text };
  },

  places: async (ctx, a) => {
    const sub = a._[1];
    if (sub === 'add') { const id = P.add(ctx.db, { name: a._[2], lat: a.lat, lon: a.lon, elev: a.elev, areas: a.areas, activities: a.activities }); return { ok: true, summary: id, text: 'Felveve: ' + id }; }
    if (sub === 'off' || sub === 'on') { const n = P.setActive(ctx.db, a._[2], sub === 'on'); return { ok: !!n, text: n ? `${a._[2]}: ${sub}` : 'nincs ilyen hely' }; }
    const list = P.list(ctx.db, { all: !!a.all });
    return { ok: true, data: list, text: list.map(p => `${pad(p.id, 16)} ${pad(p.kind, 6)} ${p.lat.toFixed(4)} ${p.lon.toFixed(4)}  ${p.name}  [${p.activities.join(',')}]${p.active ? '' : ' (ki)'}`).join('\n') };
  },

  'sync-jobs': async (ctx, a) => {
    if (ctx.settings.jobs && ctx.settings.jobs.import === false) return { ok: true, summary: 'kikapcsolva', text: 'A munkak importja ki van kapcsolva (settings.jobs.import).' };
    const r = P.syncJobs(ctx.db, ctx.settings, a.file);
    return { ok: r.ok, summary: r.ok ? `${r.added} munka, ${r.off} lezart` : r.why, text: r.ok ? `Munkak: ${r.added} figyelt, ${r.off} mar nem folyamatban` : r.why, data: r };
  },

  fetch: async (ctx, a) => {
    const ids = a._.slice(1);
    const res = await FETCH.run(ctx, { ids, place: a.place || null, force: !!a.force });
    const okN = res.filter(r => r.status === 'ok').length, bad = res.filter(r => ['error', 'parse'].includes(r.status));
    const rows = res.reduce((s, r) => s + (r.rows || 0), 0);
    return { ok: !bad.length, data: res, summary: `${okN} ok, ${bad.length} hiba, ${rows} sor`,
      text: res.map(r => `${pad(r.status, 7)} ${pad(r.source, 22)} ${pad(r.place || '', 14)} ${r.rows != null ? r.rows + ' sor' : ''} ${r.error || ''}`).join('\n') + `\n${okN} ok, ${bad.length} hiba, ${rows} sor` };
  },

  fuse: async (ctx, a) => {
    const places = a.place ? [placeOr(ctx.db, a.place)] : P.list(ctx.db);
    const r = FUSE.run(ctx, places);
    return { ok: true, data: r, summary: `${r.length} hely, ${r.reduce((s, x) => s + x.values, 0)} ertek`,
      text: r.map(x => `${pad(x.place, 16)} ${x.hours} ora, ${x.members.length} tag: ${x.members.join(', ')}`).join('\n') };
  },

  verify: async ctx => {
    const r = VERIFY.run(ctx);
    const sk = ctx.db.all("SELECT member, var, lead, n, mae, bias FROM skill WHERE var IN ('t2m', 'gust', 'precip') ORDER BY var, lead, mae");
    return { ok: true, data: { ...r, skill: sk }, summary: `${r.groups} csoport, ${r.places.length} hely`,
      text: (r.places.length ? r.places.map(p => `${pad(p.place, 16)} allomas ${p.station} (${p.km} km): ${p.pairs} par`).join('\n') : 'Nincs hely meroallomassal a kozelben, vagy nincs meres.') +
        (sk.length ? '\n' + sk.map(s => `  ${pad(s.var, 7)} ${pad(s.lead, 5)} ${pad(s.member, 32)} n=${pad(s.n, 5)} MAE ${s.mae.toFixed(2)} bias ${s.bias == null ? '-' : s.bias.toFixed(2)}`).join('\n') : '') };
  },

  alerts: async (ctx, a) => {
    let r = null;
    if (!a.list) r = await R.run(ctx);
    const open = ctx.db.all(`SELECT a.id, a.level, a.activity, a.status, a.starts, a.ends, a.title, p.name AS place FROM alert a JOIN place p ON p.id = a.place_id
      WHERE a.status IN ('open', 'ack') ORDER BY CASE a.level WHEN 'red' THEN 0 WHEN 'amber' THEN 1 ELSE 2 END, a.starts LIMIT ${+(a.limit || 60)}`);
    const tz = ctx.settings.timezone;
    return { ok: true, data: { run: r, open }, summary: r ? `${r.new} uj, ${r.escalated} sulyosbodott, ${r.cleared} megszunt, ${r.delivered} kezbesitve` : `${open.length} nyitott`,
      text: (r ? `Uj ${r.new}, frissitett ${r.updated}, sulyosbodott ${r.escalated}, megszunt ${r.cleared}; kezbesitve ${r.delivered}${r.failed ? ', HIBA ' + r.failed : ''}\n` : '') +
        open.map(x => `#${pad(x.id, 4)} ${pad(x.level.toUpperCase(), 6)} ${pad(x.status, 5)} ${hm(x.starts, tz)}-${hm(x.ends, tz)} ${pad(x.activity, 9)} ${pad(x.place, 20)} ${x.title}`).join('\n') };
  },

  ack: async (ctx, a) => {
    const n = ctx.db.run("UPDATE alert SET status = 'ack' WHERE id = ? AND status = 'open'", +a._[1]).changes;
    return { ok: !!n, text: n ? 'Nyugtazva: #' + a._[1] : 'nincs ilyen nyitott riasztas' };
  },

  now: async (ctx, a) => {
    const p = placeOr(ctx.db, a._[1] || a.place);
    const c = OPS.current(ctx, p), f = c.fused;
    const lines = [`${p.name}`];
    if (f) lines.push(`Konszenzus: ${n1(f.t2m)} C, hoerzet ${n1(f.tapp)} C, szel ${n1(f.wind)} / lokes ${n1(f.gust)} m/s, csapadek ${n1(f.precip)} mm/h (${f.pop == null ? '-' : Math.round(f.pop)} %), ${f.wmo != null && WMO[f.wmo] ? WMO[f.wmo].hu : '-'}  [biztonsag: ${f._conf.t2m || '-'}]`);
    else lines.push('Nincs konszenzus erre az orara (run modell).');
    if (c.obs) lines.push(`Meres: ${c.obs.station} (${c.obs.km} km, ${c.obs.at}): ${n1(c.obs.t2m)} C, ${c.obs.rh2m == null ? '-' : Math.round(c.obs.rh2m)} %, szel ${n1(c.obs.wind)} / lokes ${n1(c.obs.gust)} m/s`);
    return { ok: true, data: c, text: lines.join('\n') };
  },

  forecast: async (ctx, a) => {
    const p = placeOr(ctx.db, a._[1] || a.place);
    const h = hourFloor(now()), hours = FUSE.table(ctx.db, p.id, addH(h, 1), addH(h, +(a.hours || 24)));
    const tz = ctx.settings.timezone;
    if (a.var) {
      const v = a.var;
      return { ok: true, data: hours.map(x => ({ valid: x.valid, value: x[v], spread: x._spread[v], members: x._members[v] })),
        text: hours.map(x => `${hm(x.valid, tz)} ${n1(x[v])} +-${n1(x._spread[v])}  ` + Object.entries(x._members[v] || {}).map(([m, val]) => `${m.split('/').pop()}=${val}`).join(' ')).join('\n') };
    }
    return { ok: true, data: hours, text: `${p.name}\n ora       hom   lokes  csap  val%  kod  biztonsag\n` + hours.map(x => `${hm(x.valid, tz)} ${n1(x.t2m)} ${n1(x.gust)} ${n1(x.precip)} ${x.pop == null ? '    -' : String(Math.round(x.pop)).padStart(5)}  ${pad(x.wmo ?? '-', 4)} ${x._conf.t2m || '-'}`).join('\n') };
  },

  windows: async (ctx, a) => {
    const p = placeOr(ctx.db, a._[1] || a.place);
    const w = R.windows(ctx, p, 48);
    const ch = { ok: '.', info: 'i', amber: 'o', red: 'X' };
    return { ok: true, data: w, text: `${p.name}  (. jo, i info, o ovatosan, X tilos; 48 ora, oranként)\n` + Object.entries(w).map(([act, hs]) => `${pad(act, 9)} ${hs.map(x => ch[x.level]).join('')}`).join('\n') };
  },

  warnings: async ctx => {
    const ws = ctx.db.all('SELECT w.*, (SELECT GROUP_CONCAT(place_id) FROM warning_place WHERE warning_id = w.id) AS places FROM warning w WHERE expires >= ? ORDER BY level DESC, onset', iso(now()));
    return { ok: true, data: ws, text: ws.length ? ws.map(w => `szint ${w.level} ${pad(w.area, 24)} ${w.onset} - ${w.expires}  ${w.event}  [${w.places || '-'}]`).join('\n') : 'Nincs ervenyes figyelmeztetes.' };
  },

  brief: async (ctx, a) => {
    const places = a.all ? P.list(ctx.db) : [placeOr(ctx.db, a._[1] || a.place)];
    const out = [];
    for (const p of places) {
      const b = BRIEF.make(ctx, p, a.day === 'tomorrow' || a.day === 'holnap' ? 'tomorrow' : 'today');
      if (a.save) b.file = BRIEF.save(b);
      out.push(b);
    }
    return { ok: true, data: out, summary: `${out.length} brief` + (a.save ? ' mentve' : ''), text: out.map(b => b.text + (b.file ? `\n(${b.file})` : '')).join('\n\n') };
  },

  pv: async (ctx, a) => {
    const p = placeOr(ctx.db, a._[1] || a.place);
    const res = await FETCH.run(ctx, { ids: ['pvgis'], place: p.id, force: true, opts: { kwp: a.kwp, angle: a.angle, aspect: a.aspect, loss: a.loss } });
    const rows = ctx.db.all("SELECT key, month, value, unit, params FROM climate WHERE source_id = 'pvgis' AND place_id = ? ORDER BY key, month", p.id);
    const m = rows.filter(r => r.key === 'pv_E_m'), y = rows.find(r => r.key === 'pv_E_y');
    return { ok: res.every(r => r.status === 'ok'), data: { fetch: res, rows }, text: `${p.name}  PVGIS ${rows[0] ? rows[0].params : ''}\n` +
      (m.length ? m.map(r => `  ${String(r.month).padStart(2)}. ho ${r.value.toFixed(0).padStart(6)} kWh`).join('\n') + (y ? `\n  ev     ${y.value.toFixed(0).padStart(6)} kWh` : '') : res.map(r => `${r.status} ${r.error || ''}`).join('\n')) };
  },

  export: async ctx => { const r = OPS.exportLatest(ctx); return { ok: true, summary: `${r.places} hely`, text: 'Irva: ' + r.file, data: r }; },
  prune: async ctx => { const r = OPS.prune(ctx); return { ok: true, summary: Object.entries(r).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ') || 'nincs mit', text: JSON.stringify(r), data: r }; },

  pipelines: async ctx => {
    const p = ctx.cfg.pipelines;
    return { ok: true, data: p, text: Object.entries(p.pipelines).map(([k, v]) => `${pad(k, 8)} ${v.hu}\n         ${v.steps.join(' | ')}`).join('\n') +
      '\nUtemezes: ' + p.schedule.map(e => `${e.run} ${e.every ? 'minden ' + e.every + ' percben' : e.at + (e.day ? ' (' + e.day + '.)' : '')}`).join('; ') };
  },
  run: async (ctx, a) => {
    const lines = [];
    const r = await PIPE.runPipeline(ctx, a._[1], dispatch, l => lines.push(l));
    return { ok: r.status !== 'fail', data: r, summary: r.status, text: `Folyamat ${r.name}: ${r.status}\n` + lines.join('\n') };
  },

  doctor: async (ctx, a) => {
    if (a.live) await live(ctx);
    const r = OPS.doctor(ctx);
    const mark = { ok: ' ok ', info: 'info', warn: 'WARN', fail: 'FAIL' };
    return { ok: r.worst !== 'fail', data: r, summary: r.worst, text: r.checks.map(c => `${mark[c.level]} ${pad(c.what, 30)} ${c.detail}`).join('\n') + '\n=> ' + r.worst };
  },

  sql: async (ctx, a) => {
    const q = a.sql || a._.slice(1).join(' ');
    if (!/^\s*(select|with|pragma\s+table_info)\b/i.test(q) || /;\s*\S/.test(q)) throw new Error('csak egy SELECT / WITH lekerdezes');
    const ro = open(dbFile(), { readOnly: true });
    try { const rows = ro.all(q); return { ok: true, data: rows, text: rows.slice(0, 200).map(r => Object.values(r).join(' | ')).join('\n') + (rows.length > 200 ? `\n... ${rows.length} sor` : '') }; }
    finally { ro.close(); }
  },
};

// doctor --live: one real request per runnable source, so an unverified parser is checked on the first online run
async function live(ctx) {
  const p = P.find(ctx.db, 'budapest') || P.list(ctx.db)[0];
  for (const s of ctx.cfg.sources) {
    if (!S.gate(s, ctx.settings).ok) continue;
    const r = await FETCH.run(ctx, { ids: [s.id], place: s.kind === 'climate' || S.adapter(s).scope !== 'global' ? p.id : null, force: true });
    for (const x of r) ctx.db.run("INSERT INTO run (kind, name, started, finished, status, summary) VALUES ('live', ?, ?, ?, ?, ?)", s.id, iso(now()), iso(now()),
      x.status, `${x.rows || 0} sor${x.found ? ', oszlopok: ' + x.found.join(',') : ''}${x.error ? ', ' + x.error : ''}`);
  }
}

async function dispatch(ctx, argv) {
  const a = parseArgs(argv);
  const cmd = a._[0] || 'help';
  const fn = CMDS[cmd];
  if (!fn) throw new Error('ismeretlen parancs: ' + cmd + ' (help)');
  if (a.replay) ctx = { ...ctx, replay: require('path').resolve(a.replay) };
  return fn(ctx, a);
}

module.exports = { context, dispatch, CMDS, HELP };
