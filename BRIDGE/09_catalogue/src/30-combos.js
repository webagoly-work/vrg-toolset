// 30-combos.js — multisensors (what is usually built / sold together) and the house-wide FLEET modules
// multisensors: the market's usual bundles, as references.  fleet: BRIDGE's own uniform module types for the free
// slots around a Portal (IDEA-003: nest H0 ≈ 2450 at the hinge-side upper corner, head pockets H1 ≈ 2400, the hinge
// riser ZS-t(h) 100–300 mm from the opening edge, SELV only). One module type is built many times, so the firmware,
// the housing and the spares are one item — that is what makes it a "uniform sensor module type candidate".

const multisensors = [
 { k: 'ms_presence', n: 'Jelenlét-multiszenzor', members: ['mmw24_pres', 'pir', 'lux'], opt: ['temp', 'rh'], rooms: ['*'],
   why: 'A PIR gyors indítást ad, a radar tartja a jelenlétet, a lux dönt a fényről — a leggyakoribb kombináció (pl. Everything Presence One / Lite, Aqara FP-sor).' },
 { k: 'ms_tracking', n: 'Zónakövető multiszenzor', members: ['mmw24_track', 'mmw24_pres', 'lux'], opt: ['pir'], rooms: ['nappali', 'etkezo', 'konyha', 'kozlekedo'],
   why: 'x/y követés zónákkal (kanapé, asztal, sziget) és a mozgásvonal irányával.' },
 { k: 'ms_climate', n: 'Klíma-multiszenzor', members: ['temp', 'rh', 'pressure'], opt: ['lux'], rooms: ['*'],
   why: 'Egy lapka (BME280 / SHT4x + BMP390); elemről évekig.' },
 { k: 'ms_air', n: 'Levegőminőség-multiszenzor', members: ['co2', 'voc_mox', 'pm', 'temp', 'rh'], opt: ['hcho_ec'], rooms: ['nappali', 'halo', 'gyerek', 'dolgozo', 'etkezo', 'konyha'],
   why: 'Egy modulban kapható (pl. Sensirion SEN66: PM, RH/T, VOC, NOx, CO₂ ⚑); a szoba egészségügyi alapcsomagja.' },
 { k: 'ms_safety', n: 'Füst + CO kombi riasztó', members: ['smoke_opt', 'co_ec'], opt: ['heat'], rooms: ['halo', 'gyerek', 'nappali', 'kozlekedo', 'eloszoba'],
   why: 'Egy mennyezeti eszköz két életvédelmi funkcióval; 10 éves elemmel.' },
 { k: 'ms_kitchen_safety', n: 'Konyhai biztonsági csomag', members: ['heat', 'co_ec', 'voc_mox'], opt: ['ch4', 'lpg', 'leak_rope', 'no2_ec'], rooms: ['konyha'],
   why: 'Füst helyett hő; a gázfajta szerint metán (fent) vagy PB (lent).' },
 { k: 'ms_wet', n: 'Vizes helyiség csomag', members: ['rh', 'temp', 'h2s_ec', 'leak_spot'], opt: ['nh3', 'thermopile_array'], rooms: ['furdo', 'wc', 'mosokonyha'],
   why: 'Szellőztetés páraemelkedésre és szagra, szivárgás a padlón.' },
 { k: 'ms_motion6', n: '6-az-1-ben mozgásérzékelő', members: ['pir', 'temp', 'rh', 'lux', 'uv', 'accel'], opt: [], rooms: ['*'],
   why: 'A piac klasszikus elemes multiszenzora (pl. Aeotec MultiSensor-sor); utólagos telepítésre.' },
 { k: 'ms_door', n: 'Nyílászáró-multiszenzor', members: ['reed', 'accel', 'temp'], opt: ['hall'], rooms: ['*'],
   why: 'Nyitás + rezgés (betörés, kopogás) + döntés (bukó) egy eszközben.' },
 { k: 'ms_bed', n: 'Ágy-multiszenzor', members: ['mmw60', 'load_cell'], opt: ['bed_piezo', 'temp'], rooms: ['halo'],
   why: 'Ágyban van-e + légzés / pulzus: éjszakai fény, ébresztés, egészség.' },
 { k: 'ms_leak_freeze', n: 'Szivárgás + fagy', members: ['leak_spot', 'temp'], opt: [], rooms: ['gepesz', 'terasz', 'tarolo', 'konyha', 'furdo'],
   why: 'Ugyanaz az elemes eszköz jelzi a fagyveszélyt is.' },
 { k: 'ms_weather', n: 'Időjárás-állomás', members: ['temp', 'rh', 'pressure', 'lux', 'uv', 'rain', 'wind'], opt: [], rooms: ['terasz', 'kert'],
   why: 'Árnyékolás, öntözés, fűtés előretekintés (STD-009).' }
];

// slot = the Portal slot the module is built for. h = mm. fleet: 'primary' = the uniform module type candidate.
const fleet = [
 { k: 'FLT-H', n: 'Portál fej-modul (irány + jelenlét)', slot: 'H1 / szemöldök', h: 2150, fleet: 'primary',
   members: ['tof_single', 'pir_curtain', 'lux', 'reed'], opt: ['tof_multizone'],
   pwr: 'bus', cable: 'LiYCY 6×0,25 vagy Cat6A S/FTP (EP_CAT POR)',
   why: 'Minden portálon ugyanaz: irány és számlálás (ToF pár), áthaladás (függöny-PIR), fény, ajtóállapot. Ez a portálgráf éle (STD-003).',
   tiers: { alap: ['reed', 'pir_curtain'], premium: ['tof_single', 'pir_curtain', 'lux', 'reed'] } },
 { k: 'FLT-A', n: 'Portál levegő-modul (egészség)', slot: 'zsanéroldali felszálló, szoba felőli oldal', h: 1400, fleet: 'primary',
   members: ['co2', 'voc_mox', 'temp', 'rh'], opt: ['co_ec', 'hcho_ec', 'pm'],
   pwr: 'bus', cable: 'LiYCY 4×0,5 (EP_CAT SEN)',
   why: 'Minden szoba kapjon egészségügyi szenzort — a portál-felszálló már ott van, új vezeték nélkül. A nyitásérzékelő kapuzza a mérést: nyitott ajtónál és utána ~2 percig a CO₂ / hőmérséklet nem érvényes (huzat).',
   caveat: 'Ajtó közelében a levegő keveredik: a modul a szoba felőli tokborításon üljön, ne a nyílásban. Ha a szobának van belső fala ≥ 1 m-re az ajtótól, ott jobb — a fleet-modul a kényelmes alapeset.',
   tiers: { alap: ['voc_mox', 'temp', 'rh'], premium: ['co2', 'voc_mox', 'temp', 'rh', 'co_ec'] } },
 { k: 'FLT-N', n: 'Portál értesítő-modul (NTL + kopogás + közeledés)', slot: 'NL-TR a portál mellett (STD-008)', h: 1150, fleet: 'secondary',
   members: ['cap_prox', 'accel', 'piezo_knock'], opt: ['tof_single'],
   pwr: 'busb', cable: 'B busz pár + adatpár (EP_CAT NTL trd)',
   why: 'Az értesítő fény mellé közeledés- és kopogásérzékelés: WC / fürdő ajtaján foglaltságjelző, máshol „valaki az ajtó előtt áll”.',
   tiers: { alap: ['piezo_knock'], premium: ['cap_prox', 'accel', 'piezo_knock'] } },
 { k: 'FLT-L', n: 'Portál láb-modul (éjszakai fény + alacsony mozgás)', slot: 'zsanéroldali felszálló alja', h: 300, fleet: 'secondary',
   members: ['pir', 'lux'], opt: ['leak_spot'],
   pwr: 'busb', cable: 'B busz pár (EP_CAT LMP busb)',
   why: 'Lábfény a mozgásvonal mentén, a portálnál indul; az alacsony PIR a háziállatot a fej-modullal együtt szétválasztja.',
   tiers: { alap: ['pir'], premium: ['pir', 'lux'] } }
];

module.exports = { multisensors, fleet };
