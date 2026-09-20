// The floor diagram's render model.
//
// This module is a PURE FUNCTION of (geometry, progress). It holds no state of
// its own, which is what makes the diagram and the list structurally unable to
// disagree: a symbol is green because the requirement it belongs to is
// satisfied, not because something remembered to colour it.
//
// Coordinates stay in millimetres and go straight into the SVG viewBox, so
// there is no scaling arithmetic to get wrong.

const MARGIN = 400;          // mm of breathing room around the plan

/** Device type -> the requirement that owns it, as parsePlan keyed them. */
function requirementFor(tipus, igenyek) {
  const key = 'dev:' + tipus;
  return igenyek.find(i => i.kulcs === key || i.kulcs.split('+').includes(key)) || null;
}

function stateOf(req) {
  if (!req) return 'nincs-igeny';
  if (req.ismeretlen) return 'ismeretlen';
  if (req.kesz) return 'kesz';
  return req.van > 0 ? 'reszben' : 'nincs';
}

const SYMBOLS = {
  socket: { alak: 'kor', cimke: 'Aljzat' },
  switch: { alak: 'negyzet', cimke: 'Kapcsoló' },
  light: { alak: 'csillag', cimke: 'Lámpa' },
  junction: { alak: 'rombusz', cimke: 'Kötődoboz' },
  box: { alak: 'negyzet-ures', cimke: 'Szerelvénydoboz' }
};

const symbolFor = tipus => SYMBOLS[tipus] || { alak: 'kor-ures', cimke: tipus };

/**
 * buildDiagram({ rajz, progress, szint, kiemeltKategoriak })
 *
 * `progress` is the object core/plannerimport.js returns. `kiemeltKategoriak`
 * is the category list of whatever the user currently has selected in the
 * catalogue — the symbols it could answer light up.
 */
function buildDiagram(o) {
  const rajz = (o && o.rajz) || null;
  const prog = (o && o.progress) || { sorok: [] };
  const highlight = (o && o.kiemeltKategoriak) || [];

  if (!rajz || !rajz.hatar) {
    return { ures: true, ok: 'A tervben nincs rajzi geometria.', szintek: [], jelek: [], helyisegek: [], jelmagyarazat: [] };
  }

  const szintek = rajz.szintek.length ? rajz.szintek : [''];
  const szint = (o && o.szint && szintek.includes(o.szint)) ? o.szint : szintek[0];

  const h = rajz.hatar;
  const viewBox = [
    Math.round(h.minX - MARGIN),
    Math.round(h.minY - MARGIN),
    Math.round((h.maxX - h.minX) + MARGIN * 2),
    Math.round((h.maxY - h.minY) + MARGIN * 2)
  ];

  const helyisegek = rajz.helyisegek
    .filter(r => !r.szint || r.szint === szint)
    .map(r => ({ pontok: r.pontok.map(p => p.join(',')).join(' ') }));

  const nyilasok = rajz.nyilasok.filter(n => !n.szint || n.szint === szint);

  const jelek = rajz.eszkozok
    .filter(e => !e.szint || e.szint === szint)
    .map(e => {
      const req = requirementFor(e.tipus, prog.sorok);
      const sym = symbolFor(e.tipus);
      const kiemelt = !!(req && req.kategoriak && highlight.length &&
        req.kategoriak.some(c => highlight.includes(c)));
      return {
        x: Math.round(e.x), y: Math.round(e.y),
        tipus: e.tipus, ref: e.ref,
        alak: sym.alak,
        cimke: sym.cimke,
        igenyKulcs: req ? req.kulcs : null,
        allapot: stateOf(req),
        kiemelt
      };
    });

  // one legend row per device type actually on this level
  const byType = new Map();
  for (const j of jelek) {
    if (!byType.has(j.tipus)) {
      const req = prog.sorok.find(r => r.kulcs === j.igenyKulcs) || null;
      byType.set(j.tipus, {
        tipus: j.tipus, alak: j.alak, cimke: j.cimke, allapot: j.allapot,
        darab: 0,
        kell: req ? req.mennyiseg : 0,
        van: req ? req.van : 0,
        kiemelt: j.kiemelt,
        kategoriak: req ? (req.kategoriak || []) : []
      });
    }
    byType.get(j.tipus).darab += 1;
  }

  return {
    ures: false,
    szint, szintek,
    viewBox: viewBox.join(' '),
    szelesseg_mm: viewBox[2],
    magassag_mm: viewBox[3],
    helyisegek, nyilasok, jelek,
    jelmagyarazat: [...byType.values()].sort((a, b) => b.darab - a.darab),
    osszegzes: {
      jel: jelek.length,
      kesz: jelek.filter(j => j.allapot === 'kesz').length,
      reszben: jelek.filter(j => j.allapot === 'reszben').length,
      nincs: jelek.filter(j => j.allapot === 'nincs').length
    }
  };
}

export { buildDiagram, requirementFor, stateOf, symbolFor, SYMBOLS, MARGIN };
