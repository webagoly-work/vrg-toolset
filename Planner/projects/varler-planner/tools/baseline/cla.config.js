// cla.config.js — the project facts the baseline cannot read from the .vplan (yet). Everything else comes from the file.
// The Planner workflow (later) turns each of these into a user action: mark a worktop, mark the bed, pick zones…
'use strict';
module.exports = {
  name: 'CLA teszt — erősáram alapréteg',
  level: 'ground',
  ceiling: 2850,
  // kitchen worktop runs (room face, along-axis range) → worktop sockets at 1100
  worktop: [{ room: 'R03', wall: 'W9', from: 784, to: 3085 }, { room: 'R03', wall: 'W17', from: 6940, to: 8271 }],
  island: { object: 'O325', sp: 'D369' },         // Konyhapult 120 — reached through the floor from RBX03 (user note)
  mainFeedCable: 'NYM5x10',                       // mérő → Elosztó, háromfázisra kész (K32) ⚑ a szolgáltatói méretezés dönt
  bedZoneMark: 'agy',                             // floor zone mark tag; wall devices beside it are "bed" devices
  wetRooms: ['R04', 'R08'],
  roomKinds: { R05: ['kamra'] },                  // F7 (2026-10-15): the rules no longer know room ids; the pantry is a kind
  latchFrom: 'switches',                          // T0 / F4: CLA v1 voted the latch from the switches; the default is now the door's variant
  cornerBoxes: 'all',                             // E5-Q4: the CLA rule (a box at every corner) — now an option, the default is pull boxes only
  // lighting circuits (user 2026-10-12): V1 day zone, V2 night zone
  lighting: [{ ref: 'V1', name: 'Világítás — nappali zóna (előszoba, WC, lépcső, kamra, konyha-étkező, nappali)', rooms: ['R01', 'R04', 'R03L', 'R05', 'R03', 'R06'], mcb: 'B10' },
             { ref: 'V2', name: 'Világítás — éjszakai zóna (szoba, fürdő)', rooms: ['R07', 'R08'], mcb: 'B10' }],
  // switches the sketch put on the Csatorna layer (kind 106 = váltókapcsoló) — taken into the Erősáram layer
  adoptSwitches: ['D590', 'D591'],
  // a sketch point on the exterior face of a wall: moved to the room face, flagged
  fixFace: { D339: 'R01', D292: 'R07' },           // D292: a TV-pont a régi terv szerint a szoba oldalán (a vázlatban a fal közepén)
  // lamp → switch, where the sketch carries no ctl. Inferred by the engine; pin a choice here to override.
  ctlPin: {},
  // socket circuits: existing A2–A12 kept; new ones the engine proposes are listed in the report
  socketPlan: [
    { ref: 'A4', name: 'R06 nappali — felső fal (médiafal)', members: ['D355', 'D356', 'D357', 'D358'] },
    { ref: 'A13', name: 'R06 nappali — közfalak', mcb: '1C 16A', cable: 's25', members: ['D362', 'D363', 'D374', 'N:S39', 'N:S40'] },
    { ref: 'A5', name: 'R07 szoba — ágy és ablakfal', add: ['D364', 'D365'] },
    { ref: 'A14', name: 'R07 szoba — közfal (asztal / TV) + gardrób', mcb: '1C 13A', cable: 's04', members: ['D359', 'D360', 'D361', 'N:SG1'] },
    { ref: 'A2', name: 'R03 konyha — pult', add: ['D322', 'D323', 'N:SW41'] },
    { ref: 'A6', name: 'R08 fürdő dugalj', add: ['D352', 'D353'] },
    { ref: 'A7', name: 'R01 · R04 · R05 · lépcső · étkező ajtó általános dugalj', add: ['D332', 'D339', 'D341', 'D345', 'D333', 'D336'] },
    // R07=A: the oven tower's second appliance on its own dedicated circuit ⚑ (asked again in ADATRETEG-Q-002)
    { ref: 'A15', name: 'Sütőtorony — 2. készülék (mikró / gőzpároló)', mcb: '1C 16A', dedicated: true, members: ['N:DT2'], src: 'válasz (R07)' }
  ],
  // shutters (not dedicated — user 2026-10-12): wall switch added beside each window, fed from the zone's lighting circuit
  shutterSwitch: true,

  // ===== answers to ALAPRETEG-Q-001 r1 (2026-10-12) =====
  maxCablesPerPipe: 3,                                                     // G01=C
  allowExtra: [{ wall: 'W7', iv: [5129, 5898], why: 'W02=A — fürdő alsó fala jóváhagyva' }],
  // edits to the sketch: new points (N:name → a real id at run time) and moves. hFix = the user's own height.
  edits: [
    // L01 — the second switch at K15 (group B end)
    { add: 'K15b', type: 'switch', kind: '106', at: 'D590', ref: 'K15b', note: 'L01: B spotcsoport váltó vége (K15 mellett, kettes keret)' },
    // L02 — K12 into a vertical triple frame with D14 + D15
    // N03: EV1 stays on the wall (the user mixed it up with a lamp); a NEW ceiling lamp instead, in D16's row, to the right
    { add: 'L28', type: 'light', code: 'LMP', var: '230', x: 5510, y: 8314, ref: 'L28', note: 'N03: fürdő mennyezeti lámpa a D16 sorában, jobbra (K14)' },
    { move: 'D349', x: 5027, y: 7350, hFix: 1171, note: 'L02: függőleges hármas keret — felső: kapcsoló (L17)' },
    { move: 'D274', x: 5027, y: 7350, hFix: 1100, note: 'L02: függőleges hármas keret — középső dugalj' },
    { move: 'D275', x: 5027, y: 7350, hFix: 1029, note: 'L02: függőleges hármas keret — alsó dugalj' },
    // L07 — K5 becomes a csillárkapcsoló for two under-cabinet work lights; L10 two-way
    { add: 'MW1', type: 'light', code: 'LMP', var: '230', x: 1900, y: 8271, ref: 'MF1', note: 'L07: munkafény a felső szekrénysor alján (pult, W9) — betáp (N04: jóváhagyva)' },
    { add: 'MW2', type: 'light', code: 'LMP', var: '230', x: 3085, y: 7550, ref: 'MF2', note: 'L07: munkafény a felső szekrénysor alján (pult, W17) — betáp (N04: jóváhagyva)' },
    { add: 'L10a', type: 'switch', kind: '106', at: 'D324', ref: 'K5b', note: 'L07: L10 váltó, a K5 mellett (kettes keret)' },
    { add: 'L10b', type: 'switch', kind: '106', x: 3400, y: 6940, ref: 'K17', note: 'L07: L10 váltó, az RBX03 melletti gerinc húzódoboz alatt' },
    // L10 — L24 two-way K4 + a second switch beside K14
    { add: 'K14b', type: 'switch', kind: '106', at: 'D375', ref: 'K14b', note: 'L10: L24 váltó, a K14 mellett (kettes keret)' },
    // L11 — living room: L1+L2 and L26 two-way at B103 + B171 (double two-way), L3 alone at B103, L15/L16 alone at B171 ⚑
    { add: 'K3b', type: 'switch', kind: '106', at: 'D259', ref: 'K3b', note: 'L11: L26 váltó (B171)' },
    { add: 'K13b', type: 'switch', kind: '106', at: 'D373', ref: 'K13b', note: 'L11: L26 váltó (B103)' },
    { add: 'K13c', type: 'switch', kind: '101', at: 'D373', ref: 'K13c', note: 'L11: L3 külön kapcsolása (B103)' },
    { add: 'K3c', type: 'switch', kind: '101', at: 'D259', ref: 'K3c', note: 'L11 + N01: L15 + L16 fali lámpák (B171)' },
    // L12 — a ceiling lamp in the pantry for K11
    { add: 'LK1', type: 'light', code: 'LMP', var: '230', x: 4596, y: 3268, ref: 'L27', note: 'L12: kamra mennyezeti lámpa (K11)' },
    // W01 — the stair lamp needs a switch at B104 ⚑ (third gang)
    { add: 'K9c', type: 'switch', kind: '101', at: 'D342', ref: 'K9c', note: 'W01 + N02: lépcsőlámpa (L23) kapcsolója a B104-nél — később váltó az emeleti ponttal' },
    // ===== answers to ADATRETEG-Q-001 r1 (2026-10-12): the old plan's open points =====
    // R01=A — the gardrób (the corner behind the old plan's slanted wall, x 5327–7092 · y 6465–7540): a ceiling lamp + a socket
    { add: 'LG1', type: 'light', code: 'LMP', var: '230', x: 5950, y: 6950, ref: 'L29', note: 'R01: gardrób mennyezeti lámpa (a régi terv ferde fala mögötti sarok) — RBXM-kimenet, fali kapcsoló nélkül ⚑' },
    { add: 'SG1', type: 'socket', code: 'SOC', x: 5327, y: 7250, ref: 'D38', note: 'R01: gardrób dugalj (W12, szoba felőli oldal)' },
    // R02=A — a socket pair beside B171 on the living-room face (they land in the portal's L3 slot)
    { add: 'S39', type: 'socket', code: 'SOC', var: '25', x: 8887, y: 6215, ref: 'D39', note: 'R02: dugaljpár a B171 mellé (nappali oldal) — a régi ajtó két dugalja helyett' },
    { add: 'S40', type: 'socket', code: 'SOC', var: '25', x: 8887, y: 6215, ref: 'D40', note: 'R02: dugaljpár a B171 mellé (nappali oldal) — a régi ajtó két dugalja helyett' },
    // R03=A — L16 is a wall lamp at 1800 like L15 (the sketch had it low)
    { move: 'D253', hFix: 1800, note: 'R03: fali lámpa 1800-on, mint az L15' },
    // R04=A — the upper shutter of the living room's double-height window column: its own motor, in its own box ⚑ height
    { add: 'SHU2N', type: 'ep', code: 'SHU', var: '230', x: 10300, y: 4420, hFix: 4300, ref: 'SHU2', note: 'R04: felső redőny (légtér) motorja, saját doboz a légtér magasságában ⚑' },
    // R06=A — the fourth worktop socket at ~2190
    { add: 'SW41', type: 'socket', code: 'SOC', var: '25', x: 2190, y: 8271, ref: 'D41', note: 'R06: negyedik pultdugalj (a régi terv 1,7–2,2 m közötti kiosztása)' },
    // R07=A — the oven tower: a second connection for the upper appliance, in the tower above it ⚑ height
    { add: 'DT2', type: 'ep', code: 'DED', var: 'g16', x: 1247, y: 8271, hFix: 2000, ref: 'DED4', note: 'R07: sütőtorony 2. csatlakozó (mikró / gőzpároló), a felső készülék fölött a toronyszekrényben' },
    // R09=A — the notes of D12 and D13 were swapped; R10=B — the island hood is a downdraft: D12 = its connection in the island cabinet
    { move: 'D273', setNote: 'Konyhasziget — pultba épített aljzat', note: 'R09: a D12 / D13 jegyzete fel volt cserélve' },
    { move: 'D272', setNote: 'Pultba süllyesztett elszívó (downdraft) — csatlakozás a szigetszekrényben', hFix: 600, note: 'R09 + R10: a főzőlap alatti szekrényben 600 ⚑' }
  ],
  // explicit switching (wins over the sketch ctl and the inference). chain[0] is the box the lamps hang from.
  // mode: single · double (105 csillár) · 2way (106 + 106) · 3way (106 + 107 … + 106)
  switchGroups: [
    { lamps: ['D245', 'D246', 'D248', 'D249'], chain: ['D590', 'D591', 'D342'], mode: '3way', why: 'L01 A csoport: K15 · K16 (B106) · K9 (B104)' },
    { lamps: ['D241', 'D242', 'D243', 'D244'], chain: ['D343', 'D335', 'N:K15b'], mode: '3way', why: 'L01 B csoport: K10 (B104) · K8 (B106) · K15b' },
    { lamps: ['N:L28'], chain: ['D375'], mode: 'single', why: 'N03: fürdő mennyezeti lámpa (L28), K14 — az EV1 a falon marad' },
    { lamps: ['D254'], chain: ['D349'], mode: 'single', why: 'L02: L17 a benti kapcsolóról (hármas keret)' },
    { lamps: ['N:MW1', 'N:MW2'], chain: ['D324'], mode: 'double', why: 'L07: K5 csillárkapcsoló — két munkafény' },
    { lamps: ['D247'], chain: ['N:L10a', 'N:L10b'], mode: '2way', why: 'L07: L10 váltó' },
    { lamps: ['D366'], chain: ['D260', 'N:K14b'], mode: '2way', why: 'L10: L24 váltó K4 + K14b' },
    { lamps: ['D238', 'D239'], chain: ['D259', 'D373'], mode: '2way', why: 'L11: L1 + L2 váltó B171 · B103' },
    { lamps: ['D461'], chain: ['N:K3b', 'N:K13b'], mode: '2way', why: 'L11: L26 váltó B171 · B103' },
    { lamps: ['D240'], chain: ['N:K13c'], mode: 'single', why: 'L11: L3 a B103-nál' },
    { lamps: ['D252', 'D253'], chain: ['N:K3c'], mode: 'single', why: 'L11 + N01: L15 + L16 a B171-nél (K3c)' },
    { lamps: ['N:LK1'], chain: ['D344'], mode: 'single', why: 'L12: kamra lámpa' },
    { lamps: ['D346'], chain: ['N:K9c'], mode: 'single', why: 'W01 + N02: lépcsőlámpa a B104-nél (K9c), később váltó az emeleti ponttal' }
  ],
  // groups fed through the floor from a service point (the island, the stair foot — W01)
  floorGroups: [
    { name: 'Sziget', sp: 'D369', object: 'O325', auto: 'island', box: { n: 'Sziget kötődoboz (a szekrényben)', h: 600 } },
    { name: 'Lépcső', sp: 'B104', room: 'R03', members: ['D345', 'D346'], box: { x: 3330, y: 4300, h: 300, n: 'Lépcsőláb kötődoboz (a W20 tövében)' } }
  ],
  // a floor crossing between the stair walls to B104 — usable by any route (travellers, feeds) (W01)
  floorLinks: [{ a: { room: 'R03L', x: 3330, y: 4300 }, b: { sp: 'B104', room: 'R03' }, n: 'Lépcsőláb — padlóátvezetés a B104-ig' }],
  // an empty riser for the later upper-floor point, with a pull box (W01)
  // N05=B: the B103 portal's 230 V box is a 150 × 150 junction box
  spBoxSize: { 'B103:R06': 150 },   // the R06 face (3-gang: L1+L2 váltó, L26 váltó, L3)
  // round-2 items the user has settled (pack 2 asks nothing more about them)
  approved: ['L15L16', 'L23', 'EV1', 'MF', 'box', 'frame'],
  // EV1 (fürdő elszívó, fali): nincs fali kapcsoló — RBX-kimenet, később páratartalom-vezérelt (válasz: A, 2026-10-12)
  rbxSwitched: { D256: 'EV1 elszívó — RBX-kimenet, páratartalom szerint (SENSOR réteg)',
    'N:LG1': 'R01: L29 gardrób — RBXM-kimenet, mozgásérzékelővel / ajtókontaktussal (SENSOR réteg) ⚑' },
  // the user's earlier plan, as a checklist (ADATRETEG.md 1, osszevetes.png)
  oldPlan: './cla.oldplan.js',
  // the user's answers to ADATRETEG-Q-001 r1 (2026-10-12) — round 2 writes ADATRETEG-Q-002 (open items only), never Q-001 again
  adatAnswers: { D01: 'A', D02: 'A', D03: 'A', D04: 'A', D05: 'A', D06: 'A', D07: 'B', D08: 'A ~ 3 s okay too', D09: 'B',
    L01: 'A', L02: 'A', L03: 'A', L04: 'A', L05: 'A', L06: 'A', L07: 'B ~ jelezd csak, hogy az folytatólagos (kb méterszámmal)', L08: 'B',
    R01: 'A', R02: 'A', R03: 'A', R04: 'A', R05: 'A', R06: 'A', R07: 'A', R08: 'A', R09: 'A', R10: 'B', R11: 'A', R12: 'X ~ Csak előkészített (de nem számolt) útvonalként' },
  // the old-plan check after the answers (item number → new status; the checklist itself stays as it was found)
  oldPlanAnswers: {
    12: { st: 'ok', now: 'L29 + D38 (gardrób)', note: 'R01: lámpa (RBXM-kimenet ⚑) + dugalj a W12-n' },
    13: { st: 'ok', now: 'D39, D40 (A13) a B171 mellett', note: 'R02: dugaljpár a nappali oldalon (L3)' },
    19: { st: 'ok', now: 'L16 (1800)', note: 'R03: fali lámpa, mint az L15' },
    27: { st: 'ok', now: 'SHU1 (D283) + SHU2 (felső, 4300 ⚑)', note: 'R04: második motor + kapcsoló (R-SHU2, kettes keret)' },
    32: { st: 'ok', now: 'D287 LED4 (LV) + L28 mennyezeti', note: 'L04: a zuhanyfal LED-je jóváhagyva' },
    36: { st: 'ok', now: 'D288 (LV) + LED3 kezdőpont, 2400', note: 'L06: a bemarás az RBX03 fölött' },
    44: { st: 'ok', now: 'MF2 (230 V) + LED1 kezdőpont', note: 'L01: a kezdőpont jóváhagyva' },
    38: { st: 'gone', now: '—', note: 'R05: nincs villamos teendő' },
    45: { st: 'gone', now: '—', note: 'L08: a szigeten nem kell LED' },
    46: { st: 'ok', now: 'D7, D8, D9, D41 (A2)', note: 'R06: a negyedik pultdugalj 2190-nél' },
    47: { st: 'ok', now: 'DED2 (A9) + DED4 (A15)', note: 'R07: két csatlakozás, két dedikált kör ⚑' },
    50: { st: 'gone', now: '—', note: 'R08: vizes radiátor — nincs villamos teendő' },
    56: { st: 'ok', now: 'D13 (pultba épített dugalj)', note: 'R09: a két jegyzet fel volt cserélve' },
    57: { st: 'ok', now: 'DED1 főzőlap + D12 downdraft-csatlakozás (600)', note: 'R10: pultba süllyesztett elszívó, a szigetszekrényben ⚑' },
    68: { st: 'ok', now: 'LED5 + folytatás ~2 m (jelölve)', note: 'L07: a szalag a fordulóban folytatódik — nem külön futás' },
    73: { st: 'gone', now: 'D17 (D277) marad', note: 'R11: a meleg víz a vízhálózatból — nincs villamos teendő' },
    78: { st: 'ok', now: 'előkészített útvonal (P1)', note: 'R12: motor + kapcsoló a B107-nél, csak előkészítés — nem számolt' } },
  // ===== Adat/PoE réteg (2026-10-12) — defaults in data.js, every one asked in ADATRETEG-Q-001 =====
  // D01–D06=A as drawn · D08=A (2 corners; the user: 3 is acceptable too) · D09=B: two empty conduits ISP → BASE
  data: { h: 2700, perPipe: 4, maxBends: 2, maxBendsOk: 3, rbxLinks: 2, usb: true, minCond: 'M20', isp: ['optika', 'koax'] },
  // D07=B: a ceiling crossing over the stair opening (x 3330–3940 the étkező's wall line breaks) — trunk and data use it
  ceilLinks: [{ room: 'R03', a: [3130, 4432], b: [3940, 4396], n: 'Mennyezeti átvezetés a lépcsőnyílás fölött (D07)', short: 'lépcsőnyílás' }],
  // R12=X: the entrance door's shutter only as a prepared route — drawn and listed, not counted (motor + switch at B107)
  prepared: [{ id: 'P1', name: 'Bejárati ajtó redőnye (B107)', why: 'R12: csak előkészített (nem számolt) útvonal', circ: 'V1',
    points: [{ room: 'R01', x: 784, y: 2988, h: 2350, code: 'SHU', ref: 'SHU-B107', n: 'redőnymotor csatlakozás, a redőnyszekrény kilincsoldali végén ⚑' },
             { room: 'R01', x: 784, y: 2988, h: 1100, code: 'SWI', v: 'shu', ref: 'R-SHU-B107', n: 'redőnykapcsoló (fel/le) — a B107 L1 helyén' }] }],
  // ===== LED-betápok: egy kezdőpont + egy plusz süllyesztett doboz LED-futásonként (2026-10-12) =====
  // at = a point on the wall face (picks the face), from / to = the run along it, h = the run's height, src = its feed
  led: [
    { id: 'LED1', name: 'Konyha — felső szekrénysor alatti LED (W17)', old: 'régi terv: „LED fények”', room: 'R03', at: [3085, 7600], from: 6940, to: 8271, h: 1450, src: 'N:MW2' },
    { id: 'LED2', name: 'Konyha — felső szekrénysor alatti LED (W9)', old: 'MF1 alapján (L07/N04) — a régi terven itt nincs LED-jel', room: 'R03', at: [1900, 8271], from: 1374, to: 3085, h: 1450, src: 'N:MW1' },
    // L06=A: the groove goes up to 2400, above the RBX03 box (it was 2100, behind the RBX at 2150)
    { id: 'LED3', name: 'Fürdő — LED-bemarás az új falban (D288)', old: 'régi terv: „→ LED”, „bemarás”', room: 'R08', at: [3600, 7140], from: 3335, to: 3960, h: 2400, src: 'D369',
      fix: 'L06: 2100 → 2400, az RBX03 doboz fölött' },
    { id: 'LED4', name: 'Fürdő — LED a zuhany falában (D287)', old: 'a vázlat LNR1 pontja (a régi terven a zuhanyfal fali lámpája)', room: 'R08', at: [3335, 7400], from: 7140, to: 7717, h: 1600, src: 'D369' },
    // L07=B: no second run — the strip only CONTINUES round the landing on the outer wall and over the pantry (the old
    // plan's line M1080,1040 V1105 H1310 V870 → plan mm); shown with its approximate length, not part of this round
    { id: 'LED5', name: 'Lépcső — LED-sor a lépcső mellett (D289)', old: 'régi terv: „LED sor a lépcső mellett”', room: 'R03L', at: [3330, 3500], from: 2390, to: 4182, h: 400, start: 4082,
      srcTxt: 'LV (A busz) — RBX03 vagy a BASE melletti pont ⚑',
      cont: { poly: [[3330, 2422], [4871, 2422], [4871, 2896]], txt: 'a fordulóban a külső falon, a kamra fölött', why: 'L07: nem külön futás, ugyanaz a szalag' } }
  ],
  risers: [{ sp: 'B104', room: 'R03', cond: 'M32', n: 'Emeleti felállás (üres cső + behúzószál) — húzódobozzal a B104-nél' }]
};
