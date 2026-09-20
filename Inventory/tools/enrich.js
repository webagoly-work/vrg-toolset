const fs = require('fs');
const { CACHE, PDFITEMS } = require('./paths.js');
const master = JSON.parse(fs.readFileSync(CACHE + '/master.json', 'utf8'));
const emails = JSON.parse(fs.readFileSync(CACHE + '/emails.json', 'utf8'));
const pdfs = JSON.parse(fs.readFileSync(PDFITEMS, 'utf8'));

const VAT = 1.27;

// ---------------------------------------------------------------- brands
// name token -> canonical brand. Checked against the product name first.
const BRAND_TOKENS = [
  ['OBO Bettermann', /\bOBO\b/i], ['Legrand', /\bLEGRAND\b/i], ['Schneider Electric', /\bSCHNEIDER\b/i],
  ['Gewiss', /\bGEWISS\b/i], ['WAGO', /\bWAGO\b/i], ['Kopos', /\bKOPOS\b/i], ['Stilo', /\bSTILO\b/i],
  ['Hensel', /\bHENSEL\b/i], ['Hager', /\bHAGER\b/i], ['KIWA', /\bKIWA\b/i], ['deLux', /\bDE\s?LUX\b/i],
  ['B.E.G.', /\bB\.?E\.?G\b/i], ['Portwest', /\bPORTWEST\b/i], ['Haupa', /\bHAUPA\b/i],
  ['Pollmann', /\bPOLLMANN\b/i], ['Weidmüller', /\bWEIDM/i], ['Tracon', /\bTRACON\b/i],
  ['Univolt', /\bUNIVOLT\b/i], ['Budvill', /\bBUDVILL\b/i], ['Dunszt', /\bDUNSZT\b/i],
  ['F-Tronic', /\bF-?TRONIC\b/i], ['Eaton', /\bEATON\b/i], ['Elko EP', /\bELKO\s?EP\b/i],
  ['ABB', /\bABB\b/i], ['DEHN', /\bDEHN\b/i], ['Kanlux', /\bKANLUX\b/i], ['Orno', /\bORNO\b/i],
  ['SEZ', /\bSEZ\b/i], ['Belden', /\bBELDEN\b/i], ['Bitner', /\bBITNER\b/i], ['Inset', /\bINSET\b/i],
  ['KOPP', /\bKOPP\b/i], ['J.P.', /\bJ\.\s?P\.\s?\d/i]
];
// fallback: Daniella code prefix -> [brand, prefix length to strip]
const PREFIX = [
  ['ABB', 'ABB'], ['BEG', 'B.E.G.'], ['BELDE', 'Belden'], ['BUDT', 'Budvill'], ['BUD', 'Budvill'],
  ['DEHN', 'DEHN'], ['DEL', 'deLux'], ['DUND', 'Dunszt'], ['DUW', 'F-Tronic'], ['EAT', 'Eaton'],
  ['EKP', 'Elko EP'], ['GEW', 'Gewiss'], ['HAU', 'Haupa'], ['HEN', 'Hensel'], ['HGR', 'Hager'],
  ['HUTOR', 'Orno'], ['JPR', 'J.P.'], ['KANND', 'Kanlux'], ['KAN', 'Kanlux'], ['KIWA', 'KIWA'],
  ['KOPP', 'KOPP'], ['KOP', 'Kopos'], ['LEG', 'Legrand'], ['NYUG', 'Inset'], ['OBO', 'OBO Bettermann'],
  ['POL', 'Pollmann'], ['POR', 'Portwest'], ['SCH', 'Schneider Electric'], ['SEZ', 'SEZ'],
  ['STI', 'Stilo'], ['TRA', 'Tracon'], ['UNI', 'Univolt'], ['WAGO', 'WAGO'], ['WEI', 'Weidmüller']
];
// prefixes that are Daniella's own generic groupings, not a brand
const GENERIC_PREFIX = ['KAB', 'VEZ', 'GIP', 'NVT', 'SOM', 'ELT'];

const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

function brandOf(it) {
  for (const [b, re] of BRAND_TOKENS) for (const n of it.name_variants) if (re.test(n)) return b;
  const c = it.daniella_cikkszam;
  if (GENERIC_PREFIX.some(p => c.startsWith(p))) return '';
  for (const [p, b] of PREFIX) if (c.startsWith(p)) return b;
  return '';
}

// manufacturer part no: strip the Daniella brand prefix, keep it only when the
// remainder is actually present (normalised) in one of the product names.
function mpnOf(it) {
  const c = it.daniella_cikkszam;
  const cands = new Set();
  for (const [p] of PREFIX) if (c.startsWith(p) && c.length > p.length) cands.add(c.slice(p.length));
  cands.add(c);
  const names = it.name_variants.map(norm);
  let best = '';
  for (const cand of cands) {
    const n = norm(cand);
    if (n.length < 3) continue;
    if (!names.some(x => x.includes(n))) continue;
    // shortest confirmed candidate wins: that is the code without Daniella's brand prefix
    if (!best || n.length < norm(best).length) best = cand;
  }
  return best;
}

// ---------------------------------------------------------------- categories
const CAT = [
  // --- narrow rules first, broad ones last ---
  ['Szellőzés', 'Ventilátorok és rácsok', /ventilátor|szellőzőrács/i],
  ['Világítás', 'Reflektorok és lámpatestek', /reflektor|lámpatest/i],
  ['Érzékelők és automatika', 'Mozgás- és jelenlétérzékelők', /jelenlét ?érzékelő|mozgásérzékel/i],
  ['Kismegszakítók és védelmek', 'Moduláris készülékek', /moduláris csengő/i],
  ['Érzékelők és automatika', 'Okos eszközök és csengők', /okos dugalj|wi-?fi|vezeték nélküli csengő/i],
  ['Kapcsolók és csatlakozók', 'Fényerőszabályzók (dimmerek)', /fényerőszabályz|dimmer|SMR-M/i],
  ['Villámvédelem és földelés', 'Túlfeszültség-védelem', /túlfeszültség|villámáram-levezető/i],
  ['Villámvédelem és földelés', 'Földelők és földelő tartozékok', /rúdföldelő|ütőcsúcs|földelőbilincs|csatlakozóbilincs kör|korrózióvédő|multi ?kapocs|vario összekötő|köracél|csatlakozó-kapocs/i],
  ['Kismegszakítók és védelmek', 'Kismegszakítók', /kismegszakító/i],
  ['Kismegszakítók és védelmek', 'Áram-védőkapcsolók (FI)', /áram-?védőkapcsoló|FI relé/i],
  ['Kismegszakítók és védelmek', 'Sínek és szerelési tartozékok', /fésűs sín|N\/PE sín|sín tartó|TS-?sín|takarólap|védővezető csatlakozó|nullvezető csatlakozó/i],
  ['Elosztók és szekrények', 'Kiselosztók', /kiselosztó|elosztószekrény/i],
  ['Kötéstechnika', 'Fővezetéki sorkapcsok', /fővezeték sorkapocs/i],
  ['Kötéstechnika', 'Vezetékösszekötők', /vezeték ?összekötő|vez\.összekötő/i],
  ['Kötéstechnika', 'Érvéghüvelyek és saruk', /érvéghüvely|érv\.h\.|saru/i],
  ['Szerelvény- és kötődobozok', 'Gipszkarton dobozok', /gipszkarton doboz/i],
  ['Szerelvény- és kötődobozok', 'Süllyesztett kötődobozok és fedelek', /kötődoboz süll|sülly\. ?\d|süllyesztett.*doboz|doboz.*süllyesztett/i],
  ['Installáció technika', 'Csőidomok, bilincsek, tömszelencék', /csőadapter|karmantyú|könyök|toldó|csőbilincs|tömszelence|befogató/i],
  ['Szerelvény- és kötődobozok', 'Falon kívüli kötődobozok', /kötődoboz|leágazódoboz|s-?box/i],
  ['Szerelvény- és kötődobozok', 'Szerelvénydobozok és fedelek', /műa\.? doboz|műanyag doboz|doboz fedő|doboz fedél|müdn|müdk|kiemelődoboz/i],
  ['Installáció technika', 'Gégecsövek és védőcsövek', /gégecső|védőcső|mü\.ii\.? cső|műa\.cső|symalen|pep 25/i],
  ['Installáció technika', 'Kábelcsatornák és parapetcsatornák', /csatorna|mcsn|mik \d/i],
  ['Installáció technika', 'Csőidomok, bilincsek, tömszelencék', /bilincs/i],
  ['Vezetékek és kábelek', 'Erőátviteli kábelek', /NYY-J|EAYY|NAYY|erőátviteli|földkábel/i],
  ['Vezetékek és kábelek', 'Installációs vezetékek', /NYM-J|MB-?Cu/i],
  ['Vezetékek és kábelek', 'Sodrott és tömör erezetű vezetékek', /H07V-K|H07V-U|mkh|m-kh/i],
  ['Vezetékek és kábelek', 'Gumikábelek és hosszabbító vezetékek', /H05RR-F|H05VV-F|gumikábel|\(GT\)/i],
  ['Gyengeáram és adathálózat', 'Csatlakozók és aljzatok', /moduláris dugó|törésgátló|RJ45|F-csatlakozó|TV aljzat/i],
  ['Gyengeáram és adathálózat', 'Adatkábelek', /CAT ?5|CAT ?6|számítógép vezeték|UTP|FTP/i],
  ['Kapcsolók és csatlakozók', 'Dugvillák és csatlakozók', /dugvilla/i],
  ['Kapcsolók és csatlakozók', 'Falon kívüli szerelvények', /falon ?kívüli|falonkívüli|forix|plexo|felületre szerelhető|\bfk\./i],
  ['Kapcsolók és csatlakozók', 'Süllyesztett csatlakozóaljzatok', /csatlakozóaljzat|dugalj|aljzat|2P\+F/i],
  ['Kapcsolók és csatlakozók', 'Süllyesztett kapcsolók', /kapcsoló|csillárkapcsoló|\b10[1-9]\b/i],
  ['Kapcsolók és csatlakozók', 'Keretek', /keret/i],
  ['Világítás', 'Reflektorok és lámpatestek', /reflektor|lámpatest/i],
  ['Világítás', 'Fényforrások', /ha\. ceruza|fénycső|izzó|\bR7s\b/i],
  ['Munkavédelem és segédanyagok', 'Munkavédelem', /védőkesztyű/i],
  ['Munkavédelem és segédanyagok', 'Szerelési segédanyagok', /szig\.?szalag|szigetelőszalag|gipsz|sittes zsák/i]
];
function catOf(name) {
  for (const [f, s, re] of CAT) if (re.test(name)) return { fo: f, al: s };
  return { fo: '', al: '' };
}

// ------------------------------------------------- order-level aggregation
// One orderNo may appear in several e-mails (confirmation + modifications).
// Keep only the newest e-mail per orderNo for quantity totals.
const newest = new Map();
for (const e of emails) {
  if (!e.orderNo) continue;
  const t = Date.parse(e.mailDate) || 0;
  if (!newest.has(e.orderNo) || newest.get(e.orderNo).t < t) newest.set(e.orderNo, { t, e });
}
const qty = new Map(), first = new Map(), last = new Map(), ordCount = new Map();
for (const { e } of newest.values()) {
  for (const i of e.items) {
    const q = parseFloat(String(i.mennyiseg).replace(/\s/g, '').replace(',', '.')) || 0;
    qty.set(i.cikkszam, (qty.get(i.cikkszam) || 0) + q);
    ordCount.set(i.cikkszam, (ordCount.get(i.cikkszam) || 0) + 1);
    const d = e.kelt || '';
    if (d) {
      if (!first.has(i.cikkszam) || d < first.get(i.cikkszam)) first.set(i.cikkszam, d);
      if (!last.has(i.cikkszam) || d > last.get(i.cikkszam)) last.set(i.cikkszam, d);
    }
  }
}

// ------------------------------------------------------------------ build
const rows = master.map(it => {
  const name = it.best_name;
  const c = catOf(name);
  const pack = it.packs[0] || '';
  let unit = it.units[0] || '';
  if (!unit && pack) unit = (pack.match(/([a-zá-ű]+)$/i) || [])[1] || '';
  const packQty = pack ? parseFloat(pack) || '' : '';
  const net = it.last_netto_egysegar;
  const priceDate = it.price_history.length ? it.price_history[it.price_history.length - 1].date : '';
  return {
    id: it.daniella_cikkszam,
    megnevezes: name,
    marka_gyarto: brandOf(it),
    gyartoi_cikkszam: mpnOf(it),
    kategoria_fo: '',                       // Daniella hivatalos - még ismeretlen
    kategoria_al: '',
    kategoria_ut: '',
    kategoria_javaslat_fo: c.fo,            // AI-javaslat, ideiglenes
    kategoria_javaslat_al: c.al,
    tomeg_kg: '',
    egyseg: unit,
    becsult_netto_ar_huf: net != null ? Math.round(net * 100) / 100 : '',
    becsult_brutto_ar_huf: net != null ? Math.round(net * VAT) : '',
    ar_megfigyeles_datum: priceDate,
    gyartoi_termek_link: '',
    tomeg_forras: '',
    megjegyzes: '',
    kedvenc: '',
    // --- vendor block: DANIELLA ---
    daniella_cikkszam: it.daniella_cikkszam,
    daniella_netto_egysegar_huf: net != null ? Math.round(net * 100) / 100 : '',
    daniella_brutto_egysegar_huf: net != null ? Math.round(net * VAT) : '',
    daniella_listaar_netto_huf: it.listaar_netto != null ? it.listaar_netto : '',
    daniella_engedmeny_szazalek: it.engedmeny_szazalek || '',
    daniella_kiszereles: pack,
    daniella_kiszereles_mennyiseg: packQty,
    daniella_aktualis_brutto_ar_huf: '',    // weboldalról, még nincs
    daniella_keszlet_db: '',                // weboldalról, még nincs
    daniella_termek_link: '',               // weboldalról, még nincs
    daniella_ar_ellenorizve: '',
    // --- provenance ---
    rendelesek_szama: ordCount.get(it.daniella_cikkszam) || 0,
    osszes_rendelt_mennyiseg: Math.round((qty.get(it.daniella_cikkszam) || 0) * 100) / 100,
    elso_rendeles: first.get(it.daniella_cikkszam) || '',
    utolso_rendeles: last.get(it.daniella_cikkszam) || '',
    forras: it.sources.join(' + '),
    nev_valtozatok: it.name_variants,
    ar_elozmeny: it.price_history
  };
});

fs.writeFileSync(CACHE + '/rows.json', JSON.stringify(rows, null, 1));
const noBrand = rows.filter(r => !r.marka_gyarto).map(r => r.id);
const noMpn = rows.filter(r => !r.gyartoi_cikkszam).map(r => r.id);
const noCat = rows.filter(r => !r.kategoria_javaslat_fo).map(r => r.id + ' :: ' + r.megnevezes);
console.log('rows', rows.length);
console.log('no brand (' + noBrand.length + '):', noBrand.join(', '));
console.log('no mpn (' + noMpn.length + '):', noMpn.join(', '));
console.log('no category (' + noCat.length + '):\n  ' + noCat.join('\n  '));
