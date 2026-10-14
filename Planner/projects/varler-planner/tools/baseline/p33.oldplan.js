// p33.oldplan.js — the user's earlier P33 plan (Peterdy_33_villany_tisztazott, r1) as a checklist for the baseline.
// Positions are that sheet's own pixel frame (the generator BRIDGE/07_P33/blueprints/src/p33-sheets.js keeps the same
// numbers); `toPlan` maps them into the .vplan frame (P33 turned 180°, 1 px = 1/0.1373 mm — checked on 70+ points).
// st: ok = megvan · moved = megvan, áthelyezve · part = részben · miss = hiányzik · ask = tisztázandó · gone = helyesen megszűnik
'use strict';
const toPlan = (ix, iy) => [Math.round(10934 - (834 + (ix - 362) / 0.1373)), Math.round(11440 - (2390 + (iy - 195) / 0.1373))];

const ITEMS = [
  // ---- Szoba (R07) ----
  { room: 'Szoba', at: [665, 372], what: 'mennyezeti lámpa (meglévő)', st: 'ok', now: 'L24', note: 'váltó: K4 (B171) + K14b' },
  { room: 'Szoba', at: [468, 197], what: 'éjjeli lámpa + kapcsoló (bal)', st: 'ok', now: 'L13 + K1', note: '' },
  { room: 'Szoba', at: [728, 195], what: 'éjjeli lámpa + kapcsoló (jobb)', st: 'ok', now: 'L14 + K2', note: '' },
  { room: 'Szoba', at: [420, 195], what: 'ágy melletti dugaljak (bal, meglévő)', st: 'ok', now: 'D2 ×2 (D364, D365)', note: '' },
  { room: 'Szoba', at: [796, 195], what: 'ágy melletti dugaljak (jobb, új)', st: 'ok', now: 'D1, D2 (D261, D262)', note: '' },
  { room: 'Szoba', at: [348, 250], what: 'redőny', st: 'ok', now: 'SHU1 (D284) + R-SHU1 kapcsoló', note: '' },
  { room: 'Szoba', at: [743, 550], what: 'lámpakapcsoló a régi ajtónál (meglévő)', st: 'moved', now: 'K4 a B171-nél', note: 'a régi ajtó befalazva; a kapcsolás az új ajtóhoz került, váltó a K14b-vel' },
  { room: 'Szoba', at: [920, 548], what: 'dugaljak a közfalon (szoba oldal)', st: 'ok', now: 'D32–D34 (A14)', note: 'kb. 0,5 m-rel arrébb, hármasával' },
  { room: 'Szoba', at: [485, 547], what: 'TV + internet az új ajtó mellett', st: 'ok', now: 'ETH1 (D292) — adatréteg', note: 'a vázlatban a fal közepén állt: most a szoba felőli oldalra rögzítve' },
  { room: 'Szoba', at: [635, 560], what: 'konnektorok áthelyezése (a régi ajtó szoba felőli 2 dugalja)', st: 'moved', now: 'D3, D4 (A5)', note: '' },
  { room: 'Szoba', at: [829, 563], what: 'befalazva (régi nyílás / dobozok)', st: 'gone', now: '—', note: 'bontási tétel: a régi vezetékek megszüntetése befalazás előtt' },
  { room: 'Szoba', at: [845, 465], what: 'GARDRÓB (ferde fal)', st: 'ask', now: 'nincs pont', note: 'kell gardróbvilágítás / dugalj? (RESEARCH-001 D-01: az SSC itt vagy a kamrában)' },
  // ---- Nappali (R06) ----
  { room: 'Nappali', at: [436, 585], what: 'a régi ajtó nappali felőli 2 dugalja', st: 'ask', now: 'nincs megfelelője', note: 'a B171 és a D35 között 2,7 m dugalj nélkül — kell egy pár az új ajtó mellé?' },
  { room: 'Nappali', at: [726, 840], what: 'mennyezeti lámpa (meglévő)', st: 'ok', now: 'L26', note: 'váltó: K3b (B171) + K13b (B103)' },
  { room: 'Nappali', at: [463, 731], what: 'függőlámpa (mennyezetre) — felső', st: 'ok', now: 'L1', note: 'L1 + L2 váltó: K3 + K13' },
  { room: 'Nappali', at: [462, 933], what: 'függőlámpa (mennyezetre) — alsó', st: 'ok', now: 'L2', note: '' },
  { room: 'Nappali', at: [950, 970], what: 'függőlámpa (étkezőasztal fölé)', st: 'ok', now: 'L3', note: 'K13c a B103-nál' },
  { room: 'Nappali', at: [622, 1111], what: 'fali lámpa (bal)', st: 'ok', now: 'L15 (1800)', note: '' },
  { room: 'Nappali', at: [786, 1111], what: 'fali lámpa (jobb)', st: 'part', now: 'L16 — de 300 mm-en', note: 'a vázlatban alacsonyan állt, a szabály kapcsolt dugaljnak vette (300); a régi terv szerint fali lámpa, mint az L15 (1800)' },
  { room: 'Nappali', at: [1015, 870], what: 'lámpakapcsoló a B103-nál (meglévő)', st: 'ok', now: 'K13 (+ K13b, K13c)', note: '' },
  { room: 'Nappali', at: [525, 587], what: 'villanykapcsoló az új ajtónál (nappali oldal)', st: 'ok', now: 'K3 (+ K3b, K3c)', note: '' },
  { room: 'Nappali', at: [525, 547], what: 'villanykapcsoló az új ajtónál (szoba oldal)', st: 'ok', now: 'K4', note: '' },
  { room: 'Nappali', at: [920, 585], what: 'dugaljak a közfalon (nappali oldal)', st: 'ok', now: 'D35, D36 (A13)', note: '' },
  { room: 'Nappali', at: [450, 1111], what: 'dugaljak a TV-falon (bal pár)', st: 'ok', now: 'D30, D31 (A4)', note: '' },
  { room: 'Nappali', at: [893, 1111], what: 'dugaljak a TV-falon (jobb pár)', st: 'ok', now: 'D28, D29 (A4)', note: '' },
  { room: 'Nappali', at: [507, 1108], what: 'TV + internet', st: 'ok', now: 'ETH1 (D291) — adatréteg', note: '' },
  { room: 'Nappali', at: [367, 837], what: 'redőny (alsó + felső)', st: 'part', now: 'SHU1 (D283) — egy motor', note: 'a légteres (4,5 m) ablakoszlop felső redőnyéhez második motor + kapcsoló kell' },
  { room: 'Nappali', at: [349, 1045], what: 'KLÍMA', st: 'ok', now: 'DED1 klíma (D281, 2300)', note: '' },
  // ---- Fürdő (R08) és oldalrésze ----
  { room: 'Fürdő', at: [956, 368], what: 'kapcsoló az oldalrészben (meglévő)', st: 'ok', now: 'K14 (L28), K14b (L24 váltó)', note: '' },
  { room: 'Fürdő', at: [928, 246], what: 'dugaljak az oldalrészben (bojler?)', st: 'ok', now: 'D26, D27 (A6)', note: 'mellette a mosógép (DED1, D282)' },
  { room: 'Fürdő', at: [1108, 304], what: 'dugalj a felső falon (meglévő)', st: 'ok', now: 'D16 — konvektor', note: '' },
  { room: 'Fürdő', at: [1301, 437], what: 'fali lámpa a zuhanyfalon (meglévő)', st: 'part', now: 'D287 LED (LV) + L28 mennyezeti', note: '230 V fali lámpa nincs helyette; a zuhanyfal LED-et kap (LED4), a fő fény az új L28' },
  { room: 'Fürdő', at: [1303, 382], what: 'dugalj a fürdő | konyha falon (fürdő oldal)', st: 'gone', now: '—', note: 'a zuhany helyére esne — helyesen elmarad' },
  { room: 'Fürdő', at: [1076, 433], what: 'konnektor a tükör mellett', st: 'ok', now: 'D14, D15 + K12 (függőleges hármas keret)', note: '' },
  { room: 'Fürdő', at: [1136, 466], what: 'tükör lámpa', st: 'ok', now: 'L17 (1900)', note: '' },
  { room: 'Fürdő', at: [1258, 466], what: '→ LED + bemarás az új falban', st: 'ask', now: 'D288 (LV) + LED3 kezdőpont', note: 'a bemarás az RBX03 mögé esik, azonos magasságban (2100 / 2150) — a 200 mm-es falban nem fér el mindkettő' },
  { room: 'Fürdő', at: [1190, 515], what: 'új fal', st: 'ok', now: 'W169', note: '' },
  { room: 'Fürdő', at: [1025, 300], what: 'sraffozott téglalapok az oldalrészben', st: 'ask', now: '—', note: 'nem azonosítható jel (régi elem / bontás?) — ha villamos teendő, írd meg' },
  // ---- Konyha ----
  { room: 'Konyha', at: [1488, 433], what: 'mennyezeti lámpa (meglévő)', st: 'ok', now: 'L12', note: 'az A spotcsoport tagja (K15 · K16 · K9)' },
  { room: 'Konyha', at: [1473, 548], what: 'lámpakapcsoló a bontandó falon', st: 'moved', now: 'K15 / K16 / K9 háromhelyes csoport', note: '' },
  { room: 'Konyha', at: [1330, 437], what: 'fali lámpa a W17-en (meglévő)', st: 'ok', now: 'MF2 munkafény (K5 csillár)', note: '' },
  { room: 'Konyha', at: [1323, 340], what: 'kapcsoló a W17-en (meglévő)', st: 'ok', now: 'K5 (+ K5b)', note: '' },
  { room: 'Konyha', at: [1323, 398], what: 'dugalj a W17-en (meglévő)', st: 'ok', now: 'D18, D19', note: '' },
  { room: 'Konyha', at: [1318, 350], what: 'LED fények (a W17 mentén)', st: 'part', now: 'MF2 (230 V) + LED1 kezdőpont', note: 'a betáp megvolt; a szalag kezdőpontja és doboza most került be' },
  { room: 'Konyha', at: [1415, 560], what: 'LED fények — folytatás a bontandó fal mentén', st: 'ask', now: '—', note: 'a fal megszűnik, a helyén a sziget hátoldala: kell ott LED (a sziget alatt / mögött)?' },
  { room: 'Konyha', at: [1479, 302], what: 'pult dugaljak (2 meglévő + 2 új)', st: 'part', now: 'D7, D8, D9 (A2)', note: '4 helyett 3, egy csoportban (1704–1848); a régi terv 1,7–2,2 m között osztotta szét — kell a 4.?' },
  { room: 'Konyha', at: [1604, 300], what: 'meglévő áramforrást többszörözni kell (sütőtorony)', st: 'part', now: 'DED2 — egy dedikált pont', note: 'ha a toronyban 2 készülék lesz (sütő + mikró / gőzpároló), 2 csatlakozás kell' },
  { room: 'Konyha', at: [1368, 436], what: 'mosogatógép', st: 'ok', now: 'DED3 (D280)', note: '' },
  { room: 'Konyha', at: [1655, 520], what: 'redőny (konyha + étkező ablak)', st: 'ok', now: 'SHU1 (D285), SHU2 (D286)', note: '' },
  { room: 'Konyha', at: [1700, 468], what: 'új radiátor', st: 'ask', now: '—', note: 'vizes (nincs villamos teendő) vagy elektromos (dedikált kör)? — okos termosztátfej a BRIDGE-ben később' },
  { room: 'Konyha', at: [1322, 511], what: 'dugaljak a bontandó falszakaszon', st: 'gone', now: '—', note: 'helyettük a hűtőfülke (D10, D11) és a sziget dugaljai' },
  { room: 'Konyha', at: [1360, 548], what: 'dugalj a bontandó falon', st: 'gone', now: '—', note: 'helyette szigetdugalj' },
  { room: 'Konyha', at: [1072, 537], what: 'hűtő', st: 'ok', now: 'D11', note: '' },
  { room: 'Konyha', at: [1078, 662], what: 'dugalj a hűtőfülke mellett (új fal)', st: 'ok', now: 'D10', note: '' },
  // ---- Konyhasziget ----
  { room: 'Sziget', at: [1335, 608], what: 'függőlámpa a sziget fölött', st: 'ok', now: 'L10 (váltó K5b + K17)', note: '' },
  { room: 'Sziget', at: [1307, 640], what: 'pultba épített dugalj', st: 'ask', now: 'D13 — de a jegyzete „szigetelszívó”', note: 'a D13 a régi „pultba épített” helyén áll, a D12 a régi „főzőlap + elszívó” helyén — a két jegyzet fel van cserélve?' },
  { room: 'Sziget', at: [1405, 643], what: 'főzőlap + elszívó', st: 'part', now: 'DED1 főzőlap (D278); elszívó: nincs mennyezeti pont', note: 'szigetelszívó: mennyezeti csatlakozás (2850) vagy pultba süllyesztett (downdraft)?' },
  // ---- Étkező ----
  { room: 'Étkező', at: [1345, 708], what: 'mennyezeti lámpa (meglévő)', st: 'ok', now: 'L6', note: 'a B spotcsoport tagja (K10 · K8 · K15b)' },
  { room: 'Étkező', at: [1367, 733], what: 'spot lámpák (6 db)', st: 'ok', now: 'L4, L5, L7, L8, L9, L11', note: 'két 4-es csoport, három helyről' },
  { room: 'Étkező', at: [1185, 842], what: 'kapcsolók az étkező | kamra falon', st: 'ok', now: 'K9, K10, K9c', note: '' },
  { room: 'Étkező', at: [1473, 835], what: 'kapcsoló az előszoba ajtónál (étkező oldal)', st: 'ok', now: 'K8, K16', note: '' },
  { room: 'Étkező', at: [1441, 838], what: 'dugalj az étkező déli falán', st: 'ok', now: 'D17, D22 (A7)', note: '' },
  { room: 'Étkező', at: [1712, 700], what: 'redőnyök vezérlő egység', st: 'part', now: 'motoronként fali kapcsoló', note: 'a központi vezérlés a CONTROL rétegen (RBX) jön; most mindegyik motor mellett reteszelt fel/le kapcsoló' },
  { room: 'Étkező', at: [1303, 857], what: 'dugalj a lépcső előtt', st: 'ok', now: 'D25', note: '' },
  // ---- Kamra, lépcső ----
  { room: 'Kamra', at: [1183, 876], what: 'kapcsoló (meglévő)', st: 'ok', now: 'K11 → L27 (új kamralámpa)', note: '' },
  { room: 'Kamra', at: [1183, 895], what: 'dugalj (meglévő)', st: 'ok', now: 'D24', note: '' },
  { room: 'Lépcső', at: [1297, 975], what: 'fali lámpa (meglévő)', st: 'ok', now: 'L23 (K9c)', note: '' },
  { room: 'Lépcső', at: [1310, 990], what: 'LED sor a lépcső mellett', st: 'part', now: 'D289 + D456 (LV) + LED5 kezdőpont', note: 'a régi terven a sor a fordulóban a külső falon, a kamra fölött is folytatódik — a vázlatban csak a WC-fal menti rész van' },
  // ---- WC, előszoba ----
  { room: 'WC', at: [1375, 983], what: 'mennyezeti lámpa (meglévő)', st: 'ok', now: 'L22 (K6)', note: '' },
  { room: 'WC', at: [1373, 868], what: 'fali lámpa (új)', st: 'ok', now: 'L18', note: '' },
  { room: 'WC', at: [1427, 1045], what: 'kapcsoló (meglévő)', st: 'ok', now: 'K6 (az előszobában)', note: '' },
  { room: 'WC', at: [1427, 893], what: 'új dugalj', st: 'moved', now: 'D17 (D277) a bidé mellett', note: '' },
  { room: 'WC', at: [1377, 1111], what: 'melegvíz bevezetés (bidéhez)', st: 'ask', now: 'dugalj megvan (D277)', note: 'ha átfolyós / kis villanybojler adja a meleg vizet, dedikált kör kell' },
  { room: 'Előszoba', at: [1548, 983], what: 'mennyezeti lámpa (meglévő)', st: 'ok', now: 'L21', note: '' },
  { room: 'Előszoba', at: [1473, 866], what: 'kapcsoló (meglévő)', st: 'ok', now: 'K7', note: '' },
  { room: 'Előszoba', at: [1492, 866], what: 'dugalj (meglévő)', st: 'ok', now: 'D17 (D332)', note: '' },
  { room: 'Előszoba', at: [1585, 1062], what: 'beépített szekrény', st: 'ok', now: '—', note: 'nincs villamos teendő' },
  { room: 'Előszoba', at: [1660, 897], what: 'redőnyház (?)', st: 'ask', now: 'nincs pont', note: 'az előszobában nincs ablak a mostani terven — a bejárati ajtó fölötti redőny? ha igen: motor + kapcsoló' }
];
ITEMS.forEach((it, k) => { it.n = k + 1; [it.x, it.y] = toPlan(it.at[0], it.at[1]); });
module.exports = { ITEMS, toPlan, SOURCE: 'BRIDGE/07_P33/blueprints/Peterdy_33_villany_tisztazott.png (r1) — a felhasználó korábbi terve' };
