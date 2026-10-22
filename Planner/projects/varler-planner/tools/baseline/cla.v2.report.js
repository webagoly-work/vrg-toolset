// cla.v2.report.js — V2_FELMERES.md for the CLA v2 survey (cla.v2.js computes, this writes)
'use strict';
const fs = require('fs'), path = require('path');

const ROOM = { R01: 'Előszoba', R03: 'Konyha · étkező', R03L: 'Lépcső', R04: 'WC', R05: 'Kamra', R06: 'Nappali', R07: 'Szoba', R08: 'Fürdő' };
const EPHU = { 'POR/rs485': 'portál vezérlőpont (RS-485)', 'POR/tof': 'portál fej-modul (ToF)', 'SEN/mmwave': 'mmWave jelenlét', 'SEN/co2': 'CO₂ / levegőminőség',
  'SEN/pir': 'PIR', 'SEN/leak': 'szivárgásérzékelő', 'SEN/thermal': 'hőkamera', 'NTL/tr': 'értesítő fény', 'LMP/b': 'lábfény', 'LNR/b': 'LED-vonal (B busz)',
  'LNR/rov': 'LED-vonal', 'PAN/touch': 'érintőpanel', 'THR/bus': 'termosztát / levegő-modul', 'SPK/17': 'hangszóró' };
const LAYER_HU = { CONTROL: 'Vezérlés', SENSOR: 'Érzékelő', BUSB: 'B busz', LV: 'LV (A busz)', HMI: 'Kezelő', MEDIA: 'Média', CHANNEL: 'CHANNEL (BASE ↔ RBX)',
  'BUSB-PACK': 'B busz akku', PANEL: 'PANEL LINK', RISER: 'V1 felszálló', 'RISER-MAINS': 'V1 erősáramú hüvely', MEDIAWALL: 'Médiafal', SECURITY: 'Biztonság', MAINS230: '230 V a fülkékhez' };

// the per-room list: only what the v2 preparation really makes possible (every line names the prepared point)
const MARKETING = [
  ['Előszoba', [
    'Érintőpanel a bejáratnál: „elmentem otthonról” jelenet egy érintéssel — a fűtés, az okos fényforrások, a redőnymodulok és az értesítők egyszerre (a panel helye, Cat6A + tápvezeték kész).',
    'Mozgásérzékelő (PIR): belépéskor a lábfény magától felkapcsol, éjjel halványan; a „hazaértem” jelenet indul.',
    'Értesítő fények az ajtók mellett és lábfény: csengetés, mosógép kész, nyitott ablak — fényjelzés hang nélkül, áramszünetben is (B busz).',
    'Bejárati ajtókontakt és sziréna helye előkészítve: riasztó később bármely szolgáltatóval, vésés nélkül.',
    'Optikai és koax üres cső a szolgáltatónak: szolgáltatóváltás bontás nélkül.']],
  ['Konyha · étkező', [
    'Két CO₂ / levegőminőség-pont: főzéskor és zsúfolt asztalnál jelez, hogy szellőztetni kell (ESPHome érzékelőmodul).',
    'Szivárgásérzékelő a mosogató / gépek környezetében: azonnali értesítés a telefonra.',
    'Két hangszórópont: a multiroom zene a konyhában is szól (Snapcast, Home Assistant).',
    'Portálérzékelés a két ajtónál (ToF + vezérlőpont): a rendszer tudja, hány ember van a térben; a fűtés, a zene és az értesítések ehhez igazodnak.',
    'LED-vonalak tápja az RBX-ből: szekrény alatti fény dimmelve, cirkadián színhőmérséklettel (ESPHome LED-vezérlő).',
    'PoE kamerapont (a v1-ben kiépítve) és értesítő fény.']],
  ['Lépcső', [
    'Mozgásérzékelő: a lépcső LED-sora magától kapcsol, éjjel halványan vezet.',
    'WiFi AP (PoE) a v1-ben kiépítve: erős lefedettség a lépcsőtérben.',
    'A kamrai V1 felszálló kész: az emeleti okosotthon később falbontás nélkül ráköthető.']],
  ['Kamra', [
    'A biztosított 24 V-os akku helye és tápja: áramszünetben is világít a menekülőfény, és működnek az értesítők.',
    'V1 felszálló csövekkel a födémen át, tűzgátlással: az emelet bekötése később.']],
  ['WC', [
    'mmWave jelenlétérzékelő: a WC LED-fénye addig ég, amíg bent vagy, akkor is, ha mozdulatlan vagy. Nincs többé sötétben integetés.',
    'Szivárgásérzékelő a padlón.',
    'LED-vonal és lábfény (B busz): éjszakai, nem vakító fény.']],
  ['Nappali', [
    'mmWave jelenlét: a fűtés és az okos fényforrások a valós jelenléthez igazodnak, ülve olvasva sem kapcsol le.',
    'Érintőpanel és termosztát / levegő-modul az ajtók mellett: helyi kezelés, felhő nélkül.',
    'Médiafal-előkészítés: Cat6A és vastag csövek (M40, M63) a TV-hez és a médiabútorhoz, előre fektetett hangszórókábel az L · C · R hangszóróhoz, mélysugárzó-vonal. A házimozi később bontás nélkül szerelhető.',
    'Multiroom zene két hangszóróponttal; követi a lakót a szobák között (follow-me).',
    'Két PoE kamerapont és WiFi AP (a v1-ben kiépítve).',
    'Portálérzékelés mindkét ajtónál, értesítő fények.']],
  ['Szoba', [
    'mmWave jelenlét az ágy felé maszkolva: tudja, hogy alszol — éjjel nem kapcsol fel, és a „jó éjt” jelenet magától lefut.',
    'Termosztát / levegő-modul: alváshoz igazított hőmérséklet okos termosztátfejekkel (Zigbee, helyi).',
    'Három értesítő fény (B busz): halk éjszakai jelzések.',
    'A médiafalon át kész átvezetés a hálószobai TV-hez (M40).',
    'Portálérzékelés a fürdő felé.']],
  ['Fürdő', [
    'Hőkamera (thermal array): jelenlét és tartós mozdulatlanság jelzése képrögzítés nélkül — a magánszféra megmarad.',
    'Érintőpanel és termosztát: a fürdő hőmérséklete külön szabályozva; az elszívó (a v1-ben RBX-kimenet) páratartalom szerint jár.',
    'Hangszórópont: reggeli zene és hírek.',
    'Portál vezérlőpont és ToF: a fürdő foglaltsága látszik, éjjel a szoba értesítő fényei halványan vezetnek.']]];
const MARKETING_ALL = [
  'Helyi vezérlés felhő nélkül: Home Assistant + ESPHome a BASE-ben. Internet nélkül is működik, az adat a lakásban marad.',
  'Körönkénti energiamérés: az elosztótól a BASE-ig behúzott Cat6A (PANEL LINK) és szabad modulhelyek az elosztóban.',
  'Moduláris bővítés: minden réteg csöve és kábele a falban van. A hardver lépésenként, szobánként, a költségvetéshez igazítva kerül be, vésés és festés nélkül.',
  'Tartalékcsövek (C4, C5) minden RBX-hez: később KNX, DALI vagy még nem létező szabvány is behúzható.'];

function write(o, outDir, U) {
  const { fmt, m1, pct, RBX, CH } = U, Q = o.quantities, L = [];
  const p = s => L.push(s), t = (h, rows) => { p('| ' + h.join(' | ') + ' |'); p('|' + h.map(() => '---').join('|') + '|'); rows.forEach(r => p('| ' + r.join(' | ') + ' |')); p(''); };
  const sum = obj => Object.values(obj || {}).reduce((s, v) => s + v, 0);
  p('# CLA — v2 felmérés: v1 teljes kiépítés + minden réteg előkészítése');
  p('');
  p(`Forrás: \`${o.source}\` · v1: VG-2026-CLA-01 (\`job/offer.json\`) · motor: \`tools/baseline/\` (selv.js, cla.v2.js) · ${o.generated.slice(0, 16).replace('T', ' ')}`);
  p('');
  p('**Felmérési pontosság.** A mennyiségeket a motor számolja a vázlat 46 SELV-végpontjából, ugyanazzal az útvonal-algoritmussal, mint a v1 adatrétegét. Az egységárak a v1 árai; az új tételeké ●○○, forrással. A fair árak részletes kalkulációja a Workflow Kit munkamenet dolga (B fázis, `V2_FELADAT.md`).');
  p('');
  p('## 0. Döntések (a felhasználó, 2026-10-12)');
  p('');
  t(['Kérdés', 'Döntés', 'Hatás'], [
    ['RBX-fülkék mérete', '„Kettő M és egy H prioritás szerint”', 'Terhelés = SELV-végpont + v1 adatport + a legközelebbi lámpák/redőnyök: RBXM 30 · RBX03 21 · RBX06 15. **RBXM = RB-H** 600×600×120; **RBX03, RBX06 = RB-M** 400×500×110. A médiafal C2-je az RBX06-ba fut.'],
    ['Emelet (V1 felszálló)', 'Csövek, kábel nélkül', 'Teljes köteg (C1–C5, C4b) + 3 × M25 erősáramú hüvely a födémen át, behúzószállal, tűzgátlással'],
    ['230 V a fülkékhez', 'Kábel + kismegszakító', '6 új kör: BASE ×2, RBXM, RBX03, RBX06, B busz akku (kamra). A v1 elosztóban: 35 + 6 = 41 / 48 modul'],
    ['Biztonsági réteg', 'Minimális előkészítés; a teljes réteg külön, opcionális részárral', 'SSC-fülke, M25 törzs a BASE-ig, M16 a bejárati ajtókontakthoz és a szirénához — üresen, behúzószállal. A teljes réteg: 6b. fejezet'],
    ['SSC helye', '„Hátrébb, inkább nappali vagy a háló”', 'A szoba (R07) gardróbja, a W12 falon, a szekrény mögött (a RESEARCH-001 D-01 is ezt a sarkot jelölte). A lakás leghátsó, legrejtettebb pontja']]);
  p('## 1. Mi a v2 — kiépítettség');
  p('');
  p('**Benne van:**');
  p('- **A v1 teljes egészében, változatlanul:** 16 kör, 111 erősáramú végpont, Adat/PoE (11 port, 118 m Cat6A), 5 LED-betáp.');
  p(`- **Minden további BRIDGE-réteg előkészítése (${o.endpoints.total} új SELV-végpont):** horony, gégecső, behúzott kábel (rétegenként a STD-001-A2 típusa), végpont-, kötő- és húzódobozok — **végződtetés nélkül, jelölt végekkel és tartalékhurokkal**.`);
  p('- **Süllyesztett terek:** RB-H fülke (RBXM), 2 RB-M fülke (RBX03, RBX06), SSC-fülke (a szoba gardróbjában), a BASE kábelbevezetése. Mind ideiglenes fedlappal lezárva.');
  p('- **CHANNEL BASE ↔ RBX:** a v1 C1-je (2 × Cat6A) mellé a C2 (média, csak az RBX06), C3 (vezérlés, Cat6A S/FTP), C4 (tartalék, üres), C4b (B busz, 2 × 2,5) és C5 (KNX / DALI-tartalék, üres, csak az RB-H).');
  p('- **230 V a fülkékhez:** 6 új kör kismegszakítóval, védett kiállással.');
  p('- **B busz akku helye** a kamrában, a V1 felszálló mellett (K27), a BASE felé 2 × 2,5 mm²; **PANEL LINK** Cat6A az elosztótól a BASE-ig.');
  p('- **V1 felszálló** az emelet felé: csövek, kábel nélkül. **Médiafal** (K33): AV-hely, M63 útvonal, L · C · R hangszórókábel, mélysugárzó-vonal, átvezetés a szobába.');
  p('');
  p('**Nincs benne (későbbre):** RBX-elektronika, BASE (switch, szerver, Home Assistant), akku, szenzorok, panelek, hangszórók, kamerák, AP-k, LED-szalag és tápegység, HDMI AOC, a kábelek végződtetése és bemérése, minden informatikai munka. Nincs benne a médiafal előtétfala és a BASE beépített bútora sem (asztalos / szárazépítő).');
  p('');
  p('**Mi változik a v1-hez képest, főbb pontokban:**');
  p(`- **A horony nagy része közös:** a vízszintes SELV-horonyból **${m1(o.chase.kozos)} m a v1 adathorony szélesítése**, ${m1(o.chase.mellett)} m új horony a v1 erősáramú horony mellett (ugyanabban a menetben), és csak **${m1(o.chase.uj)} m teljesen új**.`);
  p(`- **Új függőleges horony:** ${o.vertical.columns} oszlopban ${m1(o.vertical.m)} m. Ezek a portálok SELV-oldali oszlopai és a végpontok leállásai; az erősáramú oldallal nem közösek (STD-001-A2 §5).`);
  p(`- **Cső:** +${m1(Q.condTotal)} m, de egy horonyba több réteg kerül, egy menetben.`);
  p(`- **Kábel:** +${m1(sum(Q.cab))} m, rétegenként a saját típusában.`);
  p(`- **Doboz és fülke:** +${Q.boxes.box68 + Q.boxes.box2 + Q.boxes.box100 + Q.boxes.box150 + Q.boxes.box1510} doboz, 4 fülke, BASE-bevezetés.`);
  p(`- **Elosztó:** +6 kör (41 / 48 modul).`);
  p('');

  p('## 2. Rétegek és végpontok');
  p('');
  t(['Réteg', 'Végpont', 'Kábel (STD-001-A2)', 'Cső', 'Kiszolgáló RBX / BASE'], o.runs.map(r => [
    LAYER_HU[r.layer] || r.layer, String(r.endpoints.length) + (r.layer === 'LV' ? ' (ebből 3 a panelek LV-párja)' : ''),
    Object.entries(r.cable || {}).map(([k, m]) => `${(U.RU.CABLES[k] || { n: k }).n} ${m1(m)} m`).join(' · '),
    Object.entries(r.conduit || {}).map(([k, m]) => `${k} ${m1(m)} m`).join(' · '),
    Object.entries(r.servedBy).map(([k, n]) => `${k} ${n}`).join(' · ')]));
  p('### 2.1 Végpontok szobánként');
  p('');
  const byRoom = {}; o.runs.forEach(r => r.endpoints.forEach(e => { if (r.layer === 'LV' && e.code === 'PAN') return;
    const k = `${e.code}/${e.v}`; (byRoom[e.room] = byRoom[e.room] || {})[k] = (byRoom[e.room][k] || 0) + 1; }));
  t(['Helyiség', 'Előkészített végpontok'], Object.keys(ROOM).filter(r => byRoom[r]).map(r => [ROOM[r] + ` (${r})`,
    Object.entries(byRoom[r]).map(([k, n]) => (n > 1 ? n + ' × ' : '') + (EPHU[k] || k)).join(' · ')]));
  p('A kamrában (R05) nincs végpont: ott a B busz akku helye és a V1 felszálló van.');
  p('');

  p('## 3. Mennyiségek');
  p('');
  p('### 3.1 Horony és átvezetés');
  p('');
  t(['Tétel', 'Mennyiség', 'Megjegyzés'], [
    ['vízszintes horony 2700 — a v1 adathorony szélesítése (közös)', m1(o.chase.kozos) + ' m', 'a CHANNEL, a B busz akku és a biztonsági törzs is itt fut'],
    ['vízszintes horony 2700 — új, a v1 erősáramú horony mellett', m1(o.chase.mellett) + ' m', 'külön horony (SELV ≠ 230 V), de egy menetben'],
    ['vízszintes horony 2700 — teljesen új', m1(o.chase.uj) + ' m', ''],
    ['függőleges horony', m1(o.vertical.m) + ' m', `${o.vertical.columns} oszlop; portálonként egy oszlop (H0–H3, T1, T2 egy vonalon)`],
    ['mennyezeti horony', m1(o.vertical.ceiling) + ' m', 'mennyezeti hangszórók'],
    ['a v1 gerinchorony szélesítése (230 V)', m1(Q.mainsWiden) + ' m', '6 új kör + 3 emeleti hüvely a v1 gerinc mentén'],
    ['falátvezetés', String(Q.wallX) + ' db', 'médiaátvezetés az R07-be, szirénakivezetés; a SELV-rétegek az RBX- és BASE-fülkéken át mennek'],
    ['födémáttörés + tűzgátlás', '2 db', 'V1 köteg + erősáramú hüvelyek']]);
  p('### 3.2 Védőcső (m)');
  p('');
  const groups = Object.keys(Q.condByLayer);
  const sizes = ['M16', 'M20', 'M25', 'M32', 'M40', 'M63'].filter(k => Q.cond[k]);
  t(['Csoport'].concat(sizes), groups.map(g => [LAYER_HU[g] || g].concat(sizes.map(k => Q.condByLayer[g][k] ? m1(Q.condByLayer[g][k]) : '')))
    .concat([['**összesen**'].concat(sizes.map(k => '**' + m1(Q.cond[k]) + '**'))]));
  p(`Összesen **${m1(Q.condTotal)} m** (v1: 339 + 58 m). Üres cső behúzószállal: ${m1(Q.cords)} m.`);
  p('');
  p('### 3.3 Kábel (m, nyomvonal + 10 % + tartalékhurok: 1,5 m az RBX / BASE végén, 0,3 m a végponton)');
  p('');
  const cabs = Object.keys(Q.cab);
  t(['Kábel', 'm', 'Csoportok'], cabs.map(k => [(U.RU.CABLES[k] || { n: k }).n, m1(Q.cab[k]),
    groups.filter(g => (Q.cabByLayer[g] || {})[k]).map(g => `${LAYER_HU[g] || g} ${m1(Q.cabByLayer[g][k])}`).join(' · ')]));
  p('### 3.4 CHANNEL és fix tételek');
  p('');
  t(['Csoport', 'Tétel', 'Cső', 'm', 'Kábel'], o.fixed.map(x => [LAYER_HU[x.grp] || x.grp, x.name, (x.n > 1 ? x.n + ' × ' : '') + x.cond, m1(x.m),
    x.cab ? (x.n > 1 ? x.n + ' × ' : '') + (U.RU.CABLES[x.cab] || { n: x.cab }).n : 'üres + behúzószál']));
  t(['230 V-os kör', 'Kábel', 'Cső', 'm'], o.feeds.map(f => [f.n, (U.RU.CABLES[f.cab] || { n: f.cab }).n, f.cond || 'a BASE 1. kör csövében (M32, 2 kábel)', m1(f.m)]));
  p('### 3.5 Dobozok és fülkék');
  p('');
  t(['Tétel', 'db'], [
    ['szerelvénydoboz ⌀68, 66 mm mély (végpontok + ajtókontakt + sziréna)', Q.boxes.box68], ['sorolt 2-es mélydoboz (érintőpanel)', Q.boxes.box2],
    ['kötő- / húzódoboz 100×100 (rétegenként külön, STD-001-A2 §2) + R07 TV-doboz', Q.boxes.box100], ['doboz 150×150 (V1 ellenőrződoboz)', Q.boxes.box150],
    ['médiadoboz 15×10 (képernyő, bútor)', Q.boxes.box1510], ['**RB-H fülke** 600 × 600 × 120 (RBXM)', 1], ['**RB-M fülke** 400 × 500 × 110 (RBX03, RBX06)', 2],
    ['SSC-fülke 300 × 400', 1], ['BASE kábelbevezetés (a bútor mögött)', 1]]);

  p('## 4. Anyag (nettó, felmérési pontosság)');
  p('');
  t(['Csoport', 'Tétel', 'Menny.', 'Egységár', 'Összeg', 'Forrás'], o.material.lines.map(l => [l.grp, l.name, `${l.qty} ${l.unit}`, fmt(l.unitPrice), fmt(l.total), l.src]));
  p(`Nettó ${fmt(o.material.net)} + kezelés 10 % ${fmt(o.material.handling)} = **${fmt(o.material.total)} Ft** többletanyag.`);
  p('');
  p('## 5. Munkadíj — a közös útvonal kedvezményével');
  p('');
  p('**Az elv (a felhasználóé):** a cső és a kábel nagy része ugyanoda kerül, ahol a v1 már dolgozik. A meglévő horony szélesebb lesz, nem épül új szakasz. Hogy tételenként mennyi a kedvezmény, és miért:');
  p('');
  p('- **Horony a v1 adathoronyban:** csak szélesítés (egy vágás + kivésés, a kitűzés és a porvédelem már megvan). Az új horony 35 %-a: 1 900 → **650 Ft/m**.');
  p('- **Horony a v1 erősáramú horony mellett:** külön horony kell, mert a 230 V és a SELV nem kerülhet egy horonyba. De ugyanabban a menetben készül, ugyanazzal a kitűzéssel és létrával: 75 %, **1 400 Ft/m**.');
  p('- **Védőcső:** a horony első csöve a v1 díja (660 Ft/m); minden további cső ugyanabba a horonyba, ugyanabban a menetben: 60 %, **400 Ft/m**.');
  p('- **Behúzás:** csövenként az első kábel teljes díj; a további kábel ugyanabban a behúzásban 50 %. A Cat6A **végződtetés nélkül** kerül be (400 Ft/m a v1 960 Ft/m-e helyett). A végeket csak jelöljük, tartalékhurokkal.');
  p('- **Helyreállítás:** az új horonyé teljes díj, a szélesítésé fél.');
  p('- **Teljes díj marad:** az új függőleges oszlopok, a dobozhelyek és a fülkék. Ezek valóban új munkák.');
  p('');
  t(['Csoport', 'Tétel', 'Menny.', 'Egységár', 'Összeg', 'Közös út nélkül', 'Forrás / megjegyzés'], o.labour.lines.map(l => [l.grp, l.name, `${l.unit === 'm' ? m1(l.qty) : Math.round(l.qty)} ${l.unit}`,
    l.unitPrice == null ? '50 %' : fmt(l.unitPrice), fmt(l.total), l.full !== l.total ? fmt(l.full) : '', l.src + (l.note ? ' — ' + l.note : '')]));
  p(`Összesen nettó ${fmt(o.labour.net + o.labour.lines.filter(l => l.grp === 'Szervezés').reduce((s, l) => s + l.total, 0))} → kerekítve **${fmt(o.labour.total)} Ft** többlet-munkadíj, ≈ **${o.labour.hours} emberóra** (a v1 ${fmt(o.labour.rateH)} Ft/eó arányával, két szerelővel ≈ +${Math.ceil(o.labour.hours / 16)} munkanap).`);
  p(`**A közös útvonal értéke:** ugyanez a munka teljesen új útvonalon ≈ ${fmt(o.labour.noShareRef)} Ft lenne, vagyis a közös útvonal **≈ ${fmt(o.labour.noShareRef - o.labour.total)} Ft-ot** (${Math.round((o.labour.noShareRef - o.labour.total) / o.labour.noShareRef * 100)} %) takarít meg.`);
  p('');

  p('## 6. Összefoglaló: v1 ↔ v2');
  p('');
  const v1 = o.v1, v2 = o.v2, row = (n, a, b, money = true) => [n, money ? fmt(a) + ' Ft' : String(a), money ? fmt(b) + ' Ft' : String(b), money ? (b - a >= 0 ? '+' : '') + fmt(b - a) + ' Ft' : (b - a >= 0 ? '+' : '') + (b - a), (b - a >= 0 ? '+' : '') + pct(a, b)];
  t(['', 'v1 · VG-2026-CLA-01', 'v2 (felmérés)', 'Eltérés', '%'], [
    row('**Munkadíj**', v1.labour, v2.labour), row('**Anyag**', v1.mat, v2.mat), row('**Fizetendő**', v1.pay, v2.pay),
    row('Ft/m² (munkadíj, 55,81 m²)', Math.round(v1.labour / v1.m2), Math.round(v2.labour / v1.m2)),
    row('Ft/pont (munkadíj)', Math.round(v1.labour / v1.points), Math.round(v2.labour / v2.points)),
    row('Végpont (db)', v1.points, v2.points, false), row('Emberóra', v1.eo, v2.eo, false),
    ['Munkanap', `${v1.days[0]}–${v1.days[1]}`, `${v2.days[0]}–${v2.days[1]}`, `+${v2.days[0] - v1.days[0]}–${v2.days[1] - v1.days[1]}`, '']]);
  p(`**Röviden.** A v2 a v1 teljes kiépítése, és minden további réteg (vezérlés, érzékelők, B busz, LV, kezelők, média, biztonság, emelet) a falban van: cső, kábel, doboz, fülke. A végpontok száma ${v1.points} → ${v2.points} (+${Math.round((v2.points - v1.points) / v1.points * 100)} %), a fizetendő **+${pct(v1.pay, v2.pay)}**. **A pontonkénti munkadíj alig változik** (${fmt(Math.round(v1.labour / v1.points))} → ${fmt(Math.round(v2.labour / v2.points))} Ft/pont, +${pct(v1.labour / v1.points, v2.labour / v2.points)}). Pedig egy előkészített SELV-pont több réteget, saját oszlopot és fülkét is jelent; a különbséget a közös horony nyeli el (≈ ${fmt(o.labour.noShareRef - o.labour.total)} Ft).`);
  p('');
  const O = o.option;
  p('## 6b. Opció — a teljes biztonsági (SSC) réteg kiépítése, külön részár');
  p('');
  p(`**Opcionálisan kérhető.** A riasztó eszközei (központ, érzékelők, kontaktok, kezelő, szirénák) a munka végén, a szolgáltatóval kerülnek fel, és nincsenek benne. Az opció minden csövet és kábelt előre a falba tesz, amire szükségük lesz: a szolgáltatónak csak fel kell szerelnie és be kell kötnie őket. Az SSC a szoba gardróbjában van, onnan minden pont csillagban, saját M16 csőben fut (STD-001-A2, 13. lépés).`);
  p('');
  t(['Pont', 'Helyiség', 'Magasság', 'Hossz', 'Kábel'], O.pts.map(x => [x.name, ROOM[x.room] || x.room, x.h + ' mm', m1(x.m) + ' m', x.cab === 'ALARM' ? 'riasztókábel 4×0,22 + 2×0,5' : 'J-Y(St)Y 2×2×0,8']).concat([
    ['bejárati ajtókontakt + kültéri sziréna', 'Előszoba', '', 'a v2 üres M16 csöveibe', 'riasztókábel'], ['SSC IP-modul → BASE', '', '', 'a v2 üres M25 törzsébe', 'Cat6A S/FTP'],
    ['az SSC saját 230 V-os köre', 'Elosztó → szoba', '', m1(O.sscFeedM) + ' m', 'NYM-J 3×1,5 + kismegszakító']]));
  p(`Horony: ${m1(O.chase.kozos)} m a már meglévő v2-horony szélesítése, ${m1(O.chase.mellett + O.chase.uj)} m új; függőleges ${m1(O.vert)} m. Cső: ${m1(O.cond)} m M16.`);
  p('');
  t(['Anyag', 'Menny.', 'Egységár', 'Összeg', 'Forrás'], O.mat.map(l => [l.name, `${l.qty} ${l.unit}`, fmt(l.unitPrice), fmt(l.total), l.src]));
  t(['Munkadíj', 'Menny.', 'Egységár', 'Összeg', 'Forrás'], O.lab.map(l => [l.name, `${l.unit === 'm' ? m1(l.qty) : Math.round(l.qty)} ${l.unit}`, fmt(l.unitPrice), fmt(l.total), l.src + (l.note ? ' — ' + l.note : '')]));
  t(['Opció', 'Munkadíj', 'Anyag (+10 % kezelés)', '**Összesen**', 'Emberóra'], [['Teljes biztonsági réteg (vezetékezés)', fmt(O.labTotal) + ' Ft', fmt(O.matTotal) + ' Ft', '**' + fmt(O.total) + ' Ft**', String(O.hours)]]);
  p(`**v2 + opció:** ${fmt(o.v2.pay + O.total)} Ft fizetendő (a v1-hez képest +${pct(o.v1.pay, o.v2.pay + O.total)}). Az opció utólag is kérhető. Ha később kérik, a közös horony kedvezménye elvész (a horony addigra bevakolva), és a vésés, festés újra kell — ezért most a legolcsóbb.`);
  p('');
  p('## 7. Mire ad lehetőséget — szobánként (marketinglista)');
  p('');
  p('*Nem egy normál villamos felújítás: a falban van minden, amire a jövőben szükség lehet. Csak olyat sorolunk, amit a v2 előkészítése valóban lehetővé tesz; a hardver később, lépésenként kerül be.*');
  p('');
  MARKETING.forEach(([r, items]) => { p(`**${r}**`); items.forEach(i => p('- ' + i)); p(''); });
  p('**Az egész lakásban**');
  MARKETING_ALL.forEach(i => p('- ' + i));
  p('');
  p('*Amit szándékosan nem ígérünk:* automata vízelzárás (szelep és vezetéke nincs előkészítve), központi lámpakapcsolás az RBX-ből (a v1 világítása hagyományos; okosítás utólag a kapcsolódobozban vagy okos fényforrással), kültéri kamera (nincs kültéri pont).');
  p('');
  p('## 8. Feltételezések és nyitott pontok a Kit munkamenetnek');
  p('');
  p('- **Új egységárak és normák ●○○:** minden olyan sor, amelynek a forrása ●○○, a 3. körben ⚠ sorként jöjjön, TERC-kalibrált forrással. Áron tételnormái nem használhatók.');
  p('- **Kedvezmény-arányok** (0,35 · 0,75 · 0,6 · 0,5): indokolt becslések, nem mérések. A Kit ellenőrizze őket a v1 normáival.');
  p('- **RBX03 az új fürdőfalban** (K29): ha a kőműves kihagyja a fülke helyét, a fülke kivésése olcsóbb vagy elmarad.');
  p('- **Médiafal:** a hosszak (2 / 1,5 / 3 / 2,5 m) becslések a K33 alapján; az előtétfal és a bútor nem része.');
  p('- **SSC helye:** a szoba gardróbja, W12 (a felhasználó: „hátrébb”). A szolgáltató (D9) nyitott; a gardrób szellőzését és az SSC 230 V-os körét a szolgáltató igénye szerint kell ellenőrizni.');
  p('- **Biztonsági opció:** 4 ablakkontakt, 4 mozgásérzékelő, kezelő, beltéri sziréna; a pontok helye a szobák alapján becsült. Mindent a szolgáltató tervéhez kell igazítani, mielőtt a cső a falba kerül.');
  p('- **230 V a fülkékhez:** kismegszakító (a felhasználó döntése). A BRIDGE köreként ajánlott 1 modulos RCBO kb. +65 000 Ft anyag lenne; ez opcióként felkínálható.');
  p('- **A v1 nyitott kérdései** (ADATRETEG-Q-002, N01–N05) a v2-t nem akasztják meg.');
  fs.writeFileSync(path.join(outDir, 'V2_FELMERES.md'), L.join('\n') + '\n');
}
module.exports = { write, MARKETING, MARKETING_ALL };
