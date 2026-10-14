// 95-ulp.js — ultra-low-power, battery or energy-harvesting devices, one list across every category
// BRIDGE stance: battery devices go where a cable cannot (door leaf, window sash, furniture, retrofit, outdoors) or
// where they are the safer product (10-year sealed smoke / CO alarms). Anything safety-relevant must be SUPERVISED:
// a missing heartbeat is itself an alarm. life = typical, vendor-dependent ⚑.
//   radio: zigbee (sleepy end device) · thread (SED/SSED) · ble · enocean (harvesting) · espnow · wifi (deep sleep)

module.exports = [
 { k: 'U_contact', n: 'Nyitásérzékelő', cat: 'sensor', radio: ['zigbee', 'thread', 'ble'], cell: 'CR2032 / CR1632', life: '1–3 év', ref: 'reed', rooms: ['*'] },
 { k: 'U_th', n: 'Hő- / páramérő (kijelzővel is)', cat: 'sensor', radio: ['ble', 'zigbee', 'thread'], cell: 'CR2032 / 2×AAA', life: '1–2 év (BLE, pvvx firmware)', ref: 'temp', rooms: ['*'] },
 { k: 'U_pir', n: 'PIR mozgásérzékelő', cat: 'sensor', radio: ['zigbee', 'thread'], cell: 'CR2450 / CR123A', life: '1–3 év', ref: 'pir', rooms: ['*'] },
 { k: 'U_leak', n: 'Szivárgásérzékelő', cat: 'sensor', radio: ['zigbee', 'thread'], cell: 'CR2032 / AAA', life: '2–5 év', ref: 'leak_spot', rooms: ['konyha', 'furdo', 'wc', 'mosokonyha', 'gepesz'] },
 { k: 'U_vibration', n: 'Rezgés- / döntésérzékelő', cat: 'sensor', radio: ['zigbee'], cell: 'CR2032', life: '1–2 év', ref: 'accel', rooms: ['*'] },
 { k: 'U_lux', n: 'Fényérzékelő', cat: 'sensor', radio: ['zigbee', 'thread'], cell: 'CR2032 / CR2450', life: '1–2 év', ref: 'lux', rooms: ['*'] },
 { k: 'U_smoke', n: 'Füstriasztó, 10 éves zárt Li', cat: 'safety', radio: ['zigbee', 'none'], cell: 'beépített Li 10 év', life: '10 év (készülékcsere)', ref: 'smoke_opt', rooms: ['halo', 'gyerek', 'nappali', 'kozlekedo', 'eloszoba'] },
 { k: 'U_co', n: 'CO-riasztó, 10 éves zárt Li', cat: 'safety', radio: ['zigbee', 'none'], cell: 'beépített Li', life: '7–10 év (cella élettartam)', ref: 'co_ec', rooms: ['halo', 'nappali', 'konyha', 'gepesz'] },
 { k: 'U_radon', n: 'Radonmérő', cat: 'sensor', radio: ['ble'], cell: '2×AAA', life: '1–2 év', ref: 'radon', rooms: ['nappali', 'halo'] },
 { k: 'U_soil', n: 'Talajnedvesség', cat: 'sensor', radio: ['ble', 'zigbee'], cell: 'CR2032 / AAA', life: '1 év', ref: 'soil', rooms: ['terasz', 'kert'] },
 { k: 'U_button', n: 'Vezeték nélküli gomb', cat: 'control', radio: ['zigbee', 'thread', 'ble'], cell: 'CR2032', life: '2–5 év', ref: 'sw_wireless_btn', rooms: ['*'] },
 { k: 'U_kinetic', n: 'Kinetikus kapcsoló (elem nélkül)', cat: 'control', radio: ['enocean', 'zigbee'], cell: 'nincs (energiagyűjtő)', life: 'korlátlan', ref: 'sw_kinetic', rooms: ['*'] },
 { k: 'U_trv', n: 'Termosztatikus radiátorszelep', cat: 'control', radio: ['zigbee', 'thread'], cell: '2×AA', life: '1–2 év', ref: null, rooms: ['nappali', 'halo', 'gyerek', 'dolgozo', 'furdo', 'konyha'] },
 { k: 'U_epaper', n: 'E-papír kijelző / címke', cat: 'control', radio: ['ble', 'zigbee', 'espnow'], cell: 'CR2450 / Li-ion', life: 'hónapok–évek (frissítési gyakoriság szerint)', ref: 'C_epaper', rooms: ['*'] },
 { k: 'U_lock', n: 'Okoszár', cat: 'security', radio: ['thread', 'zigbee', 'ble'], cell: '4×AA / Li-ion', life: '6–12 hónap', ref: null, rooms: ['eloszoba'] },
 { k: 'U_siren', n: 'Beltéri sziréna (tartalék akkuval)', cat: 'security', radio: ['zigbee'], cell: 'Li-ion tartalék', life: 'táp mellett', ref: null, rooms: ['eloszoba', 'kozlekedo'] },
 { k: 'U_tag', n: 'BLE címke (kulcs, pénztárca — Trinity)', cat: 'identity', radio: ['ble'], cell: 'CR2032', life: '1 év', ref: 'ble_rssi', rooms: ['*'] },
 { k: 'U_nl', n: 'Hordozható értesítő fény (NL-P, 18650)', cat: 'light', radio: ['espnow'], cell: '18650 + USB', life: 'hetek töltésenként', ref: 'L_ntl', rooms: ['*'] },
 { k: 'U_solar_sensor', n: 'Napelemes szenzor (EnOcean)', cat: 'sensor', radio: ['enocean'], cell: 'nincs (napelem)', life: 'korlátlan, fény kell', ref: null, rooms: ['nappali', 'dolgozo', 'kozlekedo'] },
 { k: 'U_esp_sleep', n: 'Saját ESP32-C6 / H2 csomópont mélyalvással', cat: 'sensor', radio: ['zigbee', 'thread', 'espnow'], cell: 'Li-ion / LiFePO4 / 2×AA', life: 'hónapok–évek (ciklus szerint)', ref: null, rooms: ['*'],
   note: 'ESPHome 2026.9 natív zigbee komponens: ESP32-C6/H2 Zigbee végeszközként (CoreRef).' },
 { k: 'U_mmw_hybrid', n: 'Elemes radar PIR-ébresztéssel', cat: 'sensor', radio: ['zigbee', 'thread'], cell: 'CR123A / 2×AA', life: 'hónapok ⚑', ref: 'mmw24_pres', rooms: ['*'],
   note: 'A radar csak a PIR után ébred — a jelenlét-tartás gyengébb, mint a vezetékes radaré.' }
];
