// 60-abus.js — what bus A (LV, convenience 24 V, STD-002 BRIDGE-LX split) is good for, and the ideal points
// Bus A = convenience: it may go dark with the controller; anything that must work in a power cut or for egress
// belongs on bus B (assured), never here. pts = typical points (zone + height + where), segment = linear run.

const uses = [
 { k: 'A_cove', n: 'Rejtett mennyezeti fény', light: 'L_cove', segment: true, zone: 'high', h: '≈ 2450–2700 (ZW-o sáv)',
   pts: 'Körbe a szoba két-négy falán, a Silver Rail fölött / mellett; táp a sínből a portálnál.', rooms: ['nappali', 'halo', 'etkezo', 'kozlekedo'] },
 { k: 'A_undercab', n: 'Pultvilágítás', light: 'L_undercab', segment: true, zone: 'furniture', h: '≈ 1400–1500 (felső szekrény alja)',
   pts: 'Felső szekrénysor elülső éle; betáp a szekrénysor egyik végén, a fal mögül.', rooms: ['konyha'] },
 { k: 'A_plinth', n: 'Lábazati fény', light: 'L_plinth', segment: true, zone: 'floor', h: '80–150',
   pts: 'Konyhabútor és fürdőbútor lábazata; betáp a lábazat mögötti alacsony dobozból (200–300).', rooms: ['konyha', 'furdo'] },
 { k: 'A_island', n: 'Sziget alatti fény', light: 'L_islandglow', segment: true, zone: 'furniture', h: '100–200 / túlnyúlás alja',
   pts: 'A sziget padlócsatlakozásán át (padló-pálya, vegyes vezetés).', rooms: ['konyha'] },
 { k: 'A_shelf', n: 'Polc- és vitrinfény', light: 'L_shelf', segment: true, zone: 'furniture', h: 'polconként',
   pts: 'Polc hátoldala / homlokéle; betáp a bútor mögötti dobozból.', rooms: ['nappali', 'konyha', 'dolgozo'] },
 { k: 'A_tvback', n: 'Médiafal háttérfény', light: 'L_tvback', segment: true, zone: 'mid', h: 'képernyő mögött 900–1500',
   pts: 'A képernyő (SCR) dobozából; a médiafal saját doboza.', rooms: ['nappali', 'halo'] },
 { k: 'A_headboard', n: 'Ágytámla olvasó-spot és derengés', light: 'L_reading', segment: false, zone: 'mid', h: '900–1100 ágytámla, 150 ágy alatt',
   pts: 'Ágy két oldalán az éjjeliszekrény fölött; ugyanabból a dobozból az ágy alatti derengés.', rooms: ['halo', 'gyerek'] },
 { k: 'A_mirror', n: 'Tükörvilágítás és párátlanító', light: 'L_mirror', segment: false, zone: 'mid', h: '1600–2000 a tükör mögött',
   pts: 'Tükör mögötti doboz; a párátlanító fólia is innen (24 V változat).', rooms: ['furdo', 'wc'] },
 { k: 'A_niche', n: 'Fülke- és zuhanyfény', light: 'L_niche', segment: true, zone: 'mid', h: 'fülke teteje',
   pts: 'SELV, IP67, a vizes zónán kívüli betáppal.', rooms: ['furdo'] },
 { k: 'A_wardrobe', n: 'Szekrénybelső fény', light: 'L_wardrobe', segment: true, zone: 'furniture', h: 'ajtókeret belül',
   pts: 'Ajtónyitásra; betáp a szekrény tetején / mögött.', rooms: ['gardrob', 'eloszoba', 'halo', 'kamra'] },
 { k: 'A_skirting', n: 'Mozgásvonal-profil (300 mm)', light: 'L_skirting', segment: true, zone: 'low', h: '300',
   pts: 'Belső falak mentén; doboz minden fal végén, portálnál, és 2–4 szakaszonként (seqled).', rooms: ['konyha', 'etkezo', 'nappali', 'halo', 'kozlekedo', 'furdo'] },
 { k: 'A_picture', n: 'Kép- és galériafény', light: 'L_picture', segment: false, zone: 'high', h: 'kép fölött 1900–2100', pts: 'Kép fölötti doboz.', rooms: ['nappali', 'kozlekedo', 'etkezo'] },
 { k: 'A_usbc', n: 'USB-C PD töltőpont (UEP usbc)', light: null, segment: false, zone: 'low', h: '300 / éjjeliszekrény 700',
   pts: 'Dugalj mellé, ágy mellé, íróasztalhoz — 24 V-ról PD modullal (STD-007: tápot külön az adattól).', rooms: ['halo', 'gyerek', 'dolgozo', 'nappali', 'konyha'] },
 { k: 'A_sensor_node', n: 'Szenzorcsomópontok tápja', light: null, segment: false, zone: 'ceiling', h: '—',
   pts: 'Mennyezeti és portál-szenzorok (ha nem a szenzorkábelről kapnak tápot).', rooms: ['*'] },
 { k: 'A_dcmotor', n: '24 V DC motoros függöny / roló', light: null, segment: false, zone: 'high', h: 'karnis végén 2400–2700',
   pts: 'Karnis egyik vége; biztonságosabb és halkabb, mint a 230 V-os.', rooms: ['nappali', 'halo', 'gyerek'] },
 { k: 'A_valve', n: 'Motoros vízelzáró (vízőr)', light: null, segment: false, zone: 'low', h: 'a főelzáró mellett',
   pts: 'A strangzóna (R02/R08 fal) — K34/1 opció.', rooms: ['gepesz', 'konyha', 'furdo'] },
 { k: 'A_lock', n: 'Elektromos zár / zárfogadó, kaputelefon', light: null, segment: false, zone: 'mid', h: 'ajtótok',
   pts: 'Bejárati ajtó; az életvédelmi nyitás a biztonsági logikáé (STD-006 alarm_type).', rooms: ['eloszoba'] },
 { k: 'A_fan', n: 'EC ventilátor (fürdő / WC elszívó, 24 V)', light: null, segment: false, zone: 'high', h: 'mennyezet / fal fent',
   pts: 'RH / H₂S / NH₃ vezérelt; csendes, fokozatmentes.', rooms: ['furdo', 'wc', 'kamra', 'mosokonyha'] },
 { k: 'A_window_light', n: 'Ablakkáva-fény', light: 'L_window', segment: true, zone: 'high', h: 'káva felső éle',
   pts: 'A redőnyszekrény alatt; a redőnymotor dobozából.', rooms: ['nappali', 'halo'] },
 { k: 'A_outdoor', n: 'Kültéri 24 V világítás (IP67)', light: null, segment: true, zone: 'outdoor', h: '—',
   pts: 'Terasz korlát / padló / homlokzat; 230 V nélkül a kültéren.', rooms: ['terasz', 'kert'] },
 { k: 'A_grow', n: 'Növényvilágítás', light: null, segment: false, zone: 'furniture', h: 'polc fölött', pts: 'Ablak melletti polc.', rooms: ['nappali', 'konyha', 'terasz'] }
];

// typical points / segments for secondary (ambient) light — the general list the CLA marks (F4) are drawn from
const ambientPoints = [
 { k: 'AP_ceiling_perim', n: 'Mennyezeti kerület (koronapárkány)', type: 'segment', zone: 'high', rooms: ['nappali', 'halo', 'etkezo'] },
 { k: 'AP_above_upper', n: 'Felső konyhaszekrények teteje', type: 'segment', zone: 'high', rooms: ['konyha'] },
 { k: 'AP_under_upper', n: 'Felső konyhaszekrények alja', type: 'segment', zone: 'furniture', rooms: ['konyha'] },
 { k: 'AP_kitchen_plinth', n: 'Konyhai lábazat', type: 'segment', zone: 'floor', rooms: ['konyha'] },
 { k: 'AP_island', n: 'Sziget alja / túlnyúlás', type: 'segment', zone: 'furniture', rooms: ['konyha'] },
 { k: 'AP_media_wall', n: 'Médiafal mögött', type: 'segment', zone: 'mid', rooms: ['nappali', 'halo'] },
 { k: 'AP_bookshelf', n: 'Könyvespolc / vitrin', type: 'segment', zone: 'furniture', rooms: ['nappali', 'dolgozo'] },
 { k: 'AP_headboard', n: 'Ágytámla mögött', type: 'segment', zone: 'mid', rooms: ['halo', 'gyerek'] },
 { k: 'AP_bed_under', n: 'Ágy alatt', type: 'segment', zone: 'floor', rooms: ['halo', 'gyerek'] },
 { k: 'AP_wardrobe', n: 'Gardrób / beépített szekrény belül', type: 'segment', zone: 'furniture', rooms: ['gardrob', 'eloszoba', 'halo'] },
 { k: 'AP_mirror', n: 'Tükör mögött', type: 'segment', zone: 'mid', rooms: ['furdo', 'wc', 'eloszoba'] },
 { k: 'AP_vanity_plinth', n: 'Fürdőbútor alatt', type: 'segment', zone: 'floor', rooms: ['furdo'] },
 { k: 'AP_shower_niche', n: 'Zuhany / fali fülke', type: 'point', zone: 'mid', rooms: ['furdo'] },
 { k: 'AP_wc_back', n: 'WC mögötti fal (előtétfal felső éle)', type: 'segment', zone: 'mid', rooms: ['wc'] },
 { k: 'AP_stair', n: 'Lépcsőfokok / lépcső melletti sor', type: 'segment', zone: 'low', rooms: ['lepcso'] },
 { k: 'AP_window', n: 'Ablakkáva / párkány', type: 'segment', zone: 'high', rooms: ['nappali', 'halo'] },
 { k: 'AP_portal', n: 'Ajtókeret (portál)', type: 'segment', zone: 'high', rooms: ['*'] },
 { k: 'AP_skirting', n: 'Mozgásvonal (300 mm, belső falak)', type: 'segment', zone: 'low', rooms: ['konyha', 'etkezo', 'nappali', 'halo', 'kozlekedo', 'furdo'] },
 { k: 'AP_picture', n: 'Kép / műtárgy', type: 'point', zone: 'high', rooms: ['nappali', 'kozlekedo', 'etkezo'] },
 { k: 'AP_void', n: 'Légtér (galéria korlát alja, felső szint felé)', type: 'segment', zone: 'high', rooms: ['nappali'] },
 { k: 'AP_terrace', n: 'Terasz korlát / padló', type: 'segment', zone: 'outdoor', rooms: ['terasz'] }
];

module.exports = { uses, ambientPoints };
