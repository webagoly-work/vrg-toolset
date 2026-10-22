// 00-vocab.js — shared vocabulary of the BRIDGE smart-home catalogue (SMARTHOME-DB-001)
// Keys are English, every text a person reads is Hungarian. build.js checks every reference against these lists.

module.exports = {
  // ---- mounting zones (WORKSHOP-001 + IDEA-003; heights in mm from the finished floor) ----
  zones: {
    floor:     { n: 'Padlószint',        h: [0, 150],     note: 'Csak érzékelő (szivárgás, nehéz gázok) és padlóba épített fény; pálya a padlóban fut.' },
    low:       { n: 'Alacsony sáv',      h: [200, 500],   note: 'Dugalj, adat, USB, lábfény, mozgásvonal (300).' },
    mid:       { n: 'Közép sáv',         h: [800, 1400],  note: 'Kapcsoló 1100, értesítő fény 1150, légzési zóna.' },
    smart:     { n: 'Okos sáv',          h: [1300, 1500], note: 'Kezelőpanel 1450, termosztát 1500 — a Vezérlés rétege.' },
    high:      { n: 'Magas sáv',         h: [1900, 2500], note: 'Portál 2150, Silver Rail ≈ 2450, kamera 2400.' },
    ceiling:   { n: 'Mennyezet',         h: null,         note: 'Érzékelők, lámpák, AP, hangszórók; álmennyezetben fő hordozó.' },
    furniture: { n: 'Bútorba épített',   h: null,         note: 'Pult alatt, polcban, szekrényben, ágykeretben — a bútorasztalos szakág.' },
    outdoor:   { n: 'Kültér',            h: null,         note: 'Terasz, homlokzat, kert — IP65+.' }
  },
  // ---- how a device is powered (the stack families + the off-grid ones) ----
  power: {
    mains: { n: '230 V',                    fam: 'MAINS' },
    lv:    { n: 'Törpefeszültség, A busz (24 V)', fam: 'LV' },
    busb:  { n: 'Biztosított 24 V, B busz',  fam: 'BUSB' },
    poe:   { n: 'PoE (Cat6A)',               fam: 'DATA' },
    bus:   { n: 'Buszról táplált (RS-485 / szenzorkábel)', fam: 'SENSOR' },
    usb:   { n: 'USB / USB-C PD',            fam: 'USB' },
    batt:  { n: 'Elem / akku',               fam: null },
    harvest: { n: 'Energiagyűjtő (kinetikus, napelemes)', fam: null }
  },
  // ---- can several identical nodes work together (fusion, fleet, gradients)? ----
  multinode: {
    yes:  { n: 'Ajánlott', note: 'Több csomópont együtt többet tud (irány, gradiens, háromszögelés, flotta).' },
    ok:   { n: 'Lehetséges', note: 'Nem zavarják egymást, de nem is erősítik.' },
    care: { n: 'Óvatosan', note: 'Kölcsönös zavarás vagy szinkronigény — irányítás, időosztás, csatornakiosztás kell.' },
    no:   { n: 'Nem', note: 'Egymást zavarják, vagy értelmetlen.' }
  },
  // ---- battery fitness: is a battery version sensible? ----
  battery: {
    yes:  { n: 'Elemes is jó', note: 'Ultra alacsony fogyasztás, évekig elemről.' },
    duty: { n: 'Csak ritkított méréssel', note: 'Mérési ciklus ritkítva vagy PIR-ébresztéssel; hónapok.' },
    no:   { n: 'Nem', note: 'Folyamatos fűtés / rádió / nagy áram — vezetékes táplálás kell.' }
  },
  // ---- the stack roles a catalogue item may land on (05m-stack.js STK_ROLES; HMI folded into CONTROL 2026-10-11) ----
  layers: ['hw', 'base', 'sys:MAINS', 'sys:LV', 'sys:BUSB', 'sys:CONTROL', 'sys:DATA', 'sys:KNX', 'sys:SENSOR', 'sys:RF',
           'sys:MEDIA', 'sys:USB', 'sys:SECURITY', 'cluster', 'sys:EXTRA', '-'],
  // ---- generic room types; CLA refs map onto them (CLA-D1 Table A) ----
  roomTypes: ['eloszoba', 'konyha', 'etkezo', 'nappali', 'halo', 'gyerek', 'dolgozo', 'furdo', 'wc', 'kamra', 'gardrob',
              'kozlekedo', 'lepcso', 'mosokonyha', 'gepesz', 'terasz', 'tarolo', 'garazs', 'kert'],
  cla: {
    R01: { type: 'eloszoba', n: 'Előszoba', m2: 2.55 },  R02: { type: 'konyha', n: 'Konyha', m2: 5.05 },
    R03: { type: 'etkezo',   n: 'Étkező (+ átjáró)', m2: 10.16, also: ['kozlekedo'] },
    R04: { type: 'wc',       n: 'WC', m2: 1.36 },          R05: { type: 'kamra', n: 'Kamra (lépcső alatt, felszálló)', m2: 1.36, also: ['lepcso'] },
    R06: { type: 'nappali',  n: 'Nappali (légtér)', m2: 18.43 }, R07: { type: 'halo', n: 'Szoba (háló, gardrób)', m2: 12.16, also: ['gardrob'] },
    R08: { type: 'furdo',    n: 'Fürdő (R07-ből nyílik)', m2: 4.75 },
    R09: { type: 'halo',     n: 'Felső szoba', m2: 10.24 }, R10: { type: 'furdo', n: 'Felső fürdő', m2: 4.07 },
    R11: { type: 'kozlekedo', n: 'Felső közlekedő', m2: 1.94 }, R12: { type: 'terasz', n: 'Terasz', m2: 6.18 },
    R13: { type: 'tarolo',   n: 'Tároló', m2: 3.64 }
  }
};
