// 90-tuya.js — the Tuya device categories, tagged for BRIDGE (rooms, zone, power, relation, stack layer)
//
// Sources (2026-10-11):
//  · Tuya Developer Platform, "Standard Instruction Set" — 103 categories in a flat table; the page's sidebar names
//    11 product groups. Category → group is NOT given by Tuya; grp below is inferred from the table order. ⚑
//    https://developer.tuya.com/en/docs/iot/standarddescription?id=K9i5ql6waswzq
//  · Home Assistant core 2026.10.0, homeassistant/components/tuya/const.py, class DeviceCategory (Apache-2.0):
//    140 codes = the 103 + 3 documented elsewhere (hwsb, wg2, wxkg) + 34 seen in the field ("undocumented").
//    English names below are HA's labels.
//
// Row: code | English (HA) | Hungarian | grp | rooms (space-separated, '*' = all, '' = none) | zone | power | rel | layer | b(attery) | ref
//   rel: bridge = BRIDGE builds its own equivalent endpoint · integrate = third-party device BRIDGE integrates (HA)
//        appliance = an appliance on a socket / circuit (only its power and placement matter) · out = not relevant
//   ref: the catalogue key it corresponds to (sensor / switch / light / interface), if any.

const groups = {
  lighting: 'Világítás', electrical: 'Villamos szerelvények', large: 'Nagy háztartási gépek', small: 'Kis háztartási gépek',
  kitchen: 'Konyhai gépek', gateway: 'Átjárók', sensors: 'Érzékelők és biztonság', health: 'Sport és egészség',
  energy: 'Energia', digital: 'Szórakoztatás', outdoor: 'Kültér és utazás'
};

const OFFICIAL = new Set(('dj xdd fwd dc dd gyd fsd tyndj tgq ykq kg pc cz cjkg ckqdkg clkg ckmkzq tgkg rs xfj bx yg xy kt ktkzq bgl sd qn kj lyj ' +
  'xxj cl mc wk yb ggq jsq cs fs js dr cwtswsq cwwqfsq ntq cwwsq cwysj sf dbl tnq msp mjj sz bh mb kfj nnq cn mzj mg dcl kqzg znfh mal sp ' +
  'sgbj zd mcs rqbj ywbj wsdcg sj ylcg ldcg sos pm2.5 pir cobj co2bj dgnbj jwbj hps ms bxx gyms jtmspro hotelms ms_category jtmsbh mk ' +
  'videolock photolock amy liliao ts tzc1 sb zndb znsb dlq ds tyy tracker znyh').split(' '));
const DOC_ELSEWHERE = new Set(['hwsb', 'wg2', 'wxkg']);

const TABLE = `
dj|Light|Lámpa (izzó)|lighting|*|ceiling|mains|integrate|sys:MAINS||L_ceiling
xdd|Ceiling light|Mennyezeti lámpa|lighting|*|ceiling|mains|bridge|sys:MAINS||L_ceiling
fwd|Ambiance light|Hangulatlámpa|lighting|nappali halo gyerek|furniture|mains usb|integrate|sys:LV||
dc|String lights|Fényfüzér|lighting|nappali terasz kert|outdoor|mains|integrate|sys:LV||
dd|Strip lights|LED szalag|lighting|*|furniture|lv|bridge|sys:LV||L_cove
gyd|Motion sensor light|Mozgásérzékelős lámpa|lighting|kozlekedo lepcso kert eloszoba|high|mains batt|integrate|sys:MAINS|b|
fsd|Ceiling fan light|Mennyezeti ventilátor lámpával|lighting|nappali halo|ceiling|mains|integrate|sys:MAINS||
tyndj|Solar light|Napelemes lámpa|lighting|kert terasz|outdoor|harvest|integrate|-|b|
tgq|Dimmer|Fényerő-szabályzó modul|electrical|*|-|mains|integrate|sys:MAINS||
ykq|Remote control|Távirányító|electrical|nappali halo|furniture|batt|integrate|sys:CONTROL|b|sw_remote
kg|Switch|Kapcsoló (fali / relé)|electrical|*|mid|mains|bridge|sys:MAINS||sw_rocker
pc|Power strip|Elosztó (hosszabbító)|electrical|nappali dolgozo|low|mains|integrate|sys:MAINS||
cz|Socket|Okos dugalj|electrical|*|low|mains|bridge|sys:MAINS||plug_meter
cjkg|Scene switch|Jelenetkapcsoló|electrical|nappali halo eloszoba|smart|mains batt|bridge|sys:CONTROL|b|sw_scene
ckqdkg|Card switch|Kártyás kapcsoló|electrical|eloszoba|mid|mains|integrate|sys:CONTROL||sw_keycard
clkg|Curtain switch|Redőny- / függönykapcsoló|electrical|nappali halo gyerek konyha etkezo|mid|mains|bridge|sys:MAINS||sw_shutter
ckmkzq|Garage door opener|Garázskapu-nyitó|electrical|garazs|high|mains|integrate|sys:MAINS||
tgkg|Dimmer switch|Fényerő-szabályzós kapcsoló|electrical|*|mid|mains|integrate|sys:MAINS||sw_rotary
rs|Water heater|Vízmelegítő (bojler)|large|furdo gepesz konyha|high|mains|appliance|sys:MAINS||
xfj|Ventilation system|Szellőztető rendszer (hővisszanyerős)|large|gepesz|ceiling|mains|integrate|sys:CONTROL||
bx|Refrigerator|Hűtőszekrény|large|konyha|low|mains|appliance|sys:MAINS||
yg|Bathtub|Okos fürdőkád|large|furdo|floor|mains|appliance|sys:MAINS||
xy|Washing machine|Mosógép|large|mosokonyha furdo|low|mains|appliance|sys:MAINS||
kt|Air conditioner|Klíma|large|nappali halo gyerek dolgozo|high|mains|integrate|sys:MAINS||
ktkzq|Air conditioner controller|Klíma-vezérlő (IR)|large|nappali halo gyerek dolgozo|smart|usb mains|integrate|sys:CONTROL||
bgl|Wall-hung boiler|Fali kazán|large|gepesz konyha furdo|high|mains|integrate|sys:CONTROL||
sd|Robot vacuum|Robotporszívó|small|nappali|floor|mains|appliance|sys:MAINS||
qn|Heater|Hősugárzó / fűtőtest|small|furdo halo nappali|low|mains|appliance|sys:MAINS||
kj|Air purifier|Légtisztító|small|nappali halo gyerek|floor|mains|integrate|sys:MAINS||
lyj|Drying rack|Motoros ruhaszárító|small|mosokonyha terasz|ceiling|mains|appliance|sys:MAINS||
xxj|Diffuser|Illóolaj-párologtató|small|nappali halo|furniture|mains|appliance|-||
cl|Curtain|Függöny- / redőnymotor|small|nappali halo gyerek etkezo konyha|high|mains lv|bridge|sys:MAINS||A_dcmotor
mc|Door/window controller|Ajtó- / ablakmozgató|small|nappali halo|high|mains lv|integrate|sys:MAINS||
wk|Thermostat|Termosztát|small|nappali halo gyerek dolgozo furdo|smart|bus batt|bridge|sys:CONTROL|b|C_thermostat
yb|Bathroom heater|Fürdőszobai hősugárzó|small|furdo|ceiling|mains|integrate|sys:MAINS||
ggq|Irrigator|Öntözésvezérlő|small|kert terasz|outdoor|batt lv|integrate|sys:LV|b|
jsq|Humidifier|Párásító|small|halo gyerek nappali|floor|mains|appliance|sys:MAINS||
cs|Dehumidifier|Párátlanító|small|kamra tarolo mosokonyha|floor|mains|appliance|sys:MAINS||
fs|Fan|Ventilátor|small|nappali halo|floor|mains|appliance|sys:MAINS||
js|Water purifier|Víztisztító|small|konyha|furniture|mains|appliance|sys:MAINS||
dr|Electric blanket|Elektromos takaró|small|halo|furniture|mains|appliance|sys:MAINS||
cwtswsq|Pet treat feeder|Jutalomfalat-adagoló (állat)|small|nappali konyha|floor|mains usb|out|-||
cwwqfsq|Pet ball thrower|Labdadobó (állat)|small|nappali kert|floor|mains|out|-||
ntq|HVAC|Fűtés-hűtés központ (HVAC)|small|gepesz|-|mains|integrate|sys:CONTROL||
cwwsq|Pet feeder|Etetőautomata (állat)|small|konyha kamra|floor|mains usb|appliance|-||
cwysj|Pet fountain|Itatókút (állat)|small|konyha|floor|mains usb|appliance|-||
sf|Sofa|Motoros kanapé|small|nappali|furniture|mains|appliance|sys:MAINS||
dbl|Electric fireplace|Elektromos kandalló|small|nappali|low|mains|appliance|sys:MAINS||
tnq|Smart milk kettle|Okos tejmelegítő kanna|small|konyha|furniture|mains|out|-||
msp|Cat toilet|Macskatoalett|small|furdo wc kamra|floor|mains|appliance|-||
mjj|Towel rack|Törölközőszárító|small|furdo|mid|mains|integrate|sys:MAINS||
sz|Smart indoor garden|Beltéri okoskert|small|konyha nappali|furniture|mains|appliance|-||
bh|Smart kettle|Okos vízforraló|kitchen|konyha|furniture|mains|appliance|-||
mb|Bread maker|Kenyérsütő|kitchen|konyha|furniture|mains|out|-||
kfj|Coffee maker|Kávéfőző|kitchen|konyha|furniture|mains|appliance|-||
nnq|Bottle warmer|Cumisüveg-melegítő|kitchen|konyha gyerek|furniture|mains|out|-||
cn|Milk dispenser|Tejadagoló|kitchen|konyha|furniture|mains|out|-||
mzj|Sous vide cooker|Sous-vide főző|kitchen|konyha|furniture|mains|out|-||
mg|Rice cabinet|Rizstároló|kitchen|konyha kamra|furniture|mains|out|-||
dcl|Induction cooker|Indukciós főző|kitchen|konyha|furniture|mains|appliance|sys:MAINS||
kqzg|Air fryer|Forrólevegős sütő|kitchen|konyha|furniture|mains|out|-||
znfh|Bento box|Fűtött ételhordó|kitchen|konyha|furniture|mains|out|-||
mal|Alarm host|Riasztóközpont|sensors|kamra eloszoba|-|mains|integrate|sys:SECURITY||
sp|Smart camera|Okoskamera|sensors|eloszoba terasz kert|high|poe mains|integrate|sys:DATA||camera_ai
sgbj|Siren alarm|Sziréna|sensors|eloszoba terasz|high|mains batt|integrate|sys:SECURITY|b|
zd|Vibration sensor|Rezgésérzékelő|sensors|*|-|batt|bridge|sys:SENSOR|b|accel
mcs|Contact sensor|Nyitásérzékelő|sensors|*|high|batt|bridge|sys:SENSOR|b|reed
rqbj|Gas alarm|Gázriasztó|sensors|konyha gepesz|ceiling|mains|bridge|sys:SENSOR||ch4
ywbj|Smoke alarm|Füstriasztó|sensors|halo gyerek nappali kozlekedo eloszoba|ceiling|batt|bridge|sys:SECURITY|b|smoke_opt
wsdcg|Temperature and humidity sensor|Hő- és páratartalom-érzékelő|sensors|*|mid|batt|bridge|sys:SENSOR|b|temp
sj|Water leak detector|Vízszivárgás-érzékelő|sensors|konyha furdo wc mosokonyha gepesz|floor|batt|bridge|sys:SENSOR|b|leak_spot
ylcg|Pressure sensor|Nyomásérzékelő|sensors|gepesz|-|batt lv|integrate|sys:SENSOR|b|water_pressure
ldcg|Luminance sensor|Fényérzékelő|sensors|*|high|batt|bridge|sys:SENSOR|b|lux
sos|Emergency button|Vészhívó gomb|sensors|halo furdo wc|low|batt|bridge|sys:SECURITY|b|sw_sos
pm2.5|PM2.5 detector|PM2.5 érzékelő|sensors|nappali halo konyha gyerek|mid|mains usb|bridge|sys:SENSOR||pm
pir|Human motion sensor|Mozgásérzékelő (PIR)|sensors|*|high|batt|bridge|sys:SENSOR|b|pir
cobj|CO detector|CO-érzékelő|sensors|halo nappali konyha gepesz garazs|mid|batt|bridge|sys:SENSOR|b|co_ec
co2bj|CO2 detector|CO₂-érzékelő|sensors|*|mid|usb mains|bridge|sys:SENSOR||co2
dgnbj|Multi-functional alarm|Multifunkciós riasztó|sensors|*|ceiling|mains batt|integrate|sys:SECURITY|b|
jwbj|Methane detector|Metánérzékelő|sensors|konyha gepesz|ceiling|mains|bridge|sys:SENSOR||ch4
hps|Human presence sensor|Jelenlétérzékelő (radar)|sensors|*|ceiling|mains lv|bridge|sys:SENSOR||mmw24_pres
ms|Residential lock|Lakásajtó okoszár|sensors|eloszoba|mid|batt|integrate|sys:SECURITY|b|
bxx|Safe box|Széf|sensors|halo gardrob dolgozo|furniture|batt|integrate|sys:SECURITY|b|
gyms|Business lock|Irodai zár|sensors||mid|batt|out|-|b|
jtmspro|Residential lock pro|Lakásajtó okoszár Pro|sensors|eloszoba|mid|batt|integrate|sys:SECURITY|b|
hotelms|Hotel lock|Szállodai zár|sensors||mid|batt|out|-|b|
ms_category|Lock accessories|Zár-kiegészítő|sensors|eloszoba|mid|batt|integrate|sys:SECURITY|b|
jtmsbh|Smart lock (keep alive)|Okoszár (állandó kapcsolattal)|sensors|eloszoba|mid|batt|integrate|sys:SECURITY|b|
mk|Access control|Beléptető|sensors|eloszoba|smart|mains poe|integrate|sys:CONTROL||C_entry
videolock|Lock with camera|Kamerás zár|sensors|eloszoba|mid|batt|integrate|sys:SECURITY|b|
photolock|Audio and video lock|Audió-videós zár|sensors|eloszoba|mid|batt|integrate|sys:SECURITY|b|
amy|Massage chair|Masszázsfotel|health|nappali|furniture|mains|appliance|sys:MAINS||
liliao|Physiotherapy product|Fizioterápiás eszköz|health|halo|furniture|mains|out|-||
ts|Smart jump rope|Okos ugrókötél|health||-|batt|out|-|b|
tzc1|Body fat scale|Testzsír-mérleg|health|furdo|floor|batt|integrate|-|b|
sb|Watch/band|Okosóra / karpánt|health||-|batt|integrate|sys:RF|b|ble_rssi
zndb|Smart electricity meter|Okos fogyasztásmérő|energy|gepesz|-|mains|bridge|hw||energy_meter
znsb|Smart water meter|Okos vízmérő|energy|gepesz|low|batt|bridge|sys:SENSOR|b|water_flow
dlq|Circuit breaker|Okos kismegszakító|energy|gepesz|-|mains|integrate|hw||
ds|TV set|TV|digital|nappali halo|mid|mains|integrate|sys:MEDIA||
tyy|Projector|Projektor|digital|nappali|ceiling|mains|integrate|sys:MEDIA||
tracker|Tracker|Nyomkövető címke|outdoor||-|batt|integrate|sys:RF|b|ble_rssi
znyh|Smart pill box|Okos gyógyszeradagoló|outdoor|konyha halo|furniture|batt|integrate|-|b|
hwsb|Outdoor equipment|Kültéri eszköz|outdoor|kert terasz|outdoor|batt|out|-||
wg2|Gateway control|Átjáró (gateway)|gateway|nappali|high|mains poe|integrate|sys:RF||
wxkg|Wireless Switch|Vezeték nélküli kapcsoló|electrical|*|mid|batt|bridge|sys:CONTROL|b|sw_wireless_btn
aqcz|Single Phase power meter|Egyfázisú fogyasztásmérő|energy|gepesz|-|mains|bridge|hw||energy_meter
bzyd|White noise machine|Fehérzaj-gép|small|halo gyerek|furniture|mains usb|out|-||
cwjwq|Smart Odor Eliminator-Pro|Szagtalanító (állat)|small|furdo kamra|floor|mains|out|-||
dghsxj|Smart Camera - Low power consumption camera|Alacsony fogyasztású kamera|sensors|eloszoba terasz kert|high|batt|integrate|sys:DATA|b|camera_ai
dsd|Filament Light|Filament izzó|lighting|*|ceiling|mains|integrate|sys:MAINS||
fskg|Fan wall switch|Ventilátor fali kapcsoló|electrical|furdo wc|mid|mains|integrate|sys:MAINS||
hcdd|Chasing tape light|Futófény-szalag (címezhető)|lighting|*|furniture|lv|bridge|sys:LV||L_skirting
hjjcy|Air Quality Monitor|Levegőminőség-mérő|sensors|*|mid|usb mains|bridge|sys:SENSOR||co2
hxd|Wake Up Light II|Ébresztőfény|lighting|halo|furniture|mains|integrate|-||
jdcljqr|Curtain Robot|Függönyrobot|small|nappali halo|high|batt|integrate|-|b|
jqbj|Formaldehyde Detector|Formaldehid-érzékelő|sensors|halo gyerek nappali|mid|usb batt|bridge|sys:SENSOR||hcho_ec
ks|Tower fan|Toronyventilátor|small|nappali halo|floor|mains|appliance|-||
mbd|Unknown light product|Ismeretlen fényforrás (RGBW)|lighting|*|-|mains|integrate|-||
qccdz|AC charging|AC töltő (elektromos autó)|energy|garazs|mid|mains|integrate|sys:MAINS||
qjdcz|Unknown product with light capabilities|Ismeretlen eszköz fényfunkcióval|lighting|*|-|mains|integrate|-||
qxj|Temperature and Humidity Sensor with External Probe|Hő-/pára-érzékelő külső szondával|sensors|*|mid|batt|bridge|sys:SENSOR|b|pipe_temp
sfkzq|Smart Water Timer|Okos vízidőzítő (csap)|outdoor|kert terasz|outdoor|batt|integrate|-|b|
sjz|Electric desk|Elektromos állítható asztal|small|dolgozo|furniture|mains|appliance|-||
szjcy|Water tester|Vízminőség-mérő|sensors|konyha|furniture|batt|integrate|-|b|
szjqr|Fingerbot|Gombnyomó robot (Fingerbot)|electrical|*|-|batt|integrate|-|b|
swtz|Cooking thermometer|Konyhai maghőmérő|kitchen|konyha|furniture|batt|integrate|-|b|
tdq|Dimmer|Fényerő-szabályzó modul|electrical|*|-|mains|integrate|sys:MAINS||
tyd|Outdoor flood light|Kültéri reflektor|lighting|kert terasz|outdoor|mains|integrate|sys:MAINS||
voc|Volatile Organic Compound Sensor|VOC-érzékelő|sensors|*|mid|usb|bridge|sys:SENSOR||voc_mox
wkcz|Two-way temperature and humidity switch|Hő-/pára-vezérelt relé|electrical|furdo gepesz|-|mains|integrate|sys:MAINS||
wkf|Thermostatic Radiator Valve|Termosztatikus radiátorszelep|small|nappali halo gyerek dolgozo furdo konyha|low|batt|integrate|sys:CONTROL|b|
wnykq|Smart WiFi IR Remote|WiFi IR távirányító|electrical|nappali halo|furniture|usb|integrate|sys:CONTROL||
xnyjcn|Micro Storage Inverter|Mikro tároló inverter|energy|gepesz terasz|-|mains|integrate|hw||
ywcgq|Tank Level Sensor|Tartályszint-érzékelő|sensors|kert gepesz|outdoor|batt|integrate|sys:SENSOR|b|level
znnbq|VESKA-micro inverter|Mikroinverter|energy|terasz|outdoor|mains|integrate|hw||
znjdq|Circuit breaker|Okos kismegszakító|energy|gepesz|-|mains|integrate|hw||
zwjcy|Soil sensor - plant monitor|Talajszenzor|sensors|kert terasz|outdoor|batt|bridge|sys:SENSOR|b|soil
znjxs|Hejhome whitelabel Fingerbot|Gombnyomó robot (whitelabel)|electrical|*|-|batt|integrate|-|b|
znrb|Pool HeatPump|Medence-hőszivattyú|large|kert|outdoor|mains|out|-||
`;

const cats = TABLE.trim().split('\n').map(line => {
  const [code, en, hu, grp, rooms, zone, pwr, rel, layer, b, ref] = line.split('|');
  return { code, en, hu, grp, status: OFFICIAL.has(code) ? 'official' : DOC_ELSEWHERE.has(code) ? 'documented' : 'field',
           rooms: rooms ? rooms.split(' ') : [], zone, pwr: pwr.split(' '), rel, layer, batt: b === 'b', ref: ref || null };
});

module.exports = { groups, cats, counts: { official: OFFICIAL.size, documentedElsewhere: DOC_ELSEWHERE.size } };
