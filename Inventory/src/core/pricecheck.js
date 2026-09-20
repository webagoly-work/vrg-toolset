// Price check: compare what the vendor's site says today with what we last
// recorded, and turn the difference into events.
//
// Two rules shape this module:
//
//   1. A check never touches the price we negotiated. `netto_egysegar_huf`
//      comes from an order document; only `aktualis_brutto_ar_huf` (the shelf
//      price), `keszlet_db` and `ar_ellenorizve` are refreshed.
//   2. A reading that did not change is still a reading. It updates
//      `ar_ellenorizve` so you can tell "checked, unchanged" from "never
//      checked" — but it produces no log entry, because nothing happened.

const CHECK_SCHEMA = 'vrg-price-check';

const round2 = n => Math.round(n * 100) / 100;
const today = d => (d ? new Date(d) : new Date()).toISOString().slice(0, 10);

/**
 * Validate an incoming check file. Anything unrecognised is dropped rather
 * than trusted — this file comes from a helper script or a colleague.
 */
function parseCheck(input, opts) {
  const o = opts || {};
  if (!input || typeof input !== 'object') throw new Error('A fájl nem érvényes JSON objektum.');
  if (input.schema !== CHECK_SCHEMA) {
    throw new Error(`Nem árellenőrzés-fájl (schema: ${JSON.stringify(input.schema)}).`);
  }
  const vendor = String(input.vendor || '');
  if (!vendor) throw new Error('A fájl nem mondja meg, melyik beszállítóról szól.');
  if (o.knownVendor && !o.knownVendor(vendor)) {
    throw new Error(`Ismeretlen beszállító a fájlban: ${vendor}`);
  }

  const warnings = [];
  const rows = Array.isArray(input.tetelek) ? input.tetelek : [];
  const seen = new Set();
  const clean = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const id = String(r.vrg_id || '');
    if (!/^VRG-\d{4,}$/.test(id)) { warnings.push('Érvénytelen azonosító, kihagyva: ' + JSON.stringify(r.vrg_id)); continue; }
    if (o.knownId && !o.knownId(id)) { warnings.push(`${id}: nincs ilyen tétel a katalógusban.`); continue; }
    if (seen.has(id)) { warnings.push(`${id}: többször szerepel, az elsőt használom.`); continue; }
    seen.add(id);

    const price = r.brutto_ar_huf == null ? null : Number(r.brutto_ar_huf);
    const stock = r.keszlet == null ? null : Number(r.keszlet);
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      warnings.push(`${id}: érvénytelen ár, kihagyva.`);
      continue;
    }
    clean.push({
      vrg_id: id,
      brutto_ar_huf: price,
      keszlet: Number.isFinite(stock) && stock >= 0 ? stock : null,
      url: typeof r.url === 'string' ? r.url : ''
    });
  }
  return {
    vendor,
    datum: typeof input.datum === 'string' ? input.datum : today(),
    tetelek: clean,
    warnings
  };
}

/**
 * Work out what a check would do, without doing it. The UI shows this for
 * review before anything is written — a price update you cannot inspect first
 * is one you will accept wrongly once and not notice.
 */
function planCheck(check, store) {
  const vendor = check.vendor;
  const valtozasok = [];
  const valtozatlan = [];
  const ujak = [];
  const kihagyva = [];

  for (const row of check.tetelek) {
    const item = store.get(row.vrg_id);
    if (!item || !item.vendors || !item.vendors[vendor]) {
      kihagyva.push({ vrg_id: row.vrg_id, ok: 'ez a beszállító nem viszi a tételt' });
      continue;
    }
    if (row.brutto_ar_huf == null) {
      kihagyva.push({ vrg_id: row.vrg_id, ok: 'a fájl nem tartalmaz árat' });
      continue;
    }
    const regi = item.vendors[vendor].aktualis_brutto_ar_huf;
    const entry = {
      vrg_id: row.vrg_id,
      megnevezes: item.megnevezes,
      regi_brutto: regi == null ? null : Number(regi),
      uj_brutto: row.brutto_ar_huf,
      keszlet: row.keszlet,
      url: row.url || (item.vendors[vendor].termek_link || '')
    };
    if (regi == null) { ujak.push(entry); continue; }
    if (Number(regi) === row.brutto_ar_huf) { valtozatlan.push(entry); continue; }
    const diff = row.brutto_ar_huf - Number(regi);
    entry.valtozas_huf = round2(diff);
    entry.valtozas_szazalek = Math.round((diff / Number(regi)) * 1000) / 10;
    valtozasok.push(entry);
  }

  valtozasok.sort((a, b) => Math.abs(b.valtozas_szazalek) - Math.abs(a.valtozas_szazalek));
  return {
    vendor, datum: check.datum,
    valtozasok, valtozatlan, ujak, kihagyva,
    osszesen: check.tetelek.length,
    emelkedes: valtozasok.filter(v => v.valtozas_huf > 0).length,
    csokkenes: valtozasok.filter(v => v.valtozas_huf < 0).length
  };
}

/**
 * Apply a plan: write the overlay, append one log entry per real change.
 * Returns what was written so the caller can report it honestly.
 */
function applyPlan(plan, userdata) {
  const stamp = new Date().toISOString();
  const entries = [];

  userdata.mutate(d => {
    const bucket = d.vendorData[plan.vendor] || (d.vendorData[plan.vendor] = {});
    const write = e => {
      const rec = bucket[e.vrg_id] || (bucket[e.vrg_id] = {});
      rec.aktualis_brutto_ar_huf = e.uj_brutto;
      if (e.keszlet != null) rec.keszlet_db = e.keszlet;
      if (e.url) rec.termek_link = e.url;
      rec.ar_ellenorizve = stamp;
    };
    // a change and a first reading both write; only a change is an event
    for (const e of plan.valtozasok) {
      write(e);
      entries.push({
        datum: stamp,
        vrg_id: e.vrg_id,
        vendor: plan.vendor,
        regi_brutto: e.regi_brutto,
        uj_brutto: e.uj_brutto,
        valtozas_huf: e.valtozas_huf,
        valtozas_szazalek: e.valtozas_szazalek,
        forras_url: e.url || ''
      });
    }
    for (const e of plan.ujak) write(e);
    // unchanged readings still refresh the timestamp: "checked today, same price"
    for (const e of plan.valtozatlan) write(e);
    d.financeLog = d.financeLog.concat(entries);
  });

  return { irt: plan.valtozasok.length + plan.ujak.length + plan.valtozatlan.length, naplo: entries.length, stamp };
}

/**
 * The save-prompt rule: after an update, ask to save — unless a save has
 * already been logged today. Running the check twice in one day prompts once.
 */
function needsSavePrompt(userdata, when) {
  const day = today(when);
  const log = userdata.doc.saveLog || [];
  return !log.some(e => String(e.datum).slice(0, 10) === day);
}

function recordSave(userdata, info, when) {
  const day = today(when);
  userdata.mutate(d => {
    d.saveLog = (d.saveLog || []).concat([{
      datum: day,
      valtozasok: (info && info.valtozasok) || 0,
      tetelek: (info && info.tetelek) || 0
    }]);
  });
  return day;
}

/** Totals over the finance log — how much has our basket drifted. */
function logSummary(userdata, store) {
  const log = userdata.doc.financeLog || [];
  const byDay = new Map();
  let up = 0, down = 0, sumPct = 0;
  for (const e of log) {
    const d = String(e.datum).slice(0, 10);
    byDay.set(d, (byDay.get(d) || 0) + 1);
    if (e.valtozas_huf > 0) up++; else if (e.valtozas_huf < 0) down++;
    if (Number.isFinite(e.valtozas_szazalek)) sumPct += e.valtozas_szazalek;
  }
  const items = new Set(log.map(e => e.vrg_id));
  return {
    bejegyzesek: log.length,
    erintett_tetelek: items.size,
    emelkedes: up,
    csokkenes: down,
    atlagos_valtozas_szazalek: log.length ? Math.round((sumPct / log.length) * 10) / 10 : 0,
    napok: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])),
    utolso: log.length ? String(log[log.length - 1].datum).slice(0, 10) : null
  };
}

/** The history of one item, newest first. */
function itemHistory(userdata, vrgId) {
  return (userdata.doc.financeLog || [])
    .filter(e => e.vrg_id === vrgId)
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
}

export {
  CHECK_SCHEMA, parseCheck, planCheck, applyPlan,
  needsSavePrompt, recordSave, logSummary, itemHistory
};
