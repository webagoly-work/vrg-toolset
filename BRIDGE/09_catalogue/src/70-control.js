// 70-control.js — the control layer's human interfaces (the former HMI layer, folded into sys:CONTROL on
// 2026-10-11) and the cross-layer FEATURES that combine sensors, lights and controls into one behaviour.
// code/var = the Planner EP_CAT entry; proposal: true = a code or variant not in EP_CAT / STD-004 yet.

const interfaces = [
 { k: 'C_portal', n: 'Portál vezérlőpont (RS-485)', code: 'POR', var: 'rs485', h: 2150, rooms: ['*'], pwr: ['bus'], note: 'A portál-szenzorok és -kimenetek gyűjtőpontja.' },
 { k: 'C_touch', n: 'Érintőpanel (PoE + LV)', code: 'PAN', var: 'touch', h: 1450, rooms: ['nappali', 'konyha', 'eloszoba', 'halo'], pwr: ['poe', 'lv'], note: 'Bejárat mellett, kilincs felől (05t-needs doorHandle).' },
 { k: 'C_entry', n: 'Belépési pont (kód, ujjlenyomat, NFC)', code: 'PAN', var: 'entry', h: 1400, rooms: ['eloszoba'], pwr: ['poe'], note: 'T3 jogosultsághoz aktív tényező (STD-003).' },
 { k: 'C_scene', n: 'Jelenetpanel (gombos)', code: 'PAN', var: 'scene', proposal: true, h: 1300, rooms: ['nappali', 'halo', 'etkezo'], pwr: ['bus'], note: 'sw_scene.' },
 { k: 'C_knob', n: 'Forgatógomb-panel', code: 'PAN', var: 'knob', proposal: true, h: 1300, rooms: ['nappali', 'halo'], pwr: ['bus', 'batt'], note: 'sw_rotary.' },
 { k: 'C_epaper', n: 'E-papír szobakijelző', code: 'DIS', var: 'epaper', proposal: true, h: 1450, rooms: ['*'], pwr: ['bus', 'batt'], note: 'Ultra alacsony fogyasztás: csak változáskor frissít; elemről hónapokig.' },
 { k: 'C_voice', n: 'Hangasszisztens-szatellit (helyi)', code: 'PAN', var: 'voice', proposal: true, h: 1450, rooms: ['nappali', 'konyha', 'halo', 'dolgozo'], pwr: ['poe', 'lv'],
   note: 'ESP32-S3 + mikrofon + hangszóró, helyi ébresztőszó; a hang nem megy felhőbe. Adatvédelmi kapcsoló kötelező.' },
 { k: 'C_tablet', n: 'Fali tablet / nagy kijelző', code: 'PAN', var: 'touch', h: 1450, rooms: ['eloszoba', 'konyha', 'nappali'], pwr: ['poe', 'usb'], note: '—' },
 { k: 'C_thermostat', n: 'Termosztát (helyiség)', code: 'THR', var: 'bus', h: 1500, rooms: ['nappali', 'halo', 'gyerek', 'dolgozo', 'furdo'], pwr: ['bus'], note: 'Belső falon, napfénytől és hőforrástól távol.' },
 { k: 'C_doorbell', n: 'Kaputelefon / videós csengő', code: 'PAN', var: 'door', proposal: true, h: 1450, rooms: ['eloszoba'], pwr: ['poe'], note: 'A belső egység a bejárat mellett; a külső a kapun / ajtón.' }
];

const features = [
 { k: 'F_occupancy', n: 'Foglaltságjelző a WC / fürdő ajtaján', layers: ['sys:BUSB', 'sys:SENSOR', 'sys:CONTROL'],
   needs: ['L_ntl', 'FLT-N', 'mmw24_pres|thermopile_array'],
   behaviour: [
     'Bent: a világítást vezérlő jelenlétérzékelő (WC: mmWave, fürdő: hőkamera-tömb, D12/D14) adja a foglalt állapotot.',
     'Kint közeledés (kapacitív / rövid ToF a tokon) → foglalt: piros ⚑, szabad: semmi vagy rövid zöld.',
     'Kopogás az ajtón vagy a tokon (gyorsulásmérő / piezo) → 3 villanás: zöld = szabad, piros ⚑ = foglalt; bent a belső értesítő fény jelez: „valaki vár”.',
     'Adatvédelem: a foglaltság csak közeledésre / kopogásra látszik, nem világít folyamatosan a lakás felé.'
   ],
   conflict: 'STD-008 a pirosat hibának és riasztásnak tartja fenn. Döntés kell: (a) foglalt = borostyán / magenta, a piros marad riasztásnak; (b) kivétel a WC / fürdő ajtón, mert a piros / zöld foglaltság egyetemesen érthető.' },
 { k: 'F_moveline', n: 'Mozgásvonal-fény (szekvenciális)', layers: ['sys:LV', 'sys:SENSOR', 'sys:BUSB'], needs: ['L_skirting', 'seqled', 'mmw24_track|tof_single|pir'],
   behaviour: ['Lásd seqled: haladási irányban egy szakasz előre, kettő mögötte, s³ áttűnés.', 'Éjjel (lux + óra) 3–10 %, meleg; nappal ki.', 'A menekülési minimum a B busz lábfényeié (L_footlight), nem az A busz vonaláé.'] },
 { k: 'F_health_air', n: 'Szobánkénti egészségügyi levegőfigyelés', layers: ['sys:SENSOR', 'sys:CONTROL'], needs: ['FLT-A|ms_air', 'co_ec'],
   behaviour: ['Minden szobában legalább egy egészségügyi szenzor (gázok: a vertikális szabály szerint).', 'Konyhán és fürdőn megerősítve (konyha: CO + hő + VOC/NOx + gázfajta; fürdő: RH + H₂S + NH₃).', 'Riasztás az értesítő fényeken (STD-008) és hangon; szellőztetés / elszívó indítása.'] },
 { k: 'F_shutter_fallback', n: 'Redőny kézi tartalék úttal', layers: ['sys:MAINS', 'sys:CONTROL'], needs: ['sw_shutter'],
   behaviour: ['A redőnymotor a legközelebbi RBX kimenetén (nem dedikált kör).', 'Mellette reteszelt fali fel / le kapcsoló — a kézi út vezérlő nélkül is működik (STD-006 manual-first).'] }
];

module.exports = { interfaces, features };
