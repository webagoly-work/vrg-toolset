// 50-lighting.js — lighting building blocks (main / supplementary / ambient / path / notification) and how BRIDGE
// drives each with ESPHome. bus: which family carries it. drive: the ESPHome light platform it maps onto.
// STD-002 rules apply to all: PWM ≥ 3 kHz, perceptual dimming duty = s³, two-channel tunable white 2700 + 4000 K,
// Duv −0.004…+0.002, no DALI in v1, the bistable relay keeps manual-first.

const drives = {
  relay:     { n: 'Bistabil relé (230 V)', esphome: 'switch / light: binary + output: gpio (BRIDGE-DN)' },
  mono:      { n: 'Egyszínű PWM', esphome: 'light: monochromatic + output: ledc (≥ 3 kHz)' },
  cct:       { n: 'Hangolható fehér, 2 csatorna', esphome: 'light: cwww / color_temperature + 2× ledc' },
  rgbww:     { n: 'RGB + 2 fehér', esphome: 'light: rgbww + 5× ledc' },
  addr:      { n: 'Címezhető szalag', esphome: 'light: esp32_rmt_led_strip (WS2811 / WS2814 / SK6812)' },
  driver24:  { n: '24 V CV tápegység + PWM', esphome: 'light: monochromatic / cwww a RBX LV kártyáján' },
  retrofit:  { n: 'Utólagos rádiós lámpa', esphome: '— (Zigbee / Thread / Matter, HA-n át)' }
};

const items = [
 // ---- MAIN (fővilágítás) ----
 { k: 'L_ceiling', kind: 'main', n: 'Mennyezeti / felületi lámpa (230 V)', bus: 'MAINS', drive: 'relay', code: 'LMP', rooms: ['*'],
   note: 'Az alap: bistabil relé, kézi elsőbbség. Fényerő a lámpa saját meghajtójával vagy utólagos rádiós lámpával.' },
 { k: 'L_downlight24', kind: 'main', n: 'Süllyesztett spotok 24 V-on (CV, PWM)', bus: 'LV', drive: 'cct', code: 'LNR', rooms: ['konyha', 'etkezo', 'furdo', 'kozlekedo', 'nappali'],
   note: 'Álmennyezetben; hangolható fehér, s³ dimmelés, közös 24 V táp az RBX-ben.' },
 { k: 'L_track48', kind: 'main', n: '48 V mágneses sín', bus: 'LV', drive: 'cct', code: 'LNR', rooms: ['nappali', 'konyha', 'etkezo', 'dolgozo'],
   note: 'Modern trend: modulok (spot, lineáris, függő) szabadon áthelyezhetők. 48 V tápot kér — saját tápegység ⚑, a 24 V busz nem viszi.' },
 { k: 'L_linear', kind: 'main', n: 'Függesztett / süllyesztett lineáris lámpa', bus: 'LV', drive: 'cct', code: 'LNR', rooms: ['konyha', 'dolgozo', 'etkezo', 'nappali'],
   note: 'Munkafény egyenletesen; alu profil + opál bura.' },
 { k: 'L_pendant', kind: 'main', n: 'Függőlámpa asztal / sziget fölé', bus: 'MAINS', drive: 'relay', code: 'LMP', rooms: ['etkezo', 'konyha', 'nappali'],
   note: 'Asztal fölött 650–750 mm-rel; 24 V-os változat hangolható fehérrel.' },
 { k: 'L_panel', kind: 'main', n: 'LED panel (hangolható fehér)', bus: 'LV', drive: 'cct', code: 'LNR', rooms: ['dolgozo', 'gyerek', 'kamra', 'tarolo'],
   note: 'Egyenletes, olcsó; cirkadián fényhez jó.' },
 // ---- SUPPLEMENTARY (kiegészítő) ----
 { k: 'L_wall', kind: 'extra', n: 'Fali lámpa (fel / le)', bus: 'MAINS', drive: 'relay', code: 'LMP', rooms: ['nappali', 'halo', 'kozlekedo', 'lepcso', 'terasz'],
   note: 'P33 nappali: két fali lámpa a déli falon (tervrajz).' },
 { k: 'L_reading', kind: 'extra', n: 'Olvasólámpa / ágytámla spot (24 V)', bus: 'LV', drive: 'mono', code: 'LNR', rooms: ['halo', 'gyerek', 'nappali'],
   note: 'Keskeny nyaláb, saját kapcsoló az ágynál; P33 R07 két éjjeli lámpa + kapcsoló.' },
 { k: 'L_undercab', kind: 'extra', n: 'Pultvilágítás felső szekrény alatt', bus: 'LV', drive: 'cct', code: 'LNR', rooms: ['konyha'],
   note: 'Munkafény 4000 K felé, árnyékmentes; profil a szekrény elülső élén.' },
 { k: 'L_mirror', kind: 'extra', n: 'Tükörvilágítás', bus: 'LV', drive: 'cct', code: 'LNR', rooms: ['furdo', 'wc', 'eloszoba'],
   note: 'Arcmagasságban oldalról / körben; P33 fürdő „konnektor + tükör lámpa”.' },
 { k: 'L_picture', kind: 'extra', n: 'Képvilágító / galéria spot', bus: 'LV', drive: 'mono', code: 'LNR', rooms: ['nappali', 'kozlekedo', 'etkezo'], note: 'Magas CRI (≥ 95).' },
 { k: 'L_socket_lamp', kind: 'extra', n: 'Álló- / asztali lámpa kapcsolt dugaljon', bus: 'MAINS', drive: 'relay', code: 'SOC', rooms: ['nappali', 'halo', 'dolgozo'],
   note: 'A dugaljkör egy kapcsolt ága — a hordozható lámpa is a jelenet része.' },
 { k: 'L_desk', kind: 'extra', n: 'Íróasztal-világítás', bus: 'LV', drive: 'cct', code: 'LNR', rooms: ['dolgozo', 'gyerek'], note: 'Cirkadián: napközben hidegebb.' },
 // ---- AMBIENT (hangulatfény) ----
 { k: 'L_cove', kind: 'ambient', n: 'Rejtett mennyezeti / koronapárkány fény', bus: 'LV', drive: 'cct', code: 'LNR', rooms: ['nappali', 'halo', 'etkezo', 'kozlekedo'],
   note: 'A magas sáv ZW-o vonalán fut — ugyanabban a sávban, mint a Silver Rail, tehát a tápja „ingyen” jön a sínből.' },
 { k: 'L_plinth', kind: 'ambient', n: 'Lábazati fény (konyha, fürdőbútor)', bus: 'LV', drive: 'mono', code: 'LNR', rooms: ['konyha', 'furdo', 'eloszoba'],
   note: 'Éjjel tájékozódó fény, nem vakít; mozgásra.' },
 { k: 'L_shelf', kind: 'ambient', n: 'Polc- / vitrinvilágítás', bus: 'LV', drive: 'mono', code: 'LNR', rooms: ['nappali', 'konyha', 'dolgozo', 'etkezo'], note: '—' },
 { k: 'L_tvback', kind: 'ambient', n: 'Médiafal háttérfény', bus: 'LV', drive: 'rgbww', code: 'LNR', rooms: ['nappali', 'halo'],
   note: 'Szemkímélő kontraszt; képhez szinkron (címezhető) opció.' },
 { k: 'L_bedglow', kind: 'ambient', n: 'Ágy alatti derengés', bus: 'LV', drive: 'mono', code: 'LNR', rooms: ['halo', 'gyerek'],
   note: 'Éjszakai felkeléskor 1–5 % meleg fény, ágy-szenzorra.' },
 { k: 'L_niche', kind: 'ambient', n: 'Zuhanyfülke / fali fülke fény', bus: 'LV', drive: 'cct', code: 'LNR', rooms: ['furdo'], note: 'IP67, SELV a vizes zónában.' },
 { k: 'L_wardrobe', kind: 'ambient', n: 'Szekrénybelső fény', bus: 'LV', drive: 'mono', code: 'LNR', rooms: ['gardrob', 'eloszoba', 'halo', 'kamra'], note: 'Ajtónyitásra (sw_door_contact).' },
 { k: 'L_islandglow', kind: 'ambient', n: 'Konyhasziget alá / túlnyúlás alá fény', bus: 'LV', drive: 'mono', code: 'LNR', rooms: ['konyha'], note: 'P33: a szigeten pultba épített rész, éjjeli derengés.' },
 { k: 'L_window', kind: 'ambient', n: 'Ablakkáva / párkány fény', bus: 'LV', drive: 'cct', code: 'LNR', rooms: ['nappali', 'halo'], note: 'A redőny mögött este is „élő” ablak.' },
 { k: 'L_portalhalo', kind: 'ambient', n: 'Portál-keret fény', bus: 'LV', drive: 'addr', code: 'LNR', rooms: ['*'], note: 'Az ajtókeret jelzi az átjárót — a SmartFrame látható jele.' },
 // ---- PATH / MOVEMENT LINE (mozgásvonal) ----
 { k: 'L_skirting', kind: 'path', n: 'Mozgásvonal: alacsony fali profil (300 mm)', bus: 'LV', drive: 'mono', code: 'LNR', rooms: ['konyha', 'etkezo', 'nappali', 'halo', 'kozlekedo', 'furdo'],
   note: 'Belső falak mentén, szakaszolt profil szekvenciális áttűnéssel — lásd seqled. Kényelmi funkció az A buszon; a menekülési része a B buszra kerül.' },
 { k: 'L_step', kind: 'path', n: 'Lépcsőfény / lépcső melletti LED sor', bus: 'BUSB', drive: 'mono', code: 'LNR', rooms: ['lepcso'],
   note: 'Biztosított B busz (menekülés). P33: „LED sor a lépcső mellett”.' },
 { k: 'L_footlight', kind: 'path', n: 'Süllyesztett lábfény (falba)', bus: 'BUSB', drive: 'mono', code: 'LMP', rooms: ['kozlekedo', 'halo', 'furdo', 'eloszoba', 'lepcso'],
   note: 'B busz, 300 mm, éjszakai útvonal mentén (05t-needs: traceTag „ejszakai”).' },
 // ---- NOTIFICATION ----
 { k: 'L_ntl', kind: 'notify', n: 'Értesítő fény (NTL, 4 RGBW pixel)', bus: 'BUSB', drive: 'addr', code: 'NTL', rooms: ['*'],
   note: 'STD-008: szemmagasság 1100–1200, minden portál mellett. WC / fürdő ajtón foglaltságjelző (FLT-N).' }
];

module.exports = { drives, items };
