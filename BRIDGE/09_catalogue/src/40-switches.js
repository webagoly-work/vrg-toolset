// 40-switches.js — switch and control-input types, hidden and special ones included
// hidden: true = not visible as a switch when closed / behind a finish. pwr = how it is fed (vocab.power).
// bridge: where it lands (EP_CAT code + var); in BRIDGE every manual input is an RBX input (Q29), the bistable
// keeps the manual path alive without the controller (manual-first, STD-006).

module.exports = [
 // ---- classic ----
 { k: 'sw_rocker', n: 'Billenő kapcsoló / nyomó (230 V, RC-szűrt)', hidden: false, pwr: ['mains'], mount: 'süllyesztett doboz', h: 1100,
   rooms: ['*'], pro: 'Mindenki érti; a BRIDGE-DN bistabil bemenetére megy.', con: 'Látható, 230 V a falban.', bridge: { code: 'SWI', var: '230' } },
 { k: 'sw_push_selv', n: 'SELV nyomógomb → bistabil bemenet', hidden: false, pwr: ['bus'], mount: 'süllyesztett doboz', h: 1100,
   rooms: ['*'], pro: 'Vékony kábel, biztonságos, több gomb egy kábelen.', con: 'Bemeneti modul kell az RBX-ben.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_shutter', n: 'Redőnykapcsoló (fel / le, reteszelt)', hidden: false, pwr: ['mains', 'bus'], mount: 'süllyesztett doboz, ablak mellett', h: 1100,
   rooms: ['nappali', 'halo', 'gyerek', 'konyha', 'etkezo', 'dolgozo'],
   pro: 'Tartalék kézi út: a redőny vezérlés nélkül is mozgatható (2026-10-11: a redőny NEM dedikált kör, a legközelebbi RBX-en át fut).',
   con: 'Csak kölcsönösen reteszelt gomb — a motor két iránya nem kaphat egyszerre feszültséget.', bridge: { code: 'SWI', var: 'shu', proposal: true } },
 { k: 'sw_toggle', n: 'Karos (retro) kapcsoló', hidden: false, pwr: ['mains', 'bus'], mount: 'süllyesztett / falon kívüli', h: 1100,
   rooms: ['nappali', 'dolgozo', 'kamra'], pro: 'Karakteres, tapintással látható állapot.', con: 'Állapota ellentmondhat az automatikának — nyomógombos változat jobb.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_rotary', n: 'Forgatógomb / végtelenített enkóder', hidden: false, pwr: ['bus', 'batt'], mount: 'süllyesztett doboz', h: 1100,
   rooms: ['nappali', 'halo', 'etkezo'], pro: 'Fényerő, hangerő, színhőmérséklet egy mozdulattal.', con: 'Drágább bemenet; elemes változat késleltet.', bridge: { code: 'PAN', var: 'knob', proposal: true } },
 { k: 'sw_scene', n: 'Többgombos jelenetpanel', hidden: false, pwr: ['bus', 'poe'], mount: 'süllyesztett doboz', h: 1300,
   rooms: ['nappali', 'halo', 'eloszoba', 'konyha'], pro: 'Jelenetek (STD-002 öt réteg) egy helyen.', con: 'Felirat / ikon nélkül nem érthető.', bridge: { code: 'PAN', var: 'scene', proposal: true } },
 { k: 'sw_touch_glass', n: 'Üveg érintőpanel', hidden: false, pwr: ['bus', 'lv'], mount: 'süllyesztett doboz', h: 1300,
   rooms: ['nappali', 'halo', 'furdo'], pro: 'Tisztítható, modern.', con: 'Nincs tapintható visszajelzés; vak kezelés nehéz.', bridge: { code: 'PAN', var: 'touch' } },
 // ---- hidden ----
 { k: 'sw_hidden_cap', n: 'Rejtett kapacitív kapcsoló (fa / kő / csempe mögött)', hidden: true, pwr: ['lv', 'bus'], mount: 'burkolat mögé ragasztva', h: 1100,
   rooms: ['*'], pro: 'Láthatatlan; a burkolaton jelölés (gravírozás, intarzia) mutatja a helyét. Bútorvilágításhoz kész 12/24 V modulok.',
   con: 'Vastagság ~ 10–25 mm-ig ⚑, nedvesség és fém zavarja; idegen nem találja.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_plaster', n: 'Glettelhető, keret nélküli kapcsoló', hidden: true, pwr: ['mains', 'bus'], mount: 'falsíkba glettelt keret', h: 1100,
   rooms: ['nappali', 'halo', 'eloszoba'], pro: 'A kapcsoló a fal része, csak a gomb látszik.', con: 'Drága, a gipszkartonos szakágat igényli.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_push_furniture', n: 'Bútorba rejtett mikrogomb (push-to-open mintára)', hidden: true, pwr: ['lv', 'bus', 'batt'], mount: 'bútorlap / polc éle', h: null,
   rooms: ['konyha', 'nappali', 'halo', 'gardrob'], pro: 'Ott kapcsol, ahol keresed (ágytámla, polc, pult).', con: 'Bútorasztalossal egyeztetni.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_magnet', n: 'Mágneses rejtett kapcsoló (reed a burkolat mögött)', hidden: true, pwr: ['bus', 'batt'], mount: 'burkolat mögött', h: null,
   rooms: ['dolgozo', 'nappali', 'gardrob'], pro: 'Titkos funkció: mágnest kell a jelre tartani (pl. széf, rejtett rekesz).', con: 'Játékos, ritkán indokolt.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_wave', n: 'Kézlegyintéses (IR / radar) kapcsoló', hidden: true, pwr: ['lv'], mount: 'pult alá, profil végébe', h: null,
   rooms: ['konyha', 'furdo', 'gardrob'], pro: 'Érintés nélkül, lisztes / vizes kézzel.', con: 'Véletlen kapcsolás; radaros a bútorlapon át is lát.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_door_contact', n: 'Ajtó / fiók működtetésű kapcsoló', hidden: true, pwr: ['lv', 'bus'], mount: 'szekrényajtó, fiók, kamraajtó tokja', h: null,
   rooms: ['gardrob', 'kamra', 'konyha', 'eloszoba', 'tarolo'], pro: 'Nyitásra fény — nincs mit keresni.', con: 'Nyitva felejtve ég (időkorlát kell).', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_kick', n: 'Lábazati (rúgó / lábfej-érzékelős) kapcsoló', hidden: true, pwr: ['lv'], mount: 'konyhai lábazat', h: 100,
   rooms: ['konyha', 'furdo'], pro: 'Tele kézzel is: lábazati fény, kuka, elszívó.', con: 'Takarításkor véletlen kapcsolás.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_knock', n: 'Kopogásra kapcsoló felület (gyorsulásmérő)', hidden: true, pwr: ['lv', 'batt'], mount: 'asztal / falburkolat / ajtótok mögött', h: null,
   rooms: ['halo', 'nappali', 'wc', 'furdo'], pro: 'Kettő-három koppintás = jelenet; WC / fürdő ajtón a foglaltságjelző indítója.', con: 'Mintafelismerést hangolni kell.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_pullcord', n: 'Húzózsinóros kapcsoló', hidden: false, pwr: ['mains', 'bus'], mount: 'mennyezet', h: null,
   rooms: ['furdo'], pro: 'Vizes zónán kívül szerelve, vizes kézzel biztonságos; SOS-ként is.', con: 'Magyar lakásban szokatlan.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_sos', n: 'Vészhívó / SOS gomb', hidden: false, pwr: ['bus', 'batt'], mount: 'ágy mellett, fürdőben alacsonyan', h: 400,
   rooms: ['halo', 'furdo', 'wc'], pro: 'Elesett ember is eléri (alacsony változat).', con: 'Téves riasztás — megerősítő folyamat kell.', bridge: { code: 'SEC', var: 'keypad' } },
 { k: 'sw_keycard', n: 'Kártyás (hotel) kapcsoló', hidden: false, pwr: ['mains', 'bus'], mount: 'bejárat', h: 1100,
   rooms: ['eloszoba'], pro: 'Elmenőben mindent lekapcsol; vendéglakásnál bevett.', con: 'Otthon kényelmetlen — a távozáskori ellenőrzés (K34/2) jobb.', bridge: { code: 'SWI', var: 'selv' } },
 { k: 'sw_keyswitch', n: 'Kulcsos kapcsoló', hidden: false, pwr: ['bus'], mount: 'süllyesztett', h: 1100,
   rooms: ['gepesz', 'eloszoba'], pro: 'Szerviz / karbantartó mód, riasztó kézi tiltása.', con: '—', bridge: { code: 'SWI', var: 'selv' } },
 // ---- wireless ----
 { k: 'sw_kinetic', n: 'Elem nélküli kinetikus kapcsoló', hidden: false, pwr: ['harvest'], mount: 'ragasztva bárhová', h: 1100,
   rooms: ['*'], pro: 'Nincs elem, nincs kábel (EnOcean, Zigbee Green Power, Hue Tap jellegű).', con: 'Csak ott, ahol a rádió eléri; nem a kézi-elsőbbség bistabil útja.', bridge: { code: 'SWI', var: 'rf', proposal: true } },
 { k: 'sw_wireless_btn', n: 'Elemes vezeték nélküli gomb', hidden: false, pwr: ['batt'], mount: 'ragasztva / mágnessel', h: null,
   rooms: ['*'], pro: 'Ágy mellé, kanapéra, utólag bárhová; CR2032-ről években ⚑.', con: 'Elemcsere; eltűnik.', bridge: { code: 'SWI', var: 'rf', proposal: true } },
 { k: 'sw_cube', n: 'Gesztus-kocka / forgatható távvezérlő', hidden: false, pwr: ['batt'], mount: 'asztalon', h: null,
   rooms: ['nappali', 'halo', 'dolgozo'], pro: 'Játékos jelenetválasztás.', con: 'Nem mindenkinek intuitív.', bridge: { code: 'SWI', var: 'rf', proposal: true } },
 { k: 'sw_remote', n: 'Kézi távirányító (IR / RF / Zigbee)', hidden: false, pwr: ['batt'], mount: 'tartó a falon', h: 1100,
   rooms: ['nappali', 'halo'], pro: 'Megszokott; IR átjáróval régi eszközök is.', con: 'Elkallódik.', bridge: { code: 'SWI', var: 'rf', proposal: true } }
];
