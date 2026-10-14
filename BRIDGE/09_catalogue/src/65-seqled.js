// 65-seqled.js — the movement-line light: a continuous aluminium profile at 300 mm whose strip is split into
// 500–1000 mm segments that light in sequence, cross-fading neighbours (PWM fade-out / fade-in) under a
// direction-aware sensor. Several ways to build it, from the reference to the cheapest. RESEARCH-001 §5 explains.
//   ch    channels per metre of profile at the default segment (750 mm)
//   box   where a concealed flush box is needed            wires  conductors the profile run needs
//   cost  1 (cheapest) … 4                                 flick  STD-002 ≥ 3 kHz rule status

const rules = {
  segment: { min: 500, max: 1000, def: 750, note: 'Egész számú vágási egység (24 V szalagon jellemzően 50 / 100 mm ⚑) — a falhosszhoz igazítva.' },
  speed:   { walk: [1.0, 1.4], note: 'm/s; 750 mm-es szakasznál 0,55–0,75 s jut egy szakaszra.' },
  fade:    { ms: [400, 900], curve: 's³ (STD-002)', lead: 1, trail: 2, hold_s: 20,
             note: 'Egy szakasszal előre világít a haladás irányában, kettő marad mögötte, majd lecseng; keresztáttűnés emelt koszinusz szerint.' },
  boxes: [
    'B1 — Minden falszakasz elején és végén (sarok, portál): a profil a nyílásnál megszakad, itt kap tápot.',
    'B2 — A szakaszok között 2–4 szakaszonként (1,5–3 m) — a módszer csatornaszáma szerint (lásd box mezők).',
    'B3 — Ahol a 300 mm-es vonal Silver vagy Gold Rail szakasz alá esik, a doboz a sínből függőlegesen kapja a tápot (zsanéroldali felszálló) — ezek a legolcsóbb pontok.',
    'B4 — Lineáris betáp ≤ 5 m-enként akkor is, ha a vezérlés nem kér dobozt (feszültségesés).'
  ],
  sensing: [
    { k: 'mmw24_track', n: 'LD2450 a vonal végén, a vonal mentén nézve', why: 'Pozíció és irány egy eszközből — a fény „követi” az embert.' },
    { k: 'mmw24_pres', n: 'LD2410 a folyosó végén', why: 'Egydimenziós folyosón a mozgó cél távolsága = pozíció a vonalon; olcsóbb.' },
    { k: 'tof_single', n: 'ToF pár a portálokon (FLT-H)', why: 'Belépés iránya: honnan indul a hullám; a portálgráf számol.' },
    { k: 'pir', n: 'PIR pár a vonal két végén', why: 'A legolcsóbb: indítás és durva irány a sorrendből.' }
  ]
};

const methods = [
 { k: 'SQ1', n: 'Központi PWM, egyszínű 2-eres szakaszok', cost: 2, ch: 1.33, wires: 'N+1 (közös +, szakaszonként egy visszatérő)',
   box: 'Csak B1/B4; a vezérlő az RBX LV kártyáján (ESP32 LEDC: 16 csatorna, ≥ 3 kHz, 12 bit).',
   flick: 'ok', pro: 'Egyszerű szalag, egy vezérlő; ESPHome monochromatic + átmenet.',
   con: 'Sok ér a profil mentén (LiYY n×0,75 a profil hátsó csatornájában vagy M20-ban); hosszú vonalon a közös + feszültségesése.' },
 { k: 'SQ2', n: 'Elosztott kis vezérlők a dobozokban', cost: 2, ch: 1.33, wires: '24 V pár + (vezeték nélküli szinkron ESP-NOW ch1, vagy RS-485)',
   box: 'Doboz 4 szakaszonként (ESP32-C3: 6 LEDC csatorna, 4 MOSFET) — 750 mm-nél 3 m-enként.',
   flick: 'ok', pro: 'Rövid kábelek, moduláris, egy hiba csak egy négyest érint; flotta-firmware.', con: 'Több doboz és csomópont; az időzítés szinkronját meg kell oldani.' },
 { k: 'SQ3', n: 'Címezhető egyszínű 24 V szalag (WS2811 IC / COB)', cost: 1, ch: null, wires: '3 (+24 V, GND, adat) a teljes vonalon',
   box: 'Csak B1/B4; szakaszhossz szoftverben szabad, sima „üstökös” mozgás pixelenként.',
   flick: '⚑ az IC saját PWM-je gyakran < 3 kHz — adatlap szerint választani',
   pro: 'A legkevesebb ér, a legsimább effekt (WLED Animated Staircase, ESPHome addressable).',
   con: 'IC-nkénti nyugalmi áram; adatvonal-integritás (≤ 5 m-enként puffer); egy hibás IC után sötét (kettős adatvonalas típus segít ⚑).' },
 { k: 'SQ4', n: 'Kétsávos profil félszakaszos eltolással', cost: 3, ch: 2.67, wires: '2N+1',
   box: 'Mint SQ1/SQ2, kétszeres csatornával.', flick: 'ok',
   pro: 'Két egyszínű szalag egymás mellett, a határok fél szakasszal eltolva: az áttűnés folyamatosnak látszik, szakaszhossz-dupla felbontás.', con: 'Kétszeres csatorna, szélesebb profil.' },
 { k: 'SQ5a', n: 'CCT-vezérlő páros átúsztatóként (két egyszínű szakasz egy 3-eres betáppal)', cost: 1, ch: 1.33, wires: '3 eres kábel két szomszédos szakaszonként (+, A, B)',
   box: 'Doboz két szakaszonként (egy olcsó 2 csatornás CCT vezérlő), vagy négyenként két vezérlővel.',
   flick: '⚑ a kész vezérlő PWM-je ismeretlen — ESPHome-os sajátnál ok',
   pro: 'A felhasználó ötlete: a WW csatorna a k., a CW a k+1. szakaszt hajtja. A „színhőmérséklet” csúszka így maga az áttűnés (A→B, állandó összfénnyel), a fényerő a teljes szint. Olcsó, kész 2 csatornás hardver, 3-eres kábel.',
   con: 'A párok közötti átadás koordinációt kér (k+1 → k+2 a következő vezérlőn); Zigbee-s kész vezérlőnél csoportparancs-időzítés.' },
 { k: 'SQ5b', n: 'Valódi 3-eres CCT szalag irányjelzésre', cost: 2, ch: null, wires: '3 szakaszonként',
   box: 'Mint SQ1/SQ2.', flick: 'ok',
   pro: 'Térbeli áttűnés mellé színirány: előtte hidegebb, mögötte melegebb — a haladás iránya látható.', con: 'Egy CCT szalag két csatornája egymásba fésült, térben nem bontható: a szakaszolást ez nem váltja ki.' },
 { k: 'SQ5c', n: '2-eres CCT szalag (ellenpárhuzamos LED-ek)', cost: 2, ch: 1.33, wires: '2 szakaszonként',
   box: 'Mint SQ1/SQ2; H-híd meghajtó szakaszonként.', flick: '⚑ polaritásváltó meghajtó',
   pro: 'CCT két érrel — érszám-takarékos.', con: 'Különleges meghajtó; ESPHome-ban egyedi megoldás.' },
 { k: 'SQ6', n: 'Kész lépcsővilágítás-vezérlő (16–32 csatorna, 2 PIR bemenet)', cost: 1, ch: 1.33, wires: 'N+1 a vezérlőtől',
   box: 'Egy vezérlő egy dobozban (B1).', flick: '⚑ ismeretlen',
   pro: 'Nagyon olcsó; a BRIDGE optocsatolós kimenettel „PIR-ként” indítja — az irányt a BRIDGE szenzorai döntik el.', con: 'Zárt, rögzített áttűnési görbe, villogás ismeretlen; bistabil kézi út nincs.' },
 { k: 'SQ7', n: 'I²C PWM bővítő (PCA9685)', cost: 1, ch: 1.33, wires: 'N+1',
   box: 'Mint SQ1.', flick: 'NEM — a PCA9685 kb. 1,5 kHz-ig megy, sérti a ≥ 3 kHz szabályt',
   pro: 'Olcsó, 16 csatorna.', con: 'STD-002 szerint kizárva fényhez; más bővítőnél (TLC59xx) a frekvenciát adatlapból ellenőrizni ⚑.' }
];

module.exports = { rules, methods };
