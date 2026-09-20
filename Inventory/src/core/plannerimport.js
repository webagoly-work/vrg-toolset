// Read a Planner project export (.vplan.json) and turn it into requirements.
//
// The Planner draws devices and cable runs; it does not know product numbers.
// So what arrives here is "36 sockets, 15 switches, 1.9 m of conduit" — counts
// per *kind of thing*, which the catalogue then answers with actual items.
//
// Two rules keep this honest:
//   * A device type this file does not recognise is REPORTED, never dropped.
//     A plan that quietly loses a third of its sockets is worse than one that
//     refuses to import.
//   * Nothing is invented. A socket needs a frame and a box in real life, but
//     the plan does not say so, so the import does not claim it does.

const PLAN_FORMAT = 'varler-planner';

/** Planner device type -> the catalogue categories that can answer it. */
const DEVICE_RULES = [
  { kulcs: 'socket', cimke: 'Csatlakozóaljzat', egyseg: 'db', kategoriak: ['Csatlakozóaljzatok'] },
  { kulcs: 'switch', cimke: 'Kapcsoló', egyseg: 'db', kategoriak: ['Kapcsolók', 'Dimmerek'] },
  { kulcs: 'light', cimke: 'Lámpatest', egyseg: 'db', kategoriak: ['Reflektorok és lámpatestek', 'Fényforrások'] },
  // These two must not share a category. If they do, one box on the list ticks
  // off both requirements and the progress reads as twice the material it is.
  { kulcs: 'junction', cimke: 'Kötődoboz', egyseg: 'db', kategoriak: ['Falon kívüli dobozok és fedelek'] },
  { kulcs: 'box', cimke: 'Szerelvénydoboz', egyseg: 'db', kategoriak: ['Süllyesztett kötődobozok és fedelek'] }
];

/** Planner path build type -> categories, for the metres of run. */
const BUILD_RULES = [
  { kulcs: 'sull_gege', cimke: 'Gégecső (süllyesztett)', egyseg: 'fm', kategoriak: ['Gégecsövek'] },
  { kulcs: 'fk_gege', cimke: 'Gégecső (falon kívüli)', egyseg: 'fm', kategoriak: ['Gégecsövek'] },
  { kulcs: 'sull_mu2', cimke: 'Műanyag védőcső', egyseg: 'fm', kategoriak: ['Műanyag védőcsövek'] },
  { kulcs: 'csatorna', cimke: 'Kábelcsatorna', egyseg: 'fm', kategoriak: ['Műanyag kábelcsatornák'] },
  {
    kulcs: 'kv_custom', cimke: 'Vezetékezés', egyseg: 'fm',
    kategoriak: [
      'Erősáramú vezetékek, kábelek < 1 kV rögzített elhelyezés',
      'Erősáramú vezetékek, kábelek < 1 kV flexibilis elhelyezés'
    ]
  }
];

const ruleFor = (rules, key) => rules.find(r => r.kulcs === key) || null;
const round2 = n => Math.round(n * 100) / 100;

/** 3-D length of a path section, in millimetres. */
function segLength(a, b) {
  const dx = (b.x || 0) - (a.x || 0);
  const dy = (b.y || 0) - (a.y || 0);
  const dh = (b.h || 0) - (a.h || 0);
  return Math.sqrt(dx * dx + dy * dy + dh * dh);
}

/**
 * Just enough geometry to draw a rough plan: room outlines, door/window marks
 * and device positions, in millimetres. No walls, no 3-D, no styling — this is
 * an orientation aid, not a copy of the Planner's canvas.
 */
function extractDrawing(data) {
  const floors = Array.isArray(data.floors) ? data.floors : [];
  const devices = Array.isArray(data.devices) ? data.devices : [];
  const openings = Array.isArray(data.openings) ? data.openings : [];

  const szintek = [...new Set([
    ...floors.map(f => f && f.level), ...devices.map(d => d && d.level)
  ].filter(Boolean))];

  const helyisegek = floors
    .filter(f => f && Array.isArray(f.poly) && f.poly.length >= 3)
    .map(f => ({
      szint: String(f.level || ''),
      pontok: f.poly.filter(p => Array.isArray(p) && p.length >= 2).map(p => [Number(p[0]) || 0, Number(p[1]) || 0])
    }));

  const eszkozok = devices
    .filter(d => d && Number.isFinite(Number(d.x)) && Number.isFinite(Number(d.y)))
    .map(d => ({
      szint: String(d.level || ''),
      tipus: String(d.type || ''),
      x: Number(d.x), y: Number(d.y),
      ref: String(d.ref || '')
    }));

  const nyilasok = openings
    .filter(o => o && Number.isFinite(Number(o.x)) && Number.isFinite(Number(o.y)))
    .map(o => ({ szint: String(o.level || ''), tipus: String(o.type || ''), x: Number(o.x), y: Number(o.y) }));

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const see = (x, y) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  for (const h of helyisegek) for (const p of h.pontok) see(p[0], p[1]);
  for (const e of eszkozok) see(e.x, e.y);
  const hasGeometry = Number.isFinite(minX) && Number.isFinite(minY);

  return {
    szintek,
    helyisegek,
    eszkozok,
    nyilasok,
    hatar: hasGeometry ? { minX, maxX, minY, maxY } : null
  };
}

/**
 * parsePlan(json) -> { nev, mentve, projekt, rajz, igenyek, ismeretlen, osszegzes }
 * Throws only when the file is not a Planner export at all.
 */
function parsePlan(input) {
  if (!input || typeof input !== 'object') throw new Error('A fájl nem érvényes JSON objektum.');
  if (input.format !== PLAN_FORMAT) {
    throw new Error(`Nem Planner mentés (format: ${JSON.stringify(input.format)}).`);
  }
  const project = input.project || {};
  const data = project.data || {};
  const bp = (project.state && project.state.bp) || {};

  const warnings = [];
  const ismeretlen = [];

  // ------------------------------------------------------------ devices
  const devices = Array.isArray(data.devices) ? data.devices : [];
  const byType = new Map();
  for (const d of devices) {
    const t = String((d && d.type) || '').trim() || '(nincs típus)';
    byType.set(t, (byType.get(t) || 0) + 1);
  }

  const igenyek = [];
  for (const [type, count] of byType) {
    const rule = ruleFor(DEVICE_RULES, type);
    if (!rule) {
      ismeretlen.push({ kulcs: type, darab: count, mibol: 'eszköz' });
      igenyek.push({
        kulcs: 'dev:' + type, cimke: type, egyseg: 'db',
        mennyiseg: count, kategoriak: [], ismeretlen: true
      });
      continue;
    }
    igenyek.push({
      kulcs: 'dev:' + type, cimke: rule.cimke, egyseg: rule.egyseg,
      mennyiseg: count, kategoriak: rule.kategoriak.slice(), ismeretlen: false
    });
  }

  // -------------------------------------------------------------- paths
  const paths = Array.isArray(data.paths) ? data.paths : [];
  const byBuild = new Map();
  for (const p of paths) {
    const nodes = Array.isArray(p && p.nodes) ? p.nodes : [];
    const sections = Array.isArray(p && p.sections) ? p.sections : [];
    for (let i = 0; i < sections.length; i++) {
      const a = nodes[i], b = nodes[i + 1];
      if (!a || !b) continue;
      const build = String((sections[i] && sections[i].build) || '').trim() || '(nincs kivitel)';
      byBuild.set(build, (byBuild.get(build) || 0) + segLength(a, b));
    }
  }
  for (const [build, mm] of byBuild) {
    const metres = round2(mm / 1000);
    if (metres <= 0) continue;
    const rule = ruleFor(BUILD_RULES, build);
    if (!rule) {
      ismeretlen.push({ kulcs: build, darab: metres, mibol: 'nyomvonal' });
      igenyek.push({
        kulcs: 'path:' + build, cimke: build, egyseg: 'fm',
        mennyiseg: metres, kategoriak: [], ismeretlen: true
      });
      continue;
    }
    igenyek.push({
      kulcs: 'path:' + build, cimke: rule.cimke, egyseg: rule.egyseg,
      mennyiseg: metres, kategoriak: rule.kategoriak.slice(), ismeretlen: false
    });
  }

  // Two kinds that are answered by the SAME categories are one shopping
  // requirement: flush conduit and surface conduit are both conduit, and
  // leaving them separate would let one purchase tick off both — progress
  // would then read as twice the material actually on the list.
  const merged = [];
  const bySignature = new Map();
  for (const ig of igenyek) {
    if (ig.ismeretlen || !ig.kategoriak.length) { merged.push(ig); continue; }
    const sig = ig.kategoriak.slice().sort().join('');
    const prev = bySignature.get(sig);
    if (!prev) {
      bySignature.set(sig, ig);
      merged.push(ig);
      continue;
    }
    prev.mennyiseg = round2(prev.mennyiseg + ig.mennyiseg);
    prev.kulcs += '+' + ig.kulcs;
    if (!prev.cimke.includes(ig.cimke)) prev.cimke += ' + ' + ig.cimke;
  }
  igenyek.length = 0;
  igenyek.push(...merged);
  igenyek.sort((a, b) => b.mennyiseg - a.mennyiseg);

  if (ismeretlen.length) {
    warnings.push(`${ismeretlen.length} ismeretlen fajta a tervben — ezek igényként megjelennek, ` +
      'de kategória nélkül, mert nem tudom, mivel kellene kielégíteni őket.');
  }
  if (!igenyek.length) warnings.push('A terv nem tartalmaz eszközt vagy nyomvonalat.');

  return {
    forras: PLAN_FORMAT,
    nev: String(input.name || 'Névtelen terv'),
    mentve: String(input.saved || ''),
    rajz: extractDrawing(data),
    projekt: {
      megnevezes: String(bp.proj || ''),
      cim: String(bp.addr || ''),
      keszitette: String(bp.by || '')
    },
    igenyek, ismeretlen, warnings,
    osszegzes: {
      eszkoz: devices.length,
      nyomvonal_fm: round2([...byBuild.values()].reduce((a, v) => a + v, 0) / 1000),
      helyiseg: Array.isArray(data.floors) ? data.floors.length : 0,
      jegyzet: Array.isArray(data.notes) ? data.notes.length : 0
    }
  };
}

/** Does this catalogue item answer that requirement? */
function itemAnswers(item, igeny) {
  if (!igeny.kategoriak || !igeny.kategoriak.length) return false;
  const al = (item.kategoria && item.kategoria.al) ||
    (item.kategoria_javaslat && item.kategoria_javaslat.al) || '';
  return igeny.kategoriak.includes(al);
}

/**
 * How far the list has got against the plan. `van` counts only quantities of
 * items whose category answers the requirement, so putting a cable on the list
 * does not tick off a socket.
 */
function progress(terv, rows) {
  const out = (terv.igenyek || []).map(igeny => {
    let van = 0;
    const tetelek = [];
    for (const r of rows) {
      if (!r.item || !itemAnswers(r.item, igeny)) continue;
      van += r.mennyiseg;
      tetelek.push({ vrg_id: r.vrg_id, megnevezes: r.item.megnevezes, mennyiseg: r.mennyiseg });
    }
    van = round2(van);
    return Object.assign({}, igeny, {
      van,
      hianyzik: round2(Math.max(0, igeny.mennyiseg - van)),
      tobblet: round2(Math.max(0, van - igeny.mennyiseg)),
      kesz: van >= igeny.mennyiseg,
      tetelek
    });
  });
  const teljesitheto = out.filter(i => !i.ismeretlen);
  return {
    sorok: out,
    kesz: teljesitheto.filter(i => i.kesz).length,
    osszes: teljesitheto.length,
    ismeretlen: out.filter(i => i.ismeretlen).length,
    hianyzo_fajta: teljesitheto.filter(i => !i.kesz).length
  };
}

/**
 * Pick what to autofill each open requirement with: a favourite in that
 * category, else the item ordered most often. Returns a plan, never applies it
 * — the same review-before-write rule as the price check.
 */
function autofillPlan(prog, store) {
  const javaslatok = [];
  const nincs = [];
  for (const igeny of prog.sorok) {
    if (igeny.kesz || igeny.ismeretlen) continue;
    const jeloltek = store.items.filter(it => itemAnswers(it, igeny));
    if (!jeloltek.length) { nincs.push({ igeny, ok: 'nincs ilyen kategóriájú tétel a katalógusban' }); continue; }

    const kedvencek = jeloltek.filter(it => it.user && it.user.kedvenc);
    const pool = kedvencek.length ? kedvencek : jeloltek;
    pool.sort((a, b) =>
      (b.felhasznalas.rendelesek_szama - a.felhasznalas.rendelesek_szama) ||
      a.megnevezes.localeCompare(b.megnevezes, 'hu'));
    javaslatok.push({
      igeny,
      item: pool[0],
      mennyiseg: igeny.hianyzik,
      miert: kedvencek.length ? 'kedvenc' : 'leggyakrabban rendelt',
      valaszthato: pool.length
    });
  }
  return { javaslatok, nincs };
}

export {
  PLAN_FORMAT, DEVICE_RULES, BUILD_RULES, extractDrawing,
  parsePlan, itemAnswers, progress, autofillPlan, segLength
};
