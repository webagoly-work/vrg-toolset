# Lámpák és világítótestek — a Kisokos

*Generálva a kártyákból (`node Kisokos/kisokos.js md`); ne szerkeszd kézzel, a kártyát szerkeszd a `lampak.json`-ban. Egy kártya = egy lámpatest-típus, nem termék. A fényeloszlás-rajz típusonként általános (sematikus), nem egy termék mért adata. Vázlat: minden kártya ellenőrzésre vár; a pontos adat a termék adatlapján van.*

## Gyorstábla

| Típus | Család | Szerelés | Védettség | Fényeloszlás | Rajzjel |
|---|---|---|---|---|---|
| Mennyezeti lámpa (plafonlámpa) | Mennyezeti | mennyezetre, felületre szerelve | IP20 | diffúz, lefelé | `lum.general` |
| LED-korong lámpa („ufó”) | Mennyezeti | mennyezetre vagy falra, felületre szerelve | IP20 – IP65 (kiviteltől függően) | diffúz, lefelé | `lum.general` |
| Búrás mennyezeti lámpa | Mennyezeti | mennyezetre, felületre szerelve | IP20 – IP44 | minden irányba | `lum.general` |
| Csillár | Mennyezeti | mennyezetre függesztve, kampóra vagy szerelőlapra | IP20 | minden irányba | `lum.general` |
| Függeszték | Mennyezeti | mennyezetről zsinóron, láncon vagy acélsodronyon függesztve | IP20 | főleg le, részben fel | `lum.general` |
| LED-panel | Mennyezeti | álmennyezeti raszterbe fektetve, vagy felületre szerelő keretben, vagy függesztve | IP20 – IP44 (alulról IP54-es kivitel is) | denevérszárny (batwing) | `lum.panel` |
| Süllyesztett downlight | Mennyezeti | álmennyezetbe süllyesztve, rugós rögzítéssel | IP20 – IP44 (alulról) | széles nyaláb 80° | `lum.spot` |
| Beépíthető spot | Mennyezeti | álmennyezetbe süllyesztve, rugós keretben | IP20 – IP65 (alulról, fürdős kivitel) | keskeny nyaláb 36° | `lum.spot` |
| Felületre szerelt spot | Mennyezeti | mennyezetre vagy falra, felületre szerelve | IP20 | keskeny nyaláb 40° | `lum.spot` |
| Sínrendszer 230 V | Mennyezeti | mennyezetre szerelve, süllyesztve vagy függesztve | IP20 | keskeny nyaláb 30° | `lum.spot` |
| Mágneses sín 48 V | Mennyezeti | mennyezetbe süllyesztve (keret nélkül is), felületre vagy függesztve | IP20 | keskeny nyaláb 24° | `lum.linear` |
| Világító mennyezet | Mennyezeti | álmennyezet mögé vagy feszített fólia mögé építve | IP20 | diffúz, lefelé | `lum.panel` |
| Falikar | Fali | falra szerelve, a kiállás fölött | IP20 | főleg le, részben fel | `lum.wall` |
| Fali-mennyezeti búra | Fali | falra vagy mennyezetre, felületre szerelve | IP20 – IP44 | minden irányba | `lum.wall` |
| Fel-le világító fali lámpa | Fali | falra, felületre szerelve | IP20 beltérben, IP44 – IP65 kültéren | fel és le 24° | `lum.wall` |
| Olvasó falikar | Fali | falra szerelve, mozgatható karral | IP20 | keskeny nyaláb 30° | `lum.wall` |
| Képvilágító | Fali | falra, a kép fölé, karral előrehajolva | IP20 | aszimmetrikus | `lum.wall` |
| Falba süllyesztett lépcső- és orientációs fény | Fali | falba süllyesztve, szerelvénydobozba vagy saját beépítő dobozba | IP20 beltérben, IP44 – IP65 kültéren | aszimmetrikus | `lum.wall` |
| Fali fényvető (wall washer) | Fali | a fal elé, mennyezetre, padlóba vagy a fal tövébe | IP20 – IP67 (padlóba és kültérre) | aszimmetrikus | `lum.linear` |
| LED-szalag (12 / 24 V) | Rejtett és vonali | alumínium profilba ragasztva, vagy közvetlenül felületre | IP20 beltérben, IP54 – IP67 szilikonbevonattal | széles nyaláb 120° | `lum.strip` |
| Hálózati feszültségű LED-szalag (230 V) | Rejtett és vonali | felületre, klipszekkel vagy profilban | IP65 – IP67 | széles nyaláb 120° | `lum.strip` |
| Alumínium profil LED-szalaghoz | Rejtett és vonali | felületre, süllyesztve (falba, bútorba, gipszkartonba), sarokba vagy függesztve | IP20 (tömítéssel IP44 – IP65) | diffúz, lefelé | `lum.linear` |
| LED neon flex | Rejtett és vonali | rögzítőklipszekkel vagy profilban, hajlítva | IP65 – IP68 | széles nyaláb 120° | `lum.strip` |
| Rejtett (indirekt) világítás párkányban | Rejtett és vonali | gipszkarton párkány, koronaléc vagy kazetta mögé rejtve | IP20 | aszimmetrikus | `lum.strip` |
| Keret nélküli (trimless) beépítés | Rejtett és vonali | gipszkartonba vagy vakolatba beépítve és a felülettel egy síkba glettelve | IP20 | keskeny nyaláb 36° | `lum.spot` |
| Árnyékfuga- és lábazatvilágítás | Rejtett és vonali | a padló és a fal találkozásánál, árnyékfugába vagy szegélyprofilba | IP20 – IP44 | aszimmetrikus | `lum.strip` |
| Konyhai pult alatti világítás | Bútor és beépített | a felső konyhaszekrények alá, a fal közelébe | IP20 – IP44 | diffúz, lefelé | `lum.linear` |
| Szekrény- és gardróbvilágítás | Bútor és beépített | a szekrény belső tetejére, oldalára vagy a ruharúdba | IP20 | diffúz, lefelé | `lum.strip` |
| Polc- és vitrinvilágítás | Bútor és beépített | polc elejébe vagy aljába, üvegpolc élébe, vitrin tetejébe | IP20 | keskeny nyaláb 40° | `lum.strip` |
| Bútorspot | Bútor és beépített | bútorba süllyesztve vagy felületre szerelve | IP20 – IP44 | keskeny nyaláb 45° | `lum.spot` |
| Ágy alatti orientációs fény | Bútor és beépített | az ágy keretének aljára | IP20 | aszimmetrikus | `lum.strip` |
| Lépcsőfokba épített világítás | Bútor és beépített | minden lépcsőfok élébe vagy alá profilban | IP20 – IP44 | aszimmetrikus | `lum.strip` |
| Állólámpa | Dugaszolós | a padlón, dugaszolós | IP20 | főleg le, részben fel | `inst.socket-switched` |
| Asztali és íróasztali lámpa | Dugaszolós | az asztalon, dugaszolós, sokszor csiptetős vagy karos | IP20 | széles nyaláb 90° | `inst.socket-pe` |
| Éjjeli lámpa | Dugaszolós | éjjeliszekrényen, dugaszolós vagy akkus | IP20 | minden irányba | `inst.socket-usb` |
| Kapcsolt aljzat (a dugaszolós lámpák köre) | Dugaszolós | falba süllyesztett aljzat, falikapcsolóról kapcsolva | IP20 (nedves helyen IP44) | minden irányba | `inst.socket-switched` |
| Fürdőszobai mennyezeti lámpa | Nedves helyiség | mennyezetre, felületre szerelve | legalább IP44 (zónától függően több) | diffúz, lefelé | `lum.general` |
| Fürdőszobai beépíthető spot | Nedves helyiség | álmennyezetbe süllyesztve | IP44 – IP65 alulról | széles nyaláb 60° | `lum.spot` |
| Tükörvilágítás | Nedves helyiség | tükör fölé vagy mellé, falra; vagy a tükörbe építve | legalább IP44 | aszimmetrikus | `lum.wall` |
| Páramentes lámpatest | Nedves helyiség | mennyezetre vagy falra, felületre szerelve, csatokkal zárt burkolattal | IP65 | diffúz, lefelé | `lum.linear` |
| Hajólámpa | Nedves helyiség | falra vagy mennyezetre, felületre szerelve | IP54 – IP65 | minden irányba | `lum.outdoor` |
| Szaunavilágítás | Nedves helyiség | a szauna falára vagy mennyezetére, sokszor fa takarás mögé | IP44 vagy több | diffúz, lefelé | `lum.general` |
| Kültéri falikar | Kültéri | homlokzatra, a bejárat, terasz, garázs mellé | IP44 – IP65 | főleg le, részben fel | `lum.outdoor` |
| Mozgásérzékelős reflektor | Kültéri | homlokzatra, eresz alá, oszlopra | IP65 | széles nyaláb 100° | `lum.flood` |
| Kerti oszloplámpa (bollard) | Kültéri | talajba betonozott alapra vagy rögzítőtüskére, 30–100 cm magasan | IP44 – IP65 | minden irányba | `lum.outdoor` |
| Leszúrható kerti spot | Kültéri | a földbe szúrt tüskére, irányítható fejjel | IP65 – IP67 | keskeny nyaláb 36° | `lum.outdoor` |
| Földbe süllyesztett lámpa (uplight) | Kültéri | a talajba, burkolatba vagy teraszba süllyesztve, a fedőlap a felülettel egy síkban | IP67 – IP68 | felfelé (uplight) 30° | `lum.outdoor` |
| Homlokzat-megvilágító | Kültéri | a homlokzat előtt a talajra, a homlokzat aljára vagy tetejére | IP65 – IP67 | aszimmetrikus | `lum.flood` |
| Medencevilágítás | Kültéri | a medence falába beépítve vagy a falra szerelve, víz alatt | IP68 | széles nyaláb 90° | `lum.outdoor` |
| Napelemes kerti lámpa | Kültéri | leszúrva vagy felcsavarozva, vezeték nélkül | IP44 – IP65 | minden irányba | `lum.outdoor` |
| Kapuoszlop- és pillérlámpa | Kültéri | a kapuoszlop vagy a kerítéspillér tetejére | IP44 – IP65 | minden irányba | `lum.outdoor` |
| Kültéri fényfüzér | Kültéri | kifeszítve teraszon, pergolán, fák között; acélsodronyra függesztve | IP44 – IP65 | minden irányba | `lum.outdoor` |
| Előtető- és teraszmennyezeti lámpa | Kültéri | az előtető, az eresz vagy a terasz mennyezetébe süllyesztve vagy felületre | IP44 – IP65 | széles nyaláb 80° | `lum.spot` |
| Önálló akkumulátoros biztonsági lámpatest | Biztonsági és jelző | mennyezetre vagy falra, felületre szerelve vagy süllyesztve | IP20 – IP65 | denevérszárny (batwing) | `lum.emergency` |
| Központi akkumulátoros rendszer lámpateste | Biztonsági és jelző | mennyezetre vagy falra, a központi rendszer áramköreire kötve | IP20 – IP65 | denevérszárny (batwing) | `lum.emergency-central` |
| Menekülési útirány- és kijáratjelző | Biztonsági és jelző | ajtó fölé, falra, mennyezetre függesztve vagy zászlósan | IP20 – IP65 | minden irányba | `lum.exit` |
| Süllyesztett biztonsági spot | Biztonsági és jelző | álmennyezetbe süllyesztve, kis kivágással | IP20 – IP65 (alulról) | denevérszárny (batwing) | `lum.emergency` |
| Nagy terek biztonsági lámpateste (nyílt terület) | Biztonsági és jelző | nagy belmagasságú mennyezetre vagy falra | IP40 – IP65 | széles nyaláb 120° | `lum.emergency` |
| Vészvilágítási modul (konverziós készlet) | Biztonsági és jelző | egy normál lámpatestbe vagy mellé építve | a lámpatesté | diffúz, lefelé | `lum.emergency` |
| Áramszünet-jelző éjszakai fény | Biztonsági és jelző | dugaszolós, a fali aljzatba | IP20 | minden irányba | `lum.general` |
| Utánvilágító (fotolumineszcens) jel és csík | Biztonsági és jelző | falra, padlóra, lépcsőélre ragasztva vagy csavarozva | nem villamos termék | diffúz, lefelé | `` |
| Irodai lámpatest | Kereskedelmi és ipari | álmennyezetbe, felületre vagy függesztve | IP20 – IP40 | denevérszárny (batwing) | `lum.panel` |
| Fénysor-rendszer (trunking) | Kereskedelmi és ipari | mennyezetre függesztve vagy felületre, folytonos sorban | IP20 – IP54 | denevérszárny (batwing) | `lum.linear` |
| Csarnokvilágító (high bay) | Kereskedelmi és ipari | 6–20 m magasan, kampóra, láncra vagy konzolra függesztve | IP65 | széles nyaláb 90° | `lum.flood` |
| LED-fénycső és armatúra | Kereskedelmi és ipari | armatúrába, mennyezetre vagy falra | az armatúrától függ (IP20 – IP65) | széles nyaláb 150° | `lum.linear` |
| Polcvilágító (kereskedelmi) | Kereskedelmi és ipari | a polc elejébe, a polcsor fölé vagy a fénysorba | IP20 | aszimmetrikus | `lum.linear` |
| Parkolóházi és garázslámpatest | Kereskedelmi és ipari | mennyezetre, felületre | IP65 | széles nyaláb 120° | `lum.linear` |
| Utcai lámpatest (közvilágítás) | Kereskedelmi és ipari | kandeláberre vagy villanyoszlopra, karra | IP66 | aszimmetrikus | `lum.outdoor` |
| Növénynevelő lámpa | Niche | a növények fölé függesztve vagy polcra szerelve | IP20 – IP65 | széles nyaláb 120° | `lum.general` |
| Akváriumi lámpa | Niche | az akvárium fedelébe vagy fölé | IP65 – IP67 | széles nyaláb 120° | `lum.general` |
| UV-C fertőtlenítő lámpa | Niche | mennyezetre, falra, légcsatornába vagy zárt készülékbe | IP20 – IP65 | széles nyaláb 120° | `lum.general` |
| Robbanásbiztos (Ex) lámpatest | Niche | robbanásveszélyes zónába, felületre vagy függesztve | IP66 vagy több | minden irányba | `lum.general` |
| Színpadi és mozgófejes lámpa | Niche | színpadi tartószerkezetre (truss), bilinccsel, biztosító kötéllel | IP20 (kültéri IP65) | keskeny nyaláb 15° | `lum.spot` |
| Száloptikás csillagos mennyezet | Niche | a mennyezetbe fűzött optikai szálak, a fényforrás a mennyezet fölött | a szálvégeken nincs villamos rész | széles nyaláb 60° | `lum.general` |
| Napfénycső (fénycsatorna) | Niche | a tetőn át a mennyezetig, belül tükrös csővel | a tetőátvezetés vízzáró szerkezet | diffúz, lefelé | `lum.general` |
| HCL: emberközpontú világítás (hangolható fehér) | Niche | bármely lámpatest-forma hangolható fehér kivitelben | a lámpatesté | diffúz, lefelé | `lum.general` |
| Sütő- és hűtővilágítás | Niche | a háztartási gépben, gyári foglalatban | a gépé | minden irányba | `lum.general` |
| Vizsgáló- és műtőlámpa | Niche | mennyezetre, falra vagy gurulós állványra, karral | IP20 – IP54 | keskeny nyaláb 20° | `lum.spot` |
| Jelzőtorony és jelzőfény | Niche | gépre, vezérlőszekrényre, kapura vagy falra | IP54 – IP66 | minden irányba | `meas.lamp` |

## 1. Mennyezeti

### Mennyezeti lámpa (plafonlámpa)

*Más néven:* plafonnier, mennyezeti lámpatest, felületre szerelt mennyezeti lámpa

![Mennyezeti lámpa (plafonlámpa)](svg/plafonlampa.svg)

A legalapvetőbb lámpatest: közvetlenül a mennyezetre szerelt test, opál vagy mintás burkolattal, a helyiség általános világítására. Lehet foglalatos (E27, E14) vagy integrált LED-es.

- **Szerelés:** mennyezetre, felületre szerelve
- **Fényforrás:** integrált LED, vagy E27 / E14 foglalat
- **Védettség:** IP20 · I. vagy II. érintésvédelmi osztály
- **Fény:** 1000–4000 lm a helyiség méretétől függően · 2700–4000 K · Ra ≥ 80, igényes helyen ≥ 90 · széles, diffúz
- **Vezérlés:** kapcsolt; dimmelhető kivitel fázishasításos vagy okos (Zigbee, Wi-Fi) vezérléssel; egyes típusokban CCT-állítás (vonalak: Hálózati 50 Hz, 2,4 GHz sáv)
- **Beépítés:**
  - A lámpakiállásnál a vezetéket sorkapocsba kötni; a védővezetőt I. osztályú testnél bekötni.
  - A test súlyához illő rögzítés: két vagy több csavar a mennyezet anyagához választott dübellel.
  - A burkolat cseréjéhez és a tisztításhoz hozzáférés maradjon.
- **Rögzítés:** Beton, Üreges födémpanel, Gipszkarton, Nylon terpesztődübel, Fém üreges fali dübel
- **Előírás:** MSZ EN 60598-1, MSZ EN 60598-2-1 (rögzített lámpatestek) (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** szoba, előszoba, folyosó, konyha általános világítása
- **Buktatók:**
  - Egyetlen középső lámpa a helyiség szélein sötét foltot hagy: nagyobb helyiségben kiegészítő fény kell.
  - Olcsó dimmelhető LED villoghat a régi dimmerrel: a dimmer és a lámpa kompatibilitása az adatlapon van.
- **Rokon típusok:** LED-korong lámpa („ufó”), Búrás mennyezeti lámpa, LED-panel
- **Keresőszavak:** HU: mennyezeti lámpa LED 24W · plafonlámpa 4000K — EN: ceiling light LED · flush mount ceiling light — DE: Deckenleuchte LED · Aufbauleuchte
- **Hol kapható:** Villamossági nagykereskedés, lámpaszaküzlet, barkácsáruház.

### LED-korong lámpa („ufó”)

*Más néven:* LED kerek lámpa, ufó lámpa, mozgásérzékelős mennyezeti lámpa

![LED-korong lámpa („ufó”)](svg/led-korong.svg)

Lapos, kerek, integrált LED-es lámpatest opál burkolattal. Gyakran IP44-es, így előszobába, fürdőbe, pincébe is jó; sok kivitelben mozgás- és fényérzékelővel.

- **Szerelés:** mennyezetre vagy falra, felületre szerelve
- **Fényforrás:** integrált LED
- **Védettség:** IP20 – IP65 (kiviteltől függően) · II. érintésvédelmi osztály (gyakran)
- **Fény:** 800–3000 lm · 3000–4000 K · Ra ≥ 80 · széles, diffúz
- **Vezérlés:** kapcsolt; beépített mozgás- és alkonyérzékelő; vészvilágítási kivitel is van (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Mozgásérzékelős kivitelnél az érzékelő látószöge és hatótávolsága határozza meg a helyet.
  - Érzékelős lámpát nem célszerű a falikapcsolóval is kapcsolni: lekapcsolt állapotban nem érzékel.
- **Rögzítés:** Beton, Gipszkarton, Nylon terpesztődübel, Becsavarható gipszkarton dübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** előszoba, folyosó, lépcsőház, kamra, pince, fürdő (IP44-es kivitel)
- **Buktatók:**
  - Az integrált LED nem cserélhető: a lámpa élettartama a LED-é és a meghajtóé.
- **Rokon típusok:** Mennyezeti lámpa (plafonlámpa), Fürdőszobai mennyezeti lámpa, Hajólámpa
- **Keresőszavak:** HU: LED mennyezeti lámpa mozgásérzékelős IP44 · LED korong lámpa — EN: LED ceiling light with motion sensor · round LED ceiling light IP44 — DE: LED Deckenleuchte mit Bewegungsmelder · LED Deckenleuchte IP44
- **Hol kapható:** Villamossági nagykereskedés, barkácsáruház.

### Búrás mennyezeti lámpa

*Más néven:* búra, gömblámpa, üvegbúrás lámpa

![Búrás mennyezeti lámpa](svg/bura.svg)

Foglalatos lámpatest üveg vagy műanyag búrával; a búra minden irányba szórja a fényt, a mennyezetet is megvilágítja. Klasszikus előszoba- és kamralámpa.

- **Szerelés:** mennyezetre, felületre szerelve
- **Fényforrás:** E27 vagy E14 foglalat (LED-fényforrással)
- **Védettség:** IP20 – IP44 · I. vagy II. érintésvédelmi osztály
- **Fény:** a fényforrástól függ: jellemzően 470–1500 lm · a fényforrástól függ · a fényforrástól függ · minden irányba
- **Vezérlés:** kapcsolt; dimmelhető fényforrással dimmelhető (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A búra súlya és rögzítése (csavaros, rugós) a cserét is meghatározza.
  - A foglalat hőterhelése: a megadott legnagyobb fényforrás-teljesítményt nem szabad túllépni.
- **Rögzítés:** Beton, Gipszkarton, Nylon terpesztődübel, Fém üreges fali dübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** előszoba, kamra, lépcső, régi lakások általános világítása
- **Buktatók:**
  - Zárt búra alatt a nem zárt lámpatestbe szánt LED-fényforrás túlmelegedhet: a fényforrás csomagolása jelzi, ha zárt lámpatestbe is való.
- **Rokon típusok:** Mennyezeti lámpa (plafonlámpa), Fali-mennyezeti búra
- **Keresőszavak:** HU: üvegbúrás mennyezeti lámpa E27 · gömb lámpa — EN: glass globe ceiling light E27 — DE: Glas Deckenleuchte E27 · Kugelleuchte
- **Hol kapható:** Lámpaszaküzlet, barkácsáruház.

### Csillár

*Más néven:* többkarú lámpa, kristálycsillár

![Csillár](svg/csillar.svg)

Díszítő, többkarú vagy függesztett lámpatest, sokszor több foglalattal. A fényt minden irányba szórja; a súlya és mérete miatt a rögzítése külön figyelmet kér.

- **Szerelés:** mennyezetre függesztve, kampóra vagy szerelőlapra
- **Fényforrás:** több E14 / E27 / G9 foglalat, vagy integrált LED
- **Védettség:** IP20 · I. érintésvédelmi osztály (fém test)
- **Fény:** a fényforrások összegétől függ · jellemzően 2700–3000 K · Ra ≥ 80, kristálynál ≥ 90 ajánlott · minden irányba
- **Vezérlés:** kapcsolt; csillárkapcsolóval két fokozatban (két áramkör); dimmelhető fényforrásokkal dimmelhető (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A súlyhoz méretezett rögzítés: födémbe beütős horgony kampóval, üreges födémbe billenő dübel, gipszkarton mennyezeten csak a vázszerkezetre vagy betétre.
  - Csillárkapcsolóhoz háromerű kiállás (két fázisvezető + nulla) és a védővezető.
  - A fém testet a védővezetőhöz kell kötni.
- **Rögzítés:** Beütős horgony, Billenő dübel, Vegyi dübel, Üreges födémpanel, Gipszkarton
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** nappali, étkező, előtér, magas belmagasságú terek
- **Buktatók:**
  - A régi kampó teherbírása ismeretlen: nehéz csillárhoz új rögzítés.
  - Sok kis foglalat sok G9 vagy E14 izzót jelent: a fényforrás-csere a karbantartás része.
- **Rokon típusok:** Függeszték, Mennyezeti lámpa (plafonlámpa)
- **Keresőszavak:** HU: csillár E14 · csillárkampó · csillárkapcsoló — EN: chandelier E14 · ceiling hook · two-gang light switch — DE: Kronleuchter E14 · Deckenhaken · Serienschalter
- **Hol kapható:** Lámpaszaküzlet, lakberendezési áruház.

### Függeszték

*Más néven:* függesztett lámpa, pendant lámpa, étkezőlámpa

![Függeszték](svg/fuggesztek.svg)

Egy vagy több, kábelen lógó lámpatest; az ernyő formája adja a fényt: zárt ernyőnél főleg lefelé, áttetszőnél részben a mennyezetre is. Asztal, pult, sziget fölé.

- **Szerelés:** mennyezetről zsinóron, láncon vagy acélsodronyon függesztve
- **Fényforrás:** E27 / E14 / GU10 foglalat vagy integrált LED
- **Védettség:** IP20 · I. vagy II. érintésvédelmi osztály
- **Fény:** 500–3000 lm testenként · 2700–3000 K (étkező), 3000–4000 K (konyhapult) · Ra ≥ 90 étel és asztal fölé · főleg le, a nyitott ernyőnél részben fel
- **Vezérlés:** kapcsolt vagy dimmelt; okos fényforrással (vonalak: Hálózati 50 Hz, 2,4 GHz sáv, DALI)
- **Beépítés:**
  - A rozetta (mennyezeti takaró) takarja a kiállást és tartja a súlyt.
  - Étkezőasztal fölött jellemzően 60–80 cm-rel az asztallap fölött; a kiállást az asztal tervezett helyéhez kell igazítani.
  - Több függesztékhez sor- vagy kör-rozetta, vagy külön kiállások.
- **Rögzítés:** Beton, Gipszkarton, Fém üreges fali dübel, Billenő dübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** étkező, konyhasziget, pult, lépcsőház (hosszú függeszték)
- **Buktatók:**
  - Ha az asztal helye változik, a kiállás rossz helyen marad: előre tervezni, vagy eltolható rozettát választani.
  - A túl alacsony függeszték káprázik és útban van.
- **Rokon típusok:** Csillár, Mennyezeti lámpa (plafonlámpa), Sínrendszer 230 V
- **Keresőszavak:** HU: függeszték lámpa E27 · rozetta · étkezőasztal lámpa — EN: pendant light E27 · ceiling rose · dining table pendant — DE: Pendelleuchte E27 · Baldachin · Esstischleuchte
- **Hol kapható:** Lámpaszaküzlet, lakberendezési áruház.

### LED-panel

*Más néven:* álmennyezeti panel 600×600, LED panel 60x60, raszteres lámpatest

![LED-panel](svg/led-panel.svg)

Lapos, négyszögletes lámpatest egyenletes, nagy felületű fénnyel; a 600 × 600-as méret az álmennyezeti rasztert követi. Irodák, rendelők, nagy konyhák.

- **Szerelés:** álmennyezeti raszterbe fektetve, vagy felületre szerelő keretben, vagy függesztve
- **Fényforrás:** integrált LED, külön meghajtóval
- **Védettség:** IP20 – IP44 (alulról IP54-es kivitel is) · II. érintésvédelmi osztály (gyakran)
- **Fény:** 3000–4500 lm (600 × 600) · 3000–4000 K (irodában 4000 K) · Ra ≥ 80 · széles; irodai kivitelben alacsony káprázás (UGR < 19)
- **Vezérlés:** kapcsolt, 1–10 V vagy DALI dimmelés (meghajtótól függ) (vonalak: Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA, DALI, Hálózati 50 Hz)
- **Beépítés:**
  - A meghajtót (drivert) a panel mögött, hozzáférhetően és szellőzve kell elhelyezni.
  - Felületre szerelő keretnél a mennyezet anyagához illő dübel; álmennyezetben a raszter terhelhetősége számít.
- **Rögzítés:** Gipszkarton, Fém üreges fali dübel, Beton
- **Előírás:** MSZ EN 60598-2-2 (süllyesztett lámpatestek), MSZ EN 12464-1 (munkahelyi világítás) (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 12464-1 · Munkahelyek világítása (beltér))
- **Rajzjel:** `lum.panel` (Rajztár)
- **Hova:** iroda, dolgozószoba, rendelő, nagy konyha, garázs
- **Buktatók:**
  - Lakásban a hideg, egyenletes fény könnyen irodaszerű; a színhőmérséklet és a dimmelés számít.
  - Az olcsó meghajtó villódzhat (flicker).
- **Rokon típusok:** Süllyesztett downlight, Mennyezeti lámpa (plafonlámpa)
- **Keresőszavak:** HU: LED panel 60x60 UGR19 · felületre szerelő keret LED panelhez — EN: LED panel 600x600 UGR<19 · surface mount frame — DE: LED Panel 62x62 UGR19 · Aufbaurahmen LED Panel
- **Hol kapható:** Villamossági nagykereskedés.

### Süllyesztett downlight

*Más néven:* beépíthető LED lámpa, mélysugárzó, LED downlight

![Süllyesztett downlight](svg/downlight.svg)

Az álmennyezetbe süllyesztett, lefelé világító lámpatest; a fényforrás a mennyezet síkja fölött ül, ezért kevésbé káprázik. A mélysugárzó a mélyebben ülő, kis káprázású változat.

- **Szerelés:** álmennyezetbe süllyesztve, rugós rögzítéssel
- **Fényforrás:** integrált LED (külső vagy beépített meghajtóval)
- **Védettség:** IP20 – IP44 (alulról) · II. érintésvédelmi osztály (gyakran)
- **Fény:** 400–2000 lm · 2700–4000 K · Ra ≥ 80, igényes helyen ≥ 90 · 60–100°
- **Vezérlés:** kapcsolt; fázishasításos, 1–10 V vagy DALI dimmelés a meghajtótól függően (vonalak: DALI, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA, Hálózati 50 Hz)
- **Beépítés:**
  - A kivágás átmérője és a beépítési mélység az adatlapon; a gipszkarton mögött a profil és a vezeték helye előre ellenőrizendő.
  - Hőszigetelés alá vagy közé csak arra minősített lámpatest kerülhet; a meghajtónak hely és szellőzés kell.
  - Kiosztás: egyenletes rács a helyiségben, a faltól nagyjából a lámpák közti távolság felére.
- **Rögzítés:** Gipszkarton, Gipszkarton körkivágó
- **Előírás:** MSZ EN 60598-2-2 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.spot` (Rajztár)
- **Hova:** nappali, konyha, folyosó, fürdő (IP44 alulról)
- **Buktatók:**
  - Túl sok, túl erős downlight hideg, „lyukacsos” mennyezetet ad.
  - A bekötődoboz nélküli meghajtót a gipszkarton mögött nem szabad szabadon hagyni: rögzíteni kell.
- **Rokon típusok:** Beépíthető spot, LED-panel, Fürdőszobai beépíthető spot
- **Keresőszavak:** HU: LED downlight beépíthető · mélysugárzó LED · kivágás 90 mm — EN: recessed LED downlight · cut-out 90 mm — DE: LED Einbaudownlight · Einbauleuchte Ausschnitt 90 mm
- **Hol kapható:** Villamossági nagykereskedés, világítástechnikai szaküzlet.

### Beépíthető spot

*Más néven:* süllyesztett spot, GU10 spot keret, billenthető spot

![Beépíthető spot](svg/beepitheto-spot.svg)

Keret cserélhető fényforrással (GU10 230 V-on, vagy GU5.3 / MR16 12 V-os tápegységgel) vagy beépített LED-modullal; keskenyebb nyalábbal, sokszor billenthetően, kiemelő és általános világításra.

- **Szerelés:** álmennyezetbe süllyesztve, rugós keretben
- **Fényforrás:** GU10, GU5.3 (12 V), vagy LED-modul
- **Védettség:** IP20 – IP65 (alulról, fürdős kivitel) · I. vagy II. érintésvédelmi osztály
- **Fény:** 300–700 lm spotonként · 2700–4000 K · Ra ≥ 80, kiemeléshez ≥ 90 · 24–60° (fényforrástól függ)
- **Vezérlés:** kapcsolt; dimmelhető fényforrással fázishasításos dimmerrel (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A kivágás általában 68–75 mm; a keret mögött a foglalat és a vezeték hely kér.
  - 12 V-os rendszernél a tápegység teljesítménye és a vezetékhossz (feszültségesés) számít.
- **Rögzítés:** Gipszkarton, Gipszkarton körkivágó
- **Előírás:** MSZ EN 60598-2-2 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.spot` (Rajztár)
- **Hova:** konyha, folyosó, nappali kiemelő világítása, fürdő (IP-s kivitel)
- **Buktatók:**
  - A régi halogén keret és egy LED-fényforrás hőben jól illik, de a 12 V-os halogén trafó nem mindig működik LED-del.
  - Keskeny nyalábbal a mennyezet alatti tér foltos.
- **Rokon típusok:** Süllyesztett downlight, Felületre szerelt spot, Fürdőszobai beépíthető spot
- **Keresőszavak:** HU: GU10 spot keret billenthető · beépíthető spotlámpa — EN: GU10 recessed spotlight frame · tiltable downlight — DE: GU10 Einbaustrahler schwenkbar · Einbaurahmen GU10
- **Hol kapható:** Villamossági nagykereskedés, barkácsáruház.

### Felületre szerelt spot

*Más néven:* mennyezeti spot, forgatható spotlámpa, henger spot

![Felületre szerelt spot](svg/falon-kivuli-spot.svg)

Egy vagy több forgatható, billenthető spot alapon vagy rúdon; ott, ahol nincs álmennyezet, de irányított fény kell.

- **Szerelés:** mennyezetre vagy falra, felületre szerelve
- **Fényforrás:** GU10 vagy integrált LED
- **Védettség:** IP20 · I. vagy II. érintésvédelmi osztály
- **Fény:** 300–700 lm spotonként · 2700–4000 K · Ra ≥ 80 · 24–60°
- **Vezérlés:** kapcsolt; dimmelhető fényforrással dimmelhető (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Egy kiállásról több spot: a rúd vagy a talp takarja a kiállást.
  - A forgatható fej kábelét ne törje meg a forgatás.
- **Rögzítés:** Beton, Gipszkarton, Nylon terpesztődübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.spot` (Rajztár)
- **Hova:** konyha, folyosó, régi lakás betonmennyezete
- **Buktatók:**
  - A szemmagasságba fordított spot káprázik.
- **Rokon típusok:** Beépíthető spot, Sínrendszer 230 V
- **Keresőszavak:** HU: mennyezeti spotlámpa 3 ágú GU10 — EN: surface mounted spotlight bar — DE: Deckenstrahler GU10 3-flammig
- **Hol kapható:** Lámpaszaküzlet, barkácsáruház.

### Sínrendszer 230 V

*Más néven:* áramsín, egyfázisú sín, háromfázisú sín, sínspot

![Sínrendszer 230 V](svg/sinrendszer-230.svg)

Fém sín, amelyben a hálózati vezetők futnak; a spotok adapterrel bárhová bepattinthatók és áthelyezhetők. A háromfázisú (három áramkörös) sínen a spotok három csoportban kapcsolhatók.

- **Szerelés:** mennyezetre szerelve, süllyesztve vagy függesztve
- **Fényforrás:** sínadapteres spotok (GU10 vagy integrált LED)
- **Védettség:** IP20 · I. érintésvédelmi osztály
- **Fény:** spotonként 500–3000 lm · 2700–4000 K · Ra ≥ 90 üzletben, kiemelésre · 10–60° (cserélhető optika)
- **Vezérlés:** egy vagy három kapcsolt kör; DALI-sín is van (vonalak: Hálózati 50 Hz, DALI)
- **Beépítés:**
  - A betáplálás a sín végén vagy közepén, a sínrendszer saját betápláló elemével.
  - Egy gyártó sínjei, adapterei és spotjai: a rendszerek nem keverhetők.
  - A sín terhelhetőségét (A) és a spotok összteljesítményét össze kell vetni.
- **Rögzítés:** Beton, Gipszkarton, Fém üreges fali dübel, Beütős horgony
- **Előírás:** MSZ EN 60570 (sínrendszerek) (kártyák: MSZ EN 60570 · Világítási sínrendszerek)
- **Rajzjel:** `lum.spot` (Rajztár)
- **Hova:** nappali, galéria, konyha, üzlet, bemutatótér
- **Buktatók:**
  - Egyfázisú és háromfázisú adapter nem cserélhető fel.
  - A „háromfázisú” sín lakásban három külön kapcsolt kört jelent, nem 400 V-ot a spotokon.
- **Rokon típusok:** Mágneses sín 48 V, Felületre szerelt spot, Függeszték
- **Keresőszavak:** HU: 3 fázisú sín · sínspot adapter · áramsín betápláló — EN: 3-circuit track · track spotlight · track feed — DE: 3-Phasen Stromschiene · Schienenstrahler · Einspeisung
- **Hol kapható:** Világítástechnikai szaküzlet, villamossági nagykereskedés.

### Mágneses sín 48 V

*Más néven:* mágneses sínrendszer, 48V track, magnetic track

![Mágneses sín 48 V](svg/magneses-sin-48v.svg)

Keskeny, törpefeszültségű (48 V DC) sín, amelybe a lámpamodulok mágnessel pattannak be: spot, vonali fény, függeszték egy rendszerben. A tápegység a sínen kívül van.

- **Szerelés:** mennyezetbe süllyesztve (keret nélkül is), felületre vagy függesztve
- **Fényforrás:** integrált LED-modulok
- **Védettség:** IP20 · III. érintésvédelmi osztály (SELV)
- **Fény:** modulonként 200–2000 lm · 2700–4000 K · Ra ≥ 90 (jellemző) · modultól függően 15–120°
- **Vezérlés:** a tápegység szerint: kapcsolt, DALI, Zigbee vagy saját rendszer (vonalak: DALI, 2,4 GHz sáv)
- **Beépítés:**
  - A tápegység teljesítménye és helye (hozzáférhetően, szellőzve) előre tervezendő.
  - Hosszabb sínszakaszon a feszültségesés miatt több betáplálás kellhet.
  - A süllyesztett, keret nélküli kivitelt a gipszkarton glettelése előtt kell beépíteni.
- **Rögzítés:** Gipszkarton, Fém üreges fali dübel, Beton
- **Előírás:** MSZ EN 60598-1, a tápegységre MSZ EN 61347 (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 61347 és MSZ EN 62776 · Működtetők és LED-csövek)
- **Rajzjel:** `lum.linear` (Rajztár)
- **Hova:** nappali, konyha, folyosó, modern belsőépítészet
- **Buktatók:**
  - A modulok gyártóhoz kötöttek.
  - A 48 V-os sín nem 230 V-os sín: a két rendszer elemei nem cserélhetők.
- **Rokon típusok:** Sínrendszer 230 V, Süllyesztett downlight
- **Keresőszavak:** HU: mágneses sín 48V · mágneses sín spot · 48V tápegység — EN: 48V magnetic track light · magnetic track spotlight — DE: 48V Magnetschiene · Magnetschienensystem
- **Hol kapható:** Világítástechnikai szaküzlet, villamossági nagykereskedés.

### Világító mennyezet

*Más néven:* feszített fényes mennyezet, világító felület, fénymennyezet

![Világító mennyezet](svg/vilagito-mennyezet.svg)

Áttetsző feszített fólia vagy lap mögé szerelt LED-szalagok vagy -modulok egyetlen, egyenletesen világító felületté. Égbolthatású, árnyékmentes fény.

- **Szerelés:** álmennyezet mögé vagy feszített fólia mögé építve
- **Fényforrás:** LED-szalag vagy LED-modulok tápegységgel
- **Védettség:** IP20 · III. érintésvédelmi osztály (SELV LED-ek)
- **Fény:** a felület méretétől függ · 2700–6500 K, gyakran hangolható · Ra ≥ 90 ajánlott · teljesen diffúz
- **Vezérlés:** DALI, 1–10 V vagy okos vezérlés; hangolható fehérnél két csatorna (vonalak: DALI, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA, 2,4 GHz sáv)
- **Beépítés:**
  - Az egyenletességhez a LED-ek és a fólia közti távolság számít: a gyártói távolságot tartani kell.
  - A tápegységek és a csatlakozások szervizelhetősége: bontható szakasz vagy revíziós nyílás.
  - A feszített mennyezet szerelőjével együtt kell tervezni.
- **Rögzítés:** Beton, Gipszkarton, Nylon terpesztődübel
- **Előírás:** MSZ EN 60598-1, MSZ EN 62471 (fotobiológiai biztonság) (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 62471 · Fotobiológiai biztonság)
- **Rajzjel:** `lum.panel` (Rajztár)
- **Hova:** fürdő, ablak nélküli helyiség, konyha, belsőépítészeti hangsúly
- **Buktatók:**
  - Túl kevés LED vagy túl kis távolság csíkos, pöttyös felületet ad.
  - A fólia mögötti meghibásodás javítása bontással jár.
- **Rokon típusok:** LED-panel, Mennyezeti lámpa (plafonlámpa)
- **Keresőszavak:** HU: feszített mennyezet világító · LED szalag fénymennyezethez — EN: backlit stretch ceiling · luminous ceiling — DE: Lichtdecke · beleuchtete Spanndecke
- **Hol kapható:** Feszített mennyezet szerelő, világítástechnikai szaküzlet.

## 2. Fali

### Falikar

*Más néven:* fali lámpa, fali dekorlámpa

![Falikar](svg/falikar.svg)

Falra szerelt lámpa ernyővel vagy búrával; hangulat- és kiegészítő világítás, sokszor párban (ágy két oldalán, tükör mellett, folyosón).

- **Szerelés:** falra szerelve, a kiállás fölött
- **Fényforrás:** E14 / G9 foglalat vagy integrált LED
- **Védettség:** IP20 · I. vagy II. érintésvédelmi osztály
- **Fény:** 200–800 lm · 2700–3000 K · Ra ≥ 80 · ernyőtől függően fel és le
- **Vezérlés:** kapcsolt; a lámpán lévő kapcsolóval vagy falikapcsolóval (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A fali kiállás magassága jellemzően 1,6–1,9 m, ágy fölött a fejtámlához igazítva.
  - A kiállás a lámpatest talpa alá essen: a pontos helyet a választott lámpa adja.
- **Rögzítés:** Tömör tégla, Üreges kerámia falazóblokk, Gipszkarton, Nylon terpesztődübel, Univerzális dübel, Fém üreges fali dübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.wall` (Rajztár)
- **Hova:** hálószoba, nappali, folyosó, lépcső
- **Buktatók:**
  - A kiállást a lámpa kiválasztása előtt elhelyezve a talp nem takarja a dobozt.
- **Rokon típusok:** Fali-mennyezeti búra, Fel-le világító fali lámpa, Olvasó falikar
- **Keresőszavak:** HU: falikar E14 · fali lámpa nappaliba — EN: wall sconce E14 · wall light — DE: Wandleuchte E14 · Wandlampe
- **Hol kapható:** Lámpaszaküzlet, lakberendezési áruház.

### Fali-mennyezeti búra

*Más néven:* fali búra, fali-mennyezeti lámpa

![Fali-mennyezeti búra](svg/fali-bura.svg)

Kis, búrás vagy opál burkolatú lámpatest, falra és mennyezetre is szerelhető; folyosók, lépcsők, kamrák, kisebb helyiségek alaplámpája.

- **Szerelés:** falra vagy mennyezetre, felületre szerelve
- **Fényforrás:** E27 / E14 foglalat vagy integrált LED
- **Védettség:** IP20 – IP44 · I. vagy II. érintésvédelmi osztály
- **Fény:** 400–1200 lm · 3000–4000 K · Ra ≥ 80 · minden irányba
- **Vezérlés:** kapcsolt; mozgásérzékelős kivitelben is (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Falra szerelve a magasság a helyiség funkciójához igazodik; lépcsőn a lépcsőfokokat ne a szembe világítsa.
- **Rögzítés:** Tömör tégla, Üreges kerámia falazóblokk, Beton, Nylon terpesztődübel, Univerzális dübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.wall` (Rajztár)
- **Hova:** folyosó, lépcső, kamra, mosókonyha
- **Buktatók:**
  - Zárt búrában a fényforrás melegszik: arra alkalmas LED kell.
- **Rokon típusok:** Búrás mennyezeti lámpa, Falikar, Hajólámpa
- **Keresőszavak:** HU: fali mennyezeti lámpa E27 — EN: wall ceiling light E27 — DE: Wand- und Deckenleuchte E27
- **Hol kapható:** Barkácsáruház, lámpaszaküzlet.

### Fel-le világító fali lámpa

*Más néven:* up-down lámpa, kétirányú fali spot

![Fel-le világító fali lámpa](svg/updown-fali.svg)

Henger vagy hasáb alakú fali lámpa, amely egy keskeny nyalábot felfelé, egyet lefelé küld; a falon jellegzetes fénycsíkot rajzol. Beltéri és IP-s kültéri kivitelben is.

- **Szerelés:** falra, felületre szerelve
- **Fényforrás:** 2 × GU10 vagy integrált LED
- **Védettség:** IP20 beltérben, IP44 – IP65 kültéren · I. vagy II. érintésvédelmi osztály
- **Fény:** 300–1000 lm · 2700–3000 K · Ra ≥ 80 · két keskeny nyaláb, 10–40°
- **Vezérlés:** kapcsolt; dimmelhető fényforrással (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Pontos, egyenes felszerelés: a ferde lámpa ferde fénycsíkot rajzol.
  - Több lámpánál egyforma magasság és köz.
- **Rögzítés:** Tömör tégla, Üreges kerámia falazóblokk, Gipszkarton, Nylon terpesztődübel, Univerzális dübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.wall` (Rajztár)
- **Hova:** folyosó, nappali hangulatfény, bejárat (kültéri kivitel)
- **Buktatók:**
  - Önmagában kevés fényt ad a helyiségbe: hangulatvilágítás.
- **Rokon típusok:** Falikar, Fali fényvető (wall washer)
- **Keresőszavak:** HU: fel le világító fali lámpa — EN: up down wall light — DE: Up-Down Wandleuchte
- **Hol kapható:** Lámpaszaküzlet, barkácsáruház.

### Olvasó falikar

*Más néven:* olvasólámpa falra, flexibilis karú fali lámpa, ágy melletti lámpa

![Olvasó falikar](svg/olvaso-falikar.svg)

Irányítható karú vagy hajlítható nyakú fali lámpa keskeny nyalábbal, olvasáshoz; sokszor saját kapcsolóval, néha USB-töltővel.

- **Szerelés:** falra szerelve, mozgatható karral
- **Fényforrás:** integrált LED vagy GU10 / E14
- **Védettség:** IP20 · I. vagy II. érintésvédelmi osztály
- **Fény:** 150–400 lm · 2700–3000 K · Ra ≥ 90 ajánlott olvasáshoz · 20–40°
- **Vezérlés:** a lámpán lévő kapcsolóval vagy érintéssel; néha dimmelhető (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Ágy mellett a fejtámla fölött, a fekvő és ülő olvasáshoz igazítva; a kiállás a talp alá kerüljön.
  - Ha a lámpán kapcsoló van, a kiállás folyamatos fázist kaphat, vagy kapcsolt kört a falikapcsolóval.
- **Rögzítés:** Tömör tégla, Gipszkarton, Nylon terpesztődübel, Fém üreges fali dübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.wall` (Rajztár)
- **Hova:** hálószoba, olvasósarok, szálloda
- **Buktatók:**
  - A másik ágy felé világító nyaláb zavar: keskeny nyaláb, jó irányítás.
- **Rokon típusok:** Falikar
- **Keresőszavak:** HU: olvasólámpa falra USB · ágy melletti fali lámpa — EN: bedside wall reading light — DE: Leselampe Wand · Bettleuchte
- **Hol kapható:** Lámpaszaküzlet, lakberendezési áruház.

### Képvilágító

*Más néven:* festményvilágító, picture light

![Képvilágító](svg/kepvilagito.svg)

A kép fölé szerelt, előre hajló karú lámpa, amely ferdén a képre világít; aszimmetrikus, a fal felé eső fényeloszlással.

- **Szerelés:** falra, a kép fölé, karral előrehajolva
- **Fényforrás:** integrált LED
- **Védettség:** IP20 · II. érintésvédelmi osztály vagy III. (SELV)
- **Fény:** 100–400 lm · 2700–3000 K · Ra ≥ 90, festményhez ≥ 95 · aszimmetrikus, a fal felé
- **Vezérlés:** kapcsolt vagy dimmelt (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A kiállás a kép fölött, a lámpa talpa alá; a kép helye és mérete előre egyeztetendő.
- **Rögzítés:** Tömör tégla, Gipszkarton, Nylon terpesztődübel, Fém üreges fali dübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.wall` (Rajztár)
- **Hova:** nappali, folyosó, galéria
- **Buktatók:**
  - Az UV- és hősugárzás a festményt károsíthatja: LED-es, UV-mentes fényforrás.
- **Rokon típusok:** Fali fényvető (wall washer)
- **Keresőszavak:** HU: képvilágító LED — EN: LED picture light — DE: LED Bilderleuchte
- **Hol kapható:** Lámpaszaküzlet.

### Falba süllyesztett lépcső- és orientációs fény

*Más néven:* lépcsővilágítás, orientációs fény, falba süllyesztett lámpa

![Falba süllyesztett lépcső- és orientációs fény](svg/lepcsofeny.svg)

Alacsonyan, a falba süllyesztett kis lámpa, amely lefelé, a padlóra és a lépcsőfokra világít; éjszakai tájékozódásra és lépcsőkhöz. Sok típus a szabványos szerelvénydobozba illik.

- **Szerelés:** falba süllyesztve, szerelvénydobozba vagy saját beépítő dobozba
- **Fényforrás:** integrált LED (230 V vagy 12–24 V)
- **Védettség:** IP20 beltérben, IP44 – IP65 kültéren · II. vagy III. érintésvédelmi osztály
- **Fény:** 20–200 lm · 2700–3000 K · Ra ≥ 80 · aszimmetrikus, lefelé a padlóra
- **Vezérlés:** kapcsolt, mozgásérzékelővel, alkonykapcsolóval vagy okos vezérléssel; éjszakai, gyenge fokozat (vonalak: Hálózati 50 Hz, 2,4 GHz sáv)
- **Beépítés:**
  - Szerelvénydobozba illő típusnál a dobozt a fal síkjában és vízszintesen kell beépíteni (dobozfúró).
  - Lépcsőnél jellemzően a fokok fölött 20–40 cm-rel; minden fokhoz vagy minden másodikhoz.
  - 12–24 V-os kivitelnél a tápegység helye és hozzáférhetősége.
- **Rögzítés:** Dobozfúró korona, Üreges kerámia falazóblokk, Gipszkarton, Gipszkarton körkivágó
- **Előírás:** MSZ EN 60598-2-2 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.wall` (Rajztár)
- **Hova:** lépcső, folyosó, hálószoba éjszakai fénye, terasz
- **Buktatók:**
  - A doboz helyét a burkolat és a lépcsőfokok végleges síkjához kell igazítani.
- **Rokon típusok:** Fali fényvető (wall washer), Fali-mennyezeti búra
- **Keresőszavak:** HU: lépcsővilágító lámpa falba süllyesztett · orientációs fény szerelvénydobozba — EN: recessed step light · orientation light for flush box — DE: Treppenstufenleuchte Unterputz · Orientierungsleuchte UP-Dose
- **Hol kapható:** Villamossági nagykereskedés, lámpaszaküzlet.

### Fali fényvető (wall washer)

*Más néven:* falmosó lámpa, wall washer, wall grazer

![Fali fényvető (wall washer)](svg/fali-fenyveto.svg)

A falfelületet egyenletesen „mosó” vagy súrolófényben kirajzoló, aszimmetrikus lámpatest; a falat teszi világossá, nem a teret. Kőfal, tégla, textúra kiemelésére.

- **Szerelés:** a fal elé, mennyezetre, padlóba vagy a fal tövébe
- **Fényforrás:** integrált LED
- **Védettség:** IP20 – IP67 (padlóba és kültérre) · II. vagy III. érintésvédelmi osztály
- **Fény:** 500–3000 lm · 2700–4000 K · Ra ≥ 90 · aszimmetrikus, a fal felé
- **Vezérlés:** kapcsolt, DALI vagy 1–10 V dimmelés (vonalak: DALI, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA)
- **Beépítés:**
  - A faltól mért távolság határozza meg az egyenletességet: a gyártói távolságot kell tartani.
  - Súrolófénynél (közel a falhoz) minden falhiba látszik: előtte a fal síkja.
- **Rögzítés:** Beton, Gipszkarton, Fém üreges fali dübel
- **Előírás:** MSZ EN 60598-2-2 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.linear` (Rajztár)
- **Hova:** nappali, előtér, lépcsőház, homlokzat (kültéri kivitel)
- **Buktatók:**
  - A súrolófény minden glettelési hibát kiemel.
- **Rokon típusok:** Képvilágító, Fel-le világító fali lámpa
- **Keresőszavak:** HU: wall washer LED · falmosó lámpatest — EN: LED wall washer · wall grazer — DE: Wandfluter LED
- **Hol kapható:** Világítástechnikai szaküzlet.

## 3. Rejtett és vonali

### LED-szalag (12 / 24 V)

*Más néven:* LED szalag, LED strip, COB szalag, SMD szalag

![LED-szalag (12 / 24 V)](svg/led-szalag.svg)

Hajlékony nyomtatott áramkör, rajta sűrűn LED-ek; törpefeszültségű tápegységről működik, méterenként vágható. A COB-szalagon a LED-ek pontjai nem látszanak, folytonos fénycsíkot ad. Szinte minden rejtett és vonali világítás alapja.

- **Szerelés:** alumínium profilba ragasztva, vagy közvetlenül felületre
- **Fényforrás:** SMD vagy COB LED-ek a szalagon; egyszínű, hangolható fehér (CCT), RGB, RGBW
- **Védettség:** IP20 beltérben, IP54 – IP67 szilikonbevonattal · III. érintésvédelmi osztály (SELV), a tápegység II.
- **Fény:** méterenként 300–2000 lm · 2700–6500 K vagy hangolható · Ra ≥ 90 ajánlott (olcsó szalagnál 80 alatti is van) · kb. 120°
- **Vezérlés:** PWM-vezérlő a tápegység után: nyomógomb, rádiós (Zigbee, Wi-Fi), DALI vagy 1–10 V bemenetű vezérlő (vonalak: DALI, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA, 2,4 GHz sáv)
- **Beépítés:**
  - A szalag melegszik: alumínium profilba ragasztva marad tartós; a profil hűtőborda is.
  - Feszültségesés: 24 V-os szalagot nagyjából 5 m-enként érdemes táplálni (12 V-osat sűrűbben), hosszú szakaszt két végéről vagy középről.
  - A tápegység teljesítménye a szalag teljesítményénél 20–30 %-kal nagyobb legyen; hozzáférhető, szellőző helyre.
  - Csak a jelölt vágási pontokon vágható; a csatlakozás forrasztva vagy gyári csatlakozóval.
- **Rögzítés:** Forgácslapcsavar, Gipszkarton csavar, Nylon terpesztődübel
- **Előírás:** MSZ EN 60598-2-21 (LED-szalag mint lámpatest), a tápegységre MSZ EN 61347 (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 61347 és MSZ EN 62776 · Működtetők és LED-csövek)
- **Rajzjel:** `lum.strip` (Rajztár)
- **Hova:** konyha, nappali rejtett fénye, lépcső, bútor, polc, tükör, kert (IP-s kivitel)
- **Buktatók:**
  - Profil nélkül a ragasztó elenged és a LED-ek hamar öregednek.
  - Az egy ponton táplált hosszú szalag vége halványabb és sárgább.
  - Az olcsó szalag színe tételenként eltér: egy helyiségbe egy tételből.
- **Rokon típusok:** Alumínium profil LED-szalaghoz, LED neon flex, Hálózati feszültségű LED-szalag (230 V), Rejtett (indirekt) világítás párkányban
- **Keresőszavak:** HU: LED szalag 24V CRI90 · COB LED szalag · LED tápegység 24V — EN: 24V LED strip CRI 90 · COB LED strip · 24V LED driver — DE: LED Streifen 24V CRI90 · COB LED Streifen · LED Netzteil 24V
- **Hol kapható:** Villamossági nagykereskedés, LED-szaküzlet.

### Hálózati feszültségű LED-szalag (230 V)

*Más néven:* 230V LED szalag, high voltage LED strip

![Hálózati feszültségű LED-szalag (230 V)](svg/led-szalag-230v.svg)

Tápegység nélkül, közvetlenül 230 V-ról működő szalag; hosszú szakaszok (akár 50 m) táplálhatók egy pontról, de csak nagyobb, 0,5–1 m-es egységekben vágható, és a feszültség miatt másképp kell kezelni.

- **Szerelés:** felületre, klipszekkel vagy profilban
- **Fényforrás:** LED-ek egyenirányítóval, szilikonbevonatban
- **Védettség:** IP65 – IP67 · II. érintésvédelmi osztály a gyártó szerint
- **Fény:** méterenként 500–1500 lm · 2700–6500 K · Ra ≥ 80 · kb. 120°
- **Vezérlés:** kapcsolt; dimmelhető kivitel fázishasításos dimmerrel (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Csak a gyártó saját betápláló kábelével és végzáró sapkájával: a szalag érintésre veszélyes feszültségen van.
  - Hálózati áramkör áram-védőkapcsolóval.
  - Nem vágható tetszőlegesen: csak a jelölt egységhatáron.
- **Rögzítés:** Nylon terpesztődübel, Forgácslapcsavar, Beton
- **Előírás:** MSZ EN 60598-2-21 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.strip` (Rajztár)
- **Hova:** kültéri kontúr, eresz, hosszú korlát, csarnok
- **Buktatók:**
  - Sérült szigetelésű vagy rosszul lezárt végű szalag áramütésveszélyes.
  - Az egyenirányító miatt villódzhat (100 Hz).
- **Rokon típusok:** LED-szalag (12 / 24 V), LED neon flex
- **Keresőszavak:** HU: 230V LED szalag · hálózati LED szalag betápláló — EN: 230V LED strip · high voltage LED strip — DE: 230V LED Streifen · Hochvolt LED Band
- **Hol kapható:** LED-szaküzlet, villamossági nagykereskedés.

### Alumínium profil LED-szalaghoz

*Más néven:* LED profil, LED alu profil, sarokprofil, süllyesztett profil

![Alumínium profil LED-szalaghoz](svg/led-profil.svg)

Alumínium sín búrával (opál, félig áttetsző vagy víztiszta), amely tartja és hűti a LED-szalagot, és a fényét egyenletes csíkká szórja. A szalagból így vonali lámpatest lesz.

- **Szerelés:** felületre, süllyesztve (falba, bútorba, gipszkartonba), sarokba vagy függesztve
- **Fényforrás:** LED-szalag (12 / 24 V)
- **Védettség:** IP20 (tömítéssel IP44 – IP65) · III. érintésvédelmi osztály (SELV)
- **Fény:** a szalagtól függ; az opál búra 10–30 %-ot elnyel · a szalagtól függ · a szalagtól függ · opál búrával szórt, víztisztával a szalagé
- **Vezérlés:** mint a LED-szalagé (vonalak: DALI, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA, 2,4 GHz sáv)
- **Beépítés:**
  - Egyenletes fénycsíkhoz a szalag és az opál búra közti távolság számít: mélyebb profil vagy COB-szalag kell, ha nem lehet pöttyös.
  - Süllyesztett profilnál a horony a profil méretére, a glettelés előtt.
  - A vezeték bevezetése a profil végén vagy hátulján: a végzáró és a kábelfurat előre.
- **Rögzítés:** Gipszkarton, Gipszkarton csavar, Forgácslapcsavar, OSB és forgácslap, Nylon terpesztődübel
- **Előírás:** MSZ EN 60598-2-21 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.linear` (Rajztár)
- **Hova:** konyhapult, lépcső, bútor, fal- és mennyezeti fénycsík
- **Buktatók:**
  - A víztiszta búrán át a LED-pontok tükröződnek a fényes felületeken.
- **Rokon típusok:** LED-szalag (12 / 24 V), Keret nélküli (trimless) beépítés, Konyhai pult alatti világítás
- **Keresőszavak:** HU: LED alu profil opál búrával · süllyesztett LED profil · sarok LED profil — EN: aluminium LED profile with diffuser · recessed LED profile · corner LED profile — DE: LED Aluprofil mit Abdeckung · Einbauprofil LED · Eckprofil LED
- **Hol kapható:** LED-szaküzlet, villamossági nagykereskedés.

### LED neon flex

*Más néven:* neon flex, szilikon LED cső, LED neon

![LED neon flex](svg/neon-flex.svg)

Tömör, szilikon testű, hajlítható LED-szalag, amely folytonos, neoncsőszerű fénycsíkot ad. Íveket, betűket, kontúrokat lehet vele rajzolni; kültérre is jó.

- **Szerelés:** rögzítőklipszekkel vagy profilban, hajlítva
- **Fényforrás:** LED-ek szilikontestben (12 / 24 V, ritkán 230 V)
- **Védettség:** IP65 – IP68 · III. érintésvédelmi osztály (törpefeszültségű kivitel)
- **Fény:** méterenként 100–800 lm · 2700–6500 K vagy színes · Ra ≥ 80 · felülnéző vagy oldalnéző, egyes típusok 360°
- **Vezérlés:** mint a LED-szalagé (vonalak: 2,4 GHz sáv, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA)
- **Beépítés:**
  - A legkisebb hajlítási sugarat és a hajlítás irányát (oldalra vagy felfelé) a típus adja meg.
  - A vágási pontok ritkábbak; a végeket szilikonnal és gyári sapkával kell zárni.
- **Rögzítés:** Nylon terpesztődübel, Forgácslapcsavar, Beton
- **Előírás:** MSZ EN 60598-2-21 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.strip` (Rajztár)
- **Hova:** díszvilágítás, felirat, lépcső élfénye, kert, medence széle
- **Buktatók:**
  - A rosszul lezárt vég beázik.
- **Rokon típusok:** LED-szalag (12 / 24 V), Hálózati feszültségű LED-szalag (230 V)
- **Keresőszavak:** HU: LED neon flex 24V · szilikon LED szalag — EN: LED neon flex 24V · silicone LED neon — DE: LED Neon Flex 24V · Silikon LED Schlauch
- **Hol kapható:** LED-szaküzlet.

### Rejtett (indirekt) világítás párkányban

*Más néven:* indirekt világítás, koronaléc világítás, gipszkarton párkány fény, kazettás fény

![Rejtett (indirekt) világítás párkányban](svg/rejtett-parkany.svg)

A LED-szalag a mennyezet széle mentén egy párkány vagy léc mögé kerül, és a fényt a mennyezetre és a falra veti; a fényforrás nem látszik, csak a megvilágított felület. Lágy hangulat- és alapfény.

- **Szerelés:** gipszkarton párkány, koronaléc vagy kazetta mögé rejtve
- **Fényforrás:** LED-szalag profilban
- **Védettség:** IP20 · III. érintésvédelmi osztály (SELV)
- **Fény:** méterenként 600–1500 lm a kívánt fényerőtől függően · 2700–3000 K · Ra ≥ 90 · aszimmetrikus, a mennyezet felé
- **Vezérlés:** dimmelt: DALI, 1–10 V, rádiós vezérlő (vonalak: DALI, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA, 2,4 GHz sáv)
- **Beépítés:**
  - A párkány méreteit (magasság, kinyúlás) a szalaggal együtt kell tervezni a szárazépítővel.
  - A szalag ne látsszon a helyiség egyik pontjáról se; a fény ne vágjon éles csíkot a mennyezetre.
  - A tápegységnek hozzáférhető hely: revíziós nyílás vagy a párkány bontható része.
- **Rögzítés:** Gipszkarton, Gipszkarton csavar, Forgácslapcsavar
- **Előírás:** MSZ EN 60598-2-21 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.strip` (Rajztár)
- **Hova:** nappali, hálószoba, előtér
- **Buktatók:**
  - Egyenetlen mennyezeten a súroló fény minden hibát kiemel.
  - Túl közel a mennyezethez forró, foltos csík lesz.
- **Rokon típusok:** LED-szalag (12 / 24 V), Alumínium profil LED-szalaghoz, Világító mennyezet
- **Keresőszavak:** HU: indirekt világítás gipszkarton párkány · rejtett LED világítás — EN: cove lighting · indirect LED lighting — DE: Lichtvoute · indirekte Beleuchtung LED
- **Hol kapható:** LED-szaküzlet, szárazépítő anyagkereskedés.

### Keret nélküli (trimless) beépítés

*Más néven:* trimless spot, bevakolható profil, keret nélküli downlight

![Keret nélküli (trimless) beépítés](svg/trimless.svg)

A spot vagy a profil pereme a gipszkarton vagy a vakolat alá kerül, és a felülettel egy síkba glettelik; a mennyezeten csak a fénynyílás látszik, keret nem.

- **Szerelés:** gipszkartonba vagy vakolatba beépítve és a felülettel egy síkba glettelve
- **Fényforrás:** integrált LED vagy cserélhető modul (GU10, MR16) a beépítő házban
- **Védettség:** IP20 · a lámpatesttől függően
- **Fény:** a betéttől függ · 2700–4000 K · Ra ≥ 90 · a betéttől függ
- **Vezérlés:** a betéttől függ; gyakran DALI vagy fázishasításos dimmelés (vonalak: DALI, Hálózati 50 Hz)
- **Beépítés:**
  - A beépítő házat a gipszkarton szerelése közben kell elhelyezni, a glettelés és a festés előtt: ezt a szárazépítővel és a festővel egyeztetni kell.
  - A betétnek cserélhetőnek kell maradnia alulról.
  - A pontos kivágás a gyártói sablonnal.
- **Rögzítés:** Gipszkarton, Gipszkarton körkivágó, Gipszkarton csavar
- **Előírás:** MSZ EN 60598-2-2 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.spot` (Rajztár)
- **Hova:** nappali, galéria, igényes belsőépítészet
- **Buktatók:**
  - Utólag nem lehet trimless-re cserélni: a glettelés előtt dől el.
  - A ház mögötti tér nem lehet szigeteléssel betöltve, ha a lámpa nem arra minősített.
- **Rokon típusok:** Süllyesztett downlight, Alumínium profil LED-szalaghoz, Mágneses sín 48 V
- **Keresőszavak:** HU: trimless spot gipszkartonba · bevakolható LED profil — EN: trimless downlight plaster-in · plaster-in LED profile — DE: Trimless Einbaustrahler · Einputzprofil LED
- **Hol kapható:** Világítástechnikai szaküzlet.

### Árnyékfuga- és lábazatvilágítás

*Más néven:* padlószegély fény, lebegő hatás, árnyékfuga LED

![Árnyékfuga- és lábazatvilágítás](svg/arnyekfuga.svg)

A padló menti fugában vagy szegélylécben futó LED-szalag lefelé, a padlóra világít; a fal „lebeg”, és éjszakai tájékozódó fényként is szolgál.

- **Szerelés:** a padló és a fal találkozásánál, árnyékfugába vagy szegélyprofilba
- **Fényforrás:** LED-szalag profilban
- **Védettség:** IP20 – IP44 · III. érintésvédelmi osztály (SELV)
- **Fény:** méterenként 100–400 lm · 2700–3000 K · Ra ≥ 80 · aszimmetrikus, a padló felé
- **Vezérlés:** kapcsolt, mozgásérzékelővel vagy okos vezérléssel; éjszakai fokozat (vonalak: 2,4 GHz sáv, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA)
- **Beépítés:**
  - A profilt a burkolással és a falszerkezettel együtt kell tervezni.
  - A padlófelmosás vize ne érje a szalagot: tömített kivitel.
- **Rögzítés:** Gipszkarton, Forgácslapcsavar, Nylon terpesztődübel
- **Előírás:** MSZ EN 60598-2-21 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.strip` (Rajztár)
- **Hova:** folyosó, hálószoba, fürdő, lépcső
- **Buktatók:**
  - A fényes padló tükrözi a szalagot.
- **Rokon típusok:** LED-szalag (12 / 24 V), Falba süllyesztett lépcső- és orientációs fény, Ágy alatti orientációs fény
- **Keresőszavak:** HU: LED szegélyprofil · árnyékfuga világítás — EN: LED skirting light · shadow gap lighting — DE: LED Sockelleiste · Schattenfuge Beleuchtung
- **Hol kapható:** LED-szaküzlet, burkolóanyag-kereskedés.

## 4. Bútor és beépített

### Konyhai pult alatti világítás

*Más néven:* pultvilágítás, felső szekrény alatti lámpa, konyhai munkafény

![Konyhai pult alatti világítás](svg/pult-alatti.svg)

A munkalapot a felső szekrények aljából megvilágító vonali fény: profilos LED-szalag vagy lapos LED-lámpatest. A mennyezeti lámpától a munkavégző test árnyékot vet; ez a fény azt szünteti meg.

- **Szerelés:** a felső konyhaszekrények alá, a fal közelébe
- **Fényforrás:** LED-szalag profilban vagy integrált LED-es pultvilágító
- **Védettség:** IP20 – IP44 · III. érintésvédelmi osztály (SELV) vagy II.
- **Fény:** méterenként 400–1200 lm · 3000–4000 K · Ra ≥ 90 (az étel színe) · lefelé, a munkalapra
- **Vezérlés:** falikapcsoló, a profilba épített kézlegyintéses vagy érintő kapcsoló, okos vezérlés (vonalak: 2,4 GHz sáv, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA)
- **Beépítés:**
  - A fényt a szekrény elülső széléhez közel, a fal felé irányítva: így a fényes csempe nem tükröz.
  - A tápegység a felső szekrény fölé vagy mögé, hozzáférhetően; a kiállás helye a konyhatervből.
  - A vezetékeket a konyhabútor szerelése előtt kell kivezetni.
- **Rögzítés:** OSB és forgácslap, Forgácslapcsavar
- **Előírás:** MSZ EN 60598-2-21 / -2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.linear` (Rajztár)
- **Hova:** konyha, kamra, mosókonyha
- **Buktatók:**
  - A fényes csempén és a munkalapon a LED-pontok tükröződnek: opál búra.
  - A kézlegyintéses kapcsoló a pára és a gőz miatt tévesen is kapcsolhat.
- **Rokon típusok:** Alumínium profil LED-szalaghoz, LED-szalag (12 / 24 V), Polc- és vitrinvilágítás
- **Keresőszavak:** HU: pult alatti LED világítás · LED profil konyhába érintőkapcsolós — EN: under cabinet LED lighting · kitchen LED profile with touch switch — DE: Unterbauleuchte LED Küche · LED Profil mit Sensor
- **Hol kapható:** LED-szaküzlet, konyhabútor-szerelő.

### Szekrény- és gardróbvilágítás

*Más néven:* gardróbvilágítás, ajtókapcsolós szekrényfény, akkus szekrénylámpa

![Szekrény- és gardróbvilágítás](svg/szekreny-vilagitas.svg)

A szekrény belsejét az ajtó nyitásakor bekapcsoló fény: profilos LED-szalag, LED-es ruharúd vagy kis lámpatest, ajtókapcsolóval vagy mozgásérzékelővel; vezeték nélküli helyen akkus kivitelben.

- **Szerelés:** a szekrény belső tetejére, oldalára vagy a ruharúdba
- **Fényforrás:** LED-szalag, LED-es ruharúd, akkus LED-lámpa
- **Védettség:** IP20 · III. érintésvédelmi osztály (SELV)
- **Fény:** 100–600 lm · 3000–4000 K · Ra ≥ 90 (a ruha színe) · lefelé, a polcokra
- **Vezérlés:** ajtókapcsoló, mozgásérzékelő (vonalak: Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA)
- **Beépítés:**
  - A tápegység a szekrény tetején vagy mögötte; a kiállást a gardróbtervhez kell igazítani.
  - A szalag ne melegítse a ruhát: profilban.
- **Rögzítés:** OSB és forgácslap, Forgácslapcsavar
- **Előírás:** MSZ EN 60598-2-21 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.strip` (Rajztár)
- **Hova:** gardrób, beépített szekrény, kamra
- **Buktatók:**
  - Az akkus lámpa kényelmes, de rendszeres töltést kér.
- **Rokon típusok:** Konyhai pult alatti világítás, Alumínium profil LED-szalaghoz
- **Keresőszavak:** HU: szekrényvilágítás mozgásérzékelős · LED ruharúd · ajtókapcsoló LED-hez — EN: wardrobe light with sensor · LED wardrobe rail · door switch for LED — DE: Schrankbeleuchtung mit Sensor · LED Kleiderstange · Türkontaktschalter LED
- **Hol kapható:** Bútorvasalat-kereskedés, LED-szaküzlet.

### Polc- és vitrinvilágítás

*Más néven:* vitrinvilágítás, üvegpolc világítás, könyvespolc fény

![Polc- és vitrinvilágítás](svg/polc-vitrin.svg)

A polcon vagy a vitrinben lévő tárgyakat kiemelő fény: keskeny LED-profil, az üvegpolc élét megvilágító fény vagy mini spot. Kis fényerő, jó színvisszaadás.

- **Szerelés:** polc elejébe vagy aljába, üvegpolc élébe, vitrin tetejébe
- **Fényforrás:** LED-szalag profilban, bútorspot
- **Védettség:** IP20 · III. érintésvédelmi osztály (SELV)
- **Fény:** méterenként 100–500 lm · 2700–3000 K · Ra ≥ 90 · keskeny vagy szórt
- **Vezérlés:** kapcsolt, dimmelt; a vitrin érintőkapcsolója (vonalak: Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA, 2,4 GHz sáv)
- **Beépítés:**
  - A vezetékeket a bútor gyártása közben kell elvezetni; utólag csak kábelcsatornával.
  - Üvegpolcnál a fény az él felől jut be: a polc tartóiba épített LED-del.
- **Rögzítés:** Forgácslapcsavar, OSB és forgácslap
- **Előírás:** MSZ EN 60598-2-21 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.strip` (Rajztár)
- **Hova:** nappali, könyvtár, bemutatótér
- **Buktatók:**
  - Tükröződés az üvegen: a fény irányát a nézőponthoz kell igazítani.
- **Rokon típusok:** Bútorspot, Konyhai pult alatti világítás
- **Keresőszavak:** HU: vitrin LED világítás · üvegpolc LED — EN: cabinet display lighting · glass shelf LED — DE: Vitrinenbeleuchtung LED · Glaskantenbeleuchtung
- **Hol kapható:** Bútorvasalat-kereskedés, LED-szaküzlet.

### Bútorspot

*Más néven:* mini spot 12 V, bútorba süllyesztett spot, puck light

![Bútorspot](svg/butorspot.svg)

Kis, kerek LED-spot (12 / 24 V) bútorlapba süllyesztve, pult, polc, vitrin vagy mosdópult fölé.

- **Szerelés:** bútorba süllyesztve vagy felületre szerelve
- **Fényforrás:** integrált LED
- **Védettség:** IP20 – IP44 · III. érintésvédelmi osztály (SELV)
- **Fény:** 50–250 lm · 2700–4000 K · Ra ≥ 90 · 30–60°
- **Vezérlés:** kapcsolt, dimmelt; elosztóval több spot egy tápegységről (vonalak: Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA, 2,4 GHz sáv)
- **Beépítés:**
  - Az elosztó és a csatlakozók egy gyártói rendszerből; a polaritás számít.
  - A furat mélysége a bútorlap vastagságához: a forgácslap ne repedjen.
- **Rögzítés:** Forgácslapcsavar, OSB és forgácslap
- **Előírás:** MSZ EN 60598-2-2 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.spot` (Rajztár)
- **Hova:** konyha, fürdő mosdópultja, vitrin, ágy feletti polc
- **Buktatók:**
  - Sok kis spot sok kábel: a tápegység és az elosztó helye előre.
- **Rokon típusok:** Polc- és vitrinvilágítás, Konyhai pult alatti világítás
- **Keresőszavak:** HU: bútorspot 12V · LED mini spot bútorba — EN: 12V cabinet puck light · furniture spotlight — DE: Möbeleinbaustrahler 12V · LED Möbelspot
- **Hol kapható:** Bútorvasalat-kereskedés, LED-szaküzlet.

### Ágy alatti orientációs fény

*Más néven:* ágyvilágítás mozgásérzékelővel, éjszakai ágyfény

![Ágy alatti orientációs fény](svg/agy-alatti.svg)

Az ágy aljára szerelt LED-szalag, amely felkeléskor mozgásérzékelőre halványan a padlóra világít; éjszakai tájékozódás anélkül, hogy a többi alvót felébresztené.

- **Szerelés:** az ágy keretének aljára
- **Fényforrás:** LED-szalag
- **Védettség:** IP20 · III. érintésvédelmi osztály (SELV)
- **Fény:** méterenként 50–200 lm · 2200–2700 K · Ra ≥ 80 · aszimmetrikus, lefelé
- **Vezérlés:** mozgásérzékelő időzítéssel, alkonykapcsolóval (vonalak: 2,4 GHz sáv)
- **Beépítés:**
  - A tápegység a fali aljzatról; a kábel ne essen a lábak útjába.
- **Rögzítés:** Fa, Forgácslapcsavar
- **Előírás:** MSZ EN 60598-2-21 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.strip` (Rajztár)
- **Hova:** hálószoba, gyerekszoba, idősek otthona
- **Buktatók:**
  - A túl erős vagy hideg fény felébreszt.
- **Rokon típusok:** Árnyékfuga- és lábazatvilágítás, Falba süllyesztett lépcső- és orientációs fény
- **Keresőszavak:** HU: ágyvilágítás mozgásérzékelős LED — EN: under bed motion sensor light — DE: Bettbeleuchtung mit Bewegungsmelder
- **Hol kapható:** LED-szaküzlet, lakberendezési áruház.

### Lépcsőfokba épített világítás

*Más néven:* lépcsővezérlő LED, futófényes lépcső, lépcsőfok LED-profil

![Lépcsőfokba épített világítás](svg/lepcsofok-vilagitas.svg)

Minden fok alá vagy élébe épített LED-profil, amelyet egy lépcsővezérlő a lépcső aljára és tetejére tett érzékelőkre fokonként, „futva” kapcsol fel és le.

- **Szerelés:** minden lépcsőfok élébe vagy alá profilban
- **Fényforrás:** LED-szalag profilban, fokonként
- **Védettség:** IP20 – IP44 · III. érintésvédelmi osztály (SELV)
- **Fény:** fokonként 50–200 lm · 2700–3000 K · Ra ≥ 80 · aszimmetrikus, a fokra
- **Vezérlés:** lépcsővezérlő mozgásérzékelőkkel (alul, felül), éjszakai alapfényerővel (vonalak: Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA, 2,4 GHz sáv)
- **Beépítés:**
  - Fokonként külön vezeték a vezérlőig: a lépcső építése vagy burkolása előtt kell behúzni.
  - A vezérlő és a tápegység hozzáférhető helyre (lépcső alatti tér, revíziós nyílás).
- **Rögzítés:** Fa, Beton, Forgácslapcsavar, Nylon terpesztődübel
- **Előírás:** MSZ EN 60598-2-21 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.strip` (Rajztár)
- **Hova:** belső lépcső, pincelépcső, kültéri lépcső (IP-s kivitel)
- **Buktatók:**
  - A fokonkénti vezetékezés utólag szinte lehetetlen.
- **Rokon típusok:** Falba süllyesztett lépcső- és orientációs fény, Alumínium profil LED-szalaghoz
- **Keresőszavak:** HU: lépcsővezérlő LED · lépcső világítás futófény — EN: LED stair light controller · stair lighting sequential — DE: Treppenlichtsteuerung LED · Lauflicht Treppe
- **Hol kapható:** LED-szaküzlet.

## 5. Dugaszolós

### Állólámpa

*Más néven:* olvasó állólámpa, uplighter, ívlámpa

![Állólámpa](svg/allolampa.svg)

Padlón álló, dugaszolós lámpa: felfelé világító (uplighter) a mennyezetre, olvasó karral, vagy íves karral az ülőhely fölé. Szabadon mozgatható kiegészítő és hangulatvilágítás.

- **Szerelés:** a padlón, dugaszolós
- **Fényforrás:** E27 foglalat vagy integrált LED
- **Védettség:** IP20 · II. érintésvédelmi osztály (gyakran)
- **Fény:** 500–4000 lm (uplighter a felső) · 2700–3000 K, gyakran hangolható · Ra ≥ 80, olvasáshoz ≥ 90 · uplighternél főleg fel, olvasónál keskeny le
- **Vezérlés:** zsinórkapcsoló, talpkapcsoló, érintőkapcsoló, kapcsolt aljzat, okos aljzat vagy okos fényforrás (vonalak: 2,4 GHz sáv, Hálózati 50 Hz)
- **Beépítés:**
  - Nincs bekötés: a villanyszerelő feladata a jól elhelyezett aljzat, ideálisan kapcsolt aljzat a bejárati kapcsolóról.
- **Előírás:** MSZ EN 60598-2-4 (hordozható, általános célú lámpatestek) (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `inst.socket-switched` (Rajztár)
- **Hova:** nappali, olvasósarok, hálószoba
- **Buktatók:**
  - A padlón futó zsinór botlásveszély: az aljzat helye a bútortervhez igazodjon.
- **Rokon típusok:** Kapcsolt aljzat (a dugaszolós lámpák köre), Asztali és íróasztali lámpa, Olvasó falikar
- **Keresőszavak:** HU: állólámpa LED olvasókarral · uplighter állólámpa — EN: floor lamp with reading light · uplighter floor lamp — DE: Stehleuchte mit Leselicht · Deckenfluter
- **Hol kapható:** Lámpaszaküzlet, lakberendezési áruház.

### Asztali és íróasztali lámpa

*Más néven:* íróasztali lámpa, munkalámpa, asztali hangulatlámpa

![Asztali és íróasztali lámpa](svg/asztali-lampa.svg)

Dugaszolós asztali lámpa: hangulatlámpa ernyővel, vagy állítható karú munkalámpa, amely a munkafelületre irányítja a fényt.

- **Szerelés:** az asztalon, dugaszolós, sokszor csiptetős vagy karos
- **Fényforrás:** E14 / E27 foglalat vagy integrált LED
- **Védettség:** IP20 · II. vagy III. érintésvédelmi osztály
- **Fény:** 250–1000 lm · 2700–4000 K, munkalámpánál hangolható · Ra ≥ 90 munkához · munkalámpánál irányított, hangulatlámpánál szórt
- **Vezérlés:** lámpán lévő kapcsoló vagy érintő dimmer; USB-töltős kivitel (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Az íróasztal mellé elegendő aljzat (lámpa, számítógép, töltők), lehetőleg asztalmagasságban vagy padlódobozban.
- **Előírás:** MSZ EN 60598-2-4 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `inst.socket-pe` (Rajztár)
- **Hova:** dolgozószoba, gyerekszoba, hálószoba
- **Buktatók:**
  - A villódzó olcsó LED és a vakító, árnyékolatlan fényforrás hosszú munkánál fárasztó.
- **Rokon típusok:** Állólámpa, Éjjeli lámpa
- **Keresőszavak:** HU: íróasztali lámpa LED dimmelhető · asztali lámpa — EN: LED desk lamp dimmable · table lamp — DE: LED Schreibtischleuchte dimmbar · Tischleuchte
- **Hol kapható:** Lámpaszaküzlet, műszaki áruház.

### Éjjeli lámpa

*Más néven:* éjjeliszekrény lámpa, gyerek éjjeli fény, hangulatlámpa

![Éjjeli lámpa](svg/ejjeli-lampa.svg)

Kis, meleg fényű lámpa az ágy mellé: olvasáshoz, elalváshoz, éjszakai tájékozódáshoz; sokszor akkus vagy érintéssel dimmelhető.

- **Szerelés:** éjjeliszekrényen, dugaszolós vagy akkus
- **Fényforrás:** E14 foglalat vagy integrált LED, akkumulátor
- **Védettség:** IP20 · II. vagy III. érintésvédelmi osztály
- **Fény:** 20–400 lm · 2200–2700 K · Ra ≥ 80 · szórt
- **Vezérlés:** érintőkapcsoló, dimmer, időzítő (vonalak: 2,4 GHz sáv)
- **Beépítés:**
  - Az ágy két oldalán aljzat (és USB-töltő), a fejtámla magasságához igazítva.
- **Előírás:** MSZ EN 60598-2-4 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `inst.socket-usb` (Rajztár)
- **Hova:** hálószoba, gyerekszoba
- **Buktatók:**
  - Hideg, kék fény este rontja az elalvást.
- **Rokon típusok:** Asztali és íróasztali lámpa, Olvasó falikar, Áramszünet-jelző éjszakai fény
- **Keresőszavak:** HU: éjjeli lámpa érintős dimmelhető — EN: bedside lamp touch dimmable — DE: Nachttischlampe Touch dimmbar
- **Hol kapható:** Lámpaszaküzlet, lakberendezési áruház.

### Kapcsolt aljzat (a dugaszolós lámpák köre)

*Más néven:* kapcsolt dugaszolóaljzat, lámpaaljzat, switched socket

![Kapcsolt aljzat (a dugaszolós lámpák köre)](svg/kapcsolt-aljzat.svg)

Nem lámpatest, hanem a dugaszolós lámpák „bekötése”: olyan aljzat, amelyet a helyiség bejáratánál lévő kapcsoló kapcsol, így az állólámpák és asztali lámpák a falikapcsolóról gyújthatók, mint a mennyezeti lámpa.

- **Szerelés:** falba süllyesztett aljzat, falikapcsolóról kapcsolva
- **Fényforrás:** bármely dugaszolós lámpa
- **Védettség:** IP20 (nedves helyen IP44) · —
- **Fény:** a csatlakoztatott lámpáé · — · — · —
- **Vezérlés:** falikapcsoló, vagy okos aljzat / okos relé a dobozban (vonalak: Hálózati 50 Hz, 2,4 GHz sáv, KNX TP)
- **Beépítés:**
  - A kapcsolt aljzatot jól láthatóan jelölni kell (pl. eltérő szín vagy jelölés), hogy ne dugjanak bele folyamatos tápot igénylő eszközt.
  - Egy kapcsolt aljzat mellé egy nem kapcsolt is kerüljön.
  - A kapcsoló doboza és az aljzat közé háromerű kábel kell (kapcsolt fázis).
- **Rögzítés:** Dobozfúró korona, Gipszkarton körkivágó
- **Előírás:** MSZ HD 60364 sorozat (a fogyasztói áramkör), a szerelvényre MSZ EN 60669 / MSZ HD 60884 (kártyák: MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, MSZ EN 60669 és MSZ HD 60884 · Kapcsolók és dugaszolóaljzatok)
- **Rajzjel:** `inst.socket-switched` (Rajztár)
- **Hova:** nappali, hálószoba, dolgozószoba
- **Buktatók:**
  - Jelölés nélkül a kapcsolt aljzatba dugott hűtő vagy router kikapcsol.
- **Rokon típusok:** Állólámpa, Asztali és íróasztali lámpa
- **Keresőszavak:** HU: kapcsolt dugaszolóaljzat · okos relé dobozba — EN: switched socket outlet · in-wall smart relay — DE: geschaltete Steckdose · Unterputz Aktor
- **Hol kapható:** Villamossági nagykereskedés.
- **A Készletben:**
  - `VRG-0167` Wi-Fi okos dugalj (2P+F), 1x16A, fehér Stilo · 4 358 Ft — *kiváltja*: okos dugaljjal egy dugaszolós lámpa utólag kapcsolható, kapcsolt aljzat nélkül

## 6. Nedves helyiség

### Fürdőszobai mennyezeti lámpa

*Más néven:* IP44 mennyezeti lámpa, fürdőszobalámpa

![Fürdőszobai mennyezeti lámpa](svg/furdo-mennyezeti.svg)

A fürdő általános világítása párától és fröccsenő víztől védett (legalább IP44) lámpatesttel. A szabvány a fürdőt zónákra osztja; a zóna határozza meg, mi és milyen védettséggel szerelhető oda.

- **Szerelés:** mennyezetre, felületre szerelve
- **Fényforrás:** integrált LED vagy E27 zárt búrában
- **Védettség:** legalább IP44 (zónától függően több) · I. vagy II. érintésvédelmi osztály
- **Fény:** 1000–2500 lm · 3000–4000 K · Ra ≥ 90 (bőrszín, sminkelés) · széles, diffúz
- **Vezérlés:** kapcsolt; a kapcsoló a fürdőn kívül vagy a zónákon kívül; páraelszívóval együtt is (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A zónák (0, 1, 2) a kád és a zuhany körül; zóna 1-be és 2-be legalább IPX4, vízsugárnak kitett helyen IPX5. A pontos feltételeket a szabvány adja.
  - A fürdő áramköreit áram-védőkapcsoló védje.
  - Pára: a lámpatest tömítése és a kábelbevezetés tömszelencéje.
- **Rögzítés:** Beton, Gipszkarton, Csempe, járólap, Nylon terpesztődübel
- **Előírás:** MSZ HD 60364-7-701 (fürdő- és zuhanyhelyiségek), MSZ EN 60598-2-1 (kártyák: MSZ HD 60364-7-701 · Fürdő- és zuhanyhelyiségek, MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** fürdőszoba, zuhanyzó, mosdó
- **Buktatók:**
  - A zónán belüli nem megfelelő IP-jű lámpatest balesetveszélyes és szabálytalan.
  - Hideg, gyenge színvisszaadású fény a tükörben rossz arcképet ad.
- **Rokon típusok:** Fürdőszobai beépíthető spot, Tükörvilágítás, LED-korong lámpa („ufó”)
- **Keresőszavak:** HU: fürdőszobai mennyezeti lámpa IP44 — EN: bathroom ceiling light IP44 — DE: Badezimmer Deckenleuchte IP44
- **Hol kapható:** Villamossági nagykereskedés, lámpaszaküzlet.

### Fürdőszobai beépíthető spot

*Más néven:* zuhanyspot, IP65 downlight, vízálló spot

![Fürdőszobai beépíthető spot](svg/furdo-spot.svg)

Alulról vízálló (IP44 – IP65) beépíthető spot vagy downlight a fürdő álmennyezetébe, akár a zuhany fölé; a zónától függően törpefeszültségű kivitelben.

- **Szerelés:** álmennyezetbe süllyesztve
- **Fényforrás:** integrált LED vagy zárt GU10 / GU5.3 keret
- **Védettség:** IP44 – IP65 alulról · II. vagy III. érintésvédelmi osztály
- **Fény:** 300–900 lm · 3000–4000 K · Ra ≥ 90 · 36–90°
- **Vezérlés:** kapcsolt; dimmelhető kivitelben is (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Zóna 1-ben (a zuhany vagy a kád fölött) a szabvány szerinti védettség és táplálás; a tápegység a zónákon kívül.
  - A tömítés a kerettel és az üveggel együtt alulról számít: a keret mögött pára gyűlhet, ezért szellőzés és tömszelence.
- **Rögzítés:** Gipszkarton, Gipszkarton körkivágó
- **Előírás:** MSZ HD 60364-7-701, MSZ EN 60598-2-2 (kártyák: MSZ HD 60364-7-701 · Fürdő- és zuhanyhelyiségek, MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.spot` (Rajztár)
- **Hova:** fürdő, zuhanyzó, szauna előtere
- **Buktatók:**
  - Az IP44 elég a zóna 2-ben, de a zuhanysugár alá IPX5 vagy jobb kell.
- **Rokon típusok:** Süllyesztett downlight, Beépíthető spot, Fürdőszobai mennyezeti lámpa
- **Keresőszavak:** HU: IP65 beépíthető spot zuhany fölé — EN: IP65 shower downlight — DE: IP65 Einbaustrahler Dusche
- **Hol kapható:** Villamossági nagykereskedés, világítástechnikai szaküzlet.

### Tükörvilágítás

*Más néven:* tükörlámpa, tükör fölötti lámpa, világító tükör

![Tükörvilágítás](svg/tukorvilagitas.svg)

A tükör előtt álló arcát világítja meg; a legjobb, ha két oldalról vagy a tükör körül szórt fény jön, mert a csak felülről érkező fény árnyékot vet az arcra.

- **Szerelés:** tükör fölé vagy mellé, falra; vagy a tükörbe építve
- **Fényforrás:** integrált LED
- **Védettség:** legalább IP44 · II. érintésvédelmi osztály (gyakran)
- **Fény:** 500–1500 lm · 3000–4000 K, sokszor hangolható · Ra ≥ 90 · széles, az arc felé
- **Vezérlés:** kapcsolt; érintőkapcsoló a tükrön, páramentesítő fűtéssel együtt (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A kiállás helye a tükör vagy a tükrös szekrény méretéhez; világító tükörnél a tükör mögött.
  - A mosdó a zónákon kívül esik, de a fröccsenő víz miatt IP44 ajánlott.
- **Rögzítés:** Csempe, járólap, Tömör tégla, Üreges kerámia falazóblokk, Gipszkarton, Nylon terpesztődübel
- **Előírás:** MSZ HD 60364-7-701, MSZ EN 60598-2-1 (kártyák: MSZ HD 60364-7-701 · Fürdő- és zuhanyhelyiségek, MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.wall` (Rajztár)
- **Hova:** fürdő, mosdó, öltözőasztal
- **Buktatók:**
  - Csak felülről érkező fény az arcon árnyékot vet.
  - A tükrös szekrény és a világító tükör méretéhez a kiállást a megrendelés előtt kell rögzíteni.
- **Rokon típusok:** Fürdőszobai mennyezeti lámpa, Falikar
- **Keresőszavak:** HU: tükörlámpa LED IP44 · világító tükör érintőkapcsolós — EN: LED mirror light IP44 · illuminated mirror — DE: Spiegelleuchte LED IP44 · Lichtspiegel
- **Hol kapható:** Fürdőszoba-szaküzlet, lámpaszaküzlet.

### Páramentes lámpatest

*Más néven:* IP65 armatúra, páramentes LED-armatúra, vízmentes lámpa

![Páramentes lámpatest](svg/paramentes.svg)

Hosszúkás, tömített (IP65) lámpatest műanyag házzal és búrával; garázs, pince, műhely, mosókonyha, istálló világítására. LED-cső vagy integrált LED világít benne.

- **Szerelés:** mennyezetre vagy falra, felületre szerelve, csatokkal zárt burkolattal
- **Fényforrás:** integrált LED vagy T8 LED-cső
- **Védettség:** IP65 · IK08 vagy jobb · I. vagy II. érintésvédelmi osztály
- **Fény:** 2000–6000 lm (hossztól függően) · 4000–6500 K · Ra ≥ 80 · széles
- **Vezérlés:** kapcsolt; mozgásérzékelős vagy vészvilágítási kivitelben is (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A kábelt tömszelencén át kell bevezetni, és a tömítést visszazárni.
  - Sorolható kivitelnél a lámpák egymásról kapnak tápot: a betáplálás és az átkötés a lámpában.
- **Rögzítés:** Beton, Tömör tégla, Nylon terpesztődübel, Beütős dübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.linear` (Rajztár)
- **Hova:** garázs, pince, műhely, mosókonyha, kazánház
- **Buktatók:**
  - A nyitva hagyott vagy rosszul visszazárt tömszelence után a lámpa nem IP65.
  - Fénycsöves régi armatúra LED-csőre cserélésénél a gyújtó és az előtét kezelése a LED-cső típusától függ.
- **Rokon típusok:** Hajólámpa, LED-panel
- **Keresőszavak:** HU: páramentes lámpatest LED IP65 120 cm — EN: LED vapour-tight batten IP65 — DE: LED Feuchtraumleuchte IP65
- **Hol kapható:** Villamossági nagykereskedés, barkácsáruház.

### Hajólámpa

*Más néven:* bulkhead lámpa, ovális hajólámpa, rácsos hajólámpa

![Hajólámpa](svg/hajolampa.svg)

Kis, tömített, ütésálló lámpatest búrával, sokszor védőráccsal; pincében, kamrában, kazánházban, kültéren a bejárat mellett.

- **Szerelés:** falra vagy mennyezetre, felületre szerelve
- **Fényforrás:** E27 foglalat vagy integrált LED
- **Védettség:** IP54 – IP65 · IK08 – IK10 (rácsos kivitel) · I. vagy II. érintésvédelmi osztály
- **Fény:** 500–1500 lm · 3000–4000 K · Ra ≥ 80 · minden irányba
- **Vezérlés:** kapcsolt; mozgásérzékelős kivitelben is (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Kültéren a kábelbevezetés alulról, tömszelencével, hogy a víz ne folyjon be.
- **Rögzítés:** Tömör tégla, Beton, Hőszigetelt homlokzat, Nylon terpesztődübel, Rögzítő hőszigetelt homlokzathoz
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.outdoor` (Rajztár)
- **Hova:** pince, kamra, kazánház, garázs, bejárat
- **Buktatók:**
  - Hőszigetelt homlokzatra a szigetelésen át, távtartó rögzítővel.
- **Rokon típusok:** Páramentes lámpatest, Fali-mennyezeti búra, LED-korong lámpa („ufó”)
- **Keresőszavak:** HU: hajólámpa IP65 · rácsos hajólámpa E27 — EN: bulkhead light IP65 — DE: Ovalleuchte IP65 · Kellerleuchte
- **Hol kapható:** Barkácsáruház, villamossági nagykereskedés.

### Szaunavilágítás

*Más néven:* szaunalámpa, hőálló lámpatest, szauna LED

![Szaunavilágítás](svg/szauna.svg)

A szauna hőmérsékletére minősített, magas hőállóságú, nedvességálló lámpatest; a fényt jellemzően fa ráccsal tompítják. Gyakran törpefeszültségű LED, a tápegység a kabinon kívül.

- **Szerelés:** a szauna falára vagy mennyezetére, sokszor fa takarás mögé
- **Fényforrás:** hőálló foglalat vagy szaunába minősített LED / száloptika
- **Védettség:** IP44 vagy több · a gyártó szerint, szaunára minősítve
- **Fény:** 100–600 lm · 2200–3000 K · Ra ≥ 80 · tompított, szórt
- **Vezérlés:** kapcsolt, a kabinon kívülről (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A szauna-helyiség szabályai: hőmérsékleti zónák, a kályha körüli tilos terület, a vezetékek hőállósága.
  - A tápegység és a kapcsoló a kabinon kívül.
- **Rögzítés:** Fa
- **Előírás:** MSZ HD 60364-7-703 (szaunák), MSZ EN 60598-2-1 (kártyák: MSZ HD 60364-7-703 · Szaunák, MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** szauna, gőzkabin (külön minősítéssel)
- **Buktatók:**
  - Nem szaunára minősített LED a hőtől hamar tönkremegy.
  - A kályha fölé szerelt lámpa túlmelegszik.
- **Rokon típusok:** Fürdőszobai mennyezeti lámpa
- **Keresőszavak:** HU: szauna lámpa hőálló · szauna LED világítás — EN: sauna light heat resistant · sauna LED lighting — DE: Saunaleuchte · Sauna LED Beleuchtung
- **Hol kapható:** Szaunaszaküzlet, wellness-forgalmazó.

## 7. Kültéri

### Kültéri falikar

*Más néven:* homlokzati lámpa, bejárati lámpa, kültéri fali lámpa

![Kültéri falikar](svg/kulteri-falikar.svg)

Az időjárásnak ellenálló, legalább IP44-es fali lámpatest a bejárat, a terasz és a homlokzat világítására; sokszor mozgásérzékelővel vagy alkonykapcsolóval.

- **Szerelés:** homlokzatra, a bejárat, terasz, garázs mellé
- **Fényforrás:** E27 foglalat vagy integrált LED
- **Védettség:** IP44 – IP65 · I. vagy II. érintésvédelmi osztály
- **Fény:** 300–1200 lm · 2700–3000 K · Ra ≥ 80 · kivitel szerint lefelé, fel-le vagy minden irányba
- **Vezérlés:** kapcsolt, mozgásérzékelő, alkonykapcsoló, okos vezérlés (vonalak: Hálózati 50 Hz, 2,4 GHz sáv)
- **Beépítés:**
  - Hőszigetelt homlokzaton távtartó rögzítő vagy a szigeteléskor beépített szerelőelem kell.
  - A kábel bevezetése alulról, tömszelencével; a falon átvezetett kábel mögött tömítés.
  - A kültéri áramkört áram-védőkapcsoló védje.
- **Rögzítés:** Hőszigetelt homlokzat, Rögzítő hőszigetelt homlokzathoz, Tömör tégla, Üreges kerámia falazóblokk, Nylon terpesztődübel
- **Előírás:** MSZ HD 60364-7-714 (kültéri világítás), MSZ EN 60598-2-1 (kártyák: MSZ HD 60364-7-714 · Kültéri világítási berendezések, MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.outdoor` (Rajztár)
- **Hova:** bejárat, terasz, garázskapu, homlokzat
- **Buktatók:**
  - A szomszéd ablakába vagy az utcára vakító lámpa zavar; lefelé irányított, árnyékolt fény jobb.
  - Fekete fémház napon nagyon felmelegszik.
- **Rokon típusok:** Mozgásérzékelős reflektor, Előtető- és teraszmennyezeti lámpa, Hajólámpa
- **Keresőszavak:** HU: kültéri falilámpa IP54 mozgásérzékelős · homlokzati lámpa — EN: outdoor wall light IP54 with sensor — DE: Außenwandleuchte IP54 mit Bewegungsmelder
- **Hol kapható:** Villamossági nagykereskedés, barkácsáruház, lámpaszaküzlet.

### Mozgásérzékelős reflektor

*Más néven:* LED fényvető, kültéri reflektor, projektor lámpa

![Mozgásérzékelős reflektor](svg/reflektor.svg)

Nagy fényerejű LED-fényvető széles nyalábbal, udvarok, kocsibeállók, kertek megvilágítására; gyakran beépített vagy külön mozgásérzékelővel.

- **Szerelés:** homlokzatra, eresz alá, oszlopra
- **Fényforrás:** integrált LED
- **Védettség:** IP65 · I. vagy II. érintésvédelmi osztály
- **Fény:** 1000–10 000 lm · 3000–5000 K · Ra ≥ 70 – 80 · 90–120°
- **Vezérlés:** mozgásérzékelő (PIR), alkonykapcsoló, időzítés, kamera-rendszerhez kötve (vonalak: Hálózati 50 Hz, 2,4 GHz sáv)
- **Beépítés:**
  - Az érzékelőt az elhaladás irányára keresztben érdemes tájolni, mert úgy érzékel legjobban.
  - A fényvetőt lefelé kell dönteni: vízszintesen vakít és a szomszédba világít.
  - Hőszigetelt homlokzaton távtartó rögzítő.
- **Rögzítés:** Rögzítő hőszigetelt homlokzathoz, Tömör tégla, Beton, Nylon terpesztődübel
- **Előírás:** MSZ HD 60364-7-714 (kártyák: MSZ HD 60364-7-714 · Kültéri világítási berendezések)
- **Rajzjel:** `lum.flood` (Rajztár)
- **Hova:** udvar, kocsibeálló, kert, raktár
- **Buktatók:**
  - A fák, az autók és a meleg levegő mozgása téves kapcsolást okozhat.
  - A túl erős fényvető fényszennyezés.
- **Rokon típusok:** Kültéri falikar, Homlokzat-megvilágító
- **Keresőszavak:** HU: LED reflektor mozgásérzékelős 30W — EN: LED floodlight with PIR sensor — DE: LED Strahler mit Bewegungsmelder
- **Hol kapható:** Villamossági nagykereskedés, barkácsáruház.
- **A Készletben:**
  - `VRG-0011` LED reflektor 20W 1600lm, 120 fokos mozgásérzékelővel, 4000K, 30x SMD2835 LED, lapos, fekete deLux · 7 088 Ft — *termék*: LED-reflektor beépített mozgásérzékelővel
  - `VRG-0012` LED reflektor 30W mozgásérzékelős, sorkapoccsal, tömszelencével 4000K 2400lm IP65 120 fok SMD, lapos, fekete delux · 9 600 Ft — *termék*: LED-reflektor mozgásérzékelővel, IP65, tömszelencével
  - `VRG-0010` Ha. ceruza 120W 118mm. R7s deLux · 501 Ft — *fényforrás*: R7s halogén ceruzaizzó a régi halogénreflektorokhoz; LED-re váltásnál az egész reflektort érdemes cserélni

### Kerti oszloplámpa (bollard)

*Más néven:* állólámpa kertbe, kerti oszlop, útszéli lámpa

![Kerti oszloplámpa (bollard)](svg/bollard.svg)

Alacsony, oszlop formájú kültéri lámpa, amely a járdát, az utat és a kert szegélyét világítja meg alacsony fénypontból, kevés vakítással.

- **Szerelés:** talajba betonozott alapra vagy rögzítőtüskére, 30–100 cm magasan
- **Fényforrás:** E27 foglalat vagy integrált LED
- **Védettség:** IP44 – IP65 · IK08 – IK10 · I. vagy II. érintésvédelmi osztály
- **Fény:** 200–1000 lm · 2700–3000 K · Ra ≥ 80 · kivitel szerint oldalra és lefelé, vagy minden irányba
- **Vezérlés:** alkonykapcsoló, időzítés, okos vezérlés (vonalak: Hálózati 50 Hz, 2,4 GHz sáv)
- **Beépítés:**
  - Földkábelt (pl. NYY-J) védőcsőben vagy homokágyban, jelzőszalaggal; a fektetési mélységet az előírás adja.
  - A talp betonalapba vagy gyári rögzítőtüskére; a kábelvég a talpban hozzáférhetően.
  - Kerti áramkör áram-védőkapcsolóval.
- **Rögzítés:** Beton, Csavaros terpesztő horgony, Betoncsavar
- **Előírás:** MSZ HD 60364-7-714 (kártyák: MSZ HD 60364-7-714 · Kültéri világítási berendezések)
- **Rajzjel:** `lum.outdoor` (Rajztár)
- **Hova:** kerti út, kocsibeálló széle, bejárati járda
- **Buktatók:**
  - A fűnyíró és a hó eltolás megüti: ütésálló kivitel és jól látható hely.
- **Rokon típusok:** Leszúrható kerti spot, Napelemes kerti lámpa, Kapuoszlop- és pillérlámpa
- **Keresőszavak:** HU: kerti oszloplámpa LED · földkábel NYY-J — EN: garden bollard light · underground cable — DE: Pollerleuchte · Erdkabel NYY-J
- **Hol kapható:** Villamossági nagykereskedés, kerti világítás szaküzlet.

### Leszúrható kerti spot

*Más néven:* kerti spot, tüskés spot, fa megvilágító

![Leszúrható kerti spot](svg/kerti-spot.svg)

Tüskére szerelt, irányítható kis fényvető fák, bokrok, szobrok, homlokzati elemek megvilágítására; sokszor törpefeszültségű (12 / 24 V) rendszer, amelyet a kertben szabadon át lehet rendezni.

- **Szerelés:** a földbe szúrt tüskére, irányítható fejjel
- **Fényforrás:** GU10, MR16 vagy integrált LED
- **Védettség:** IP65 – IP67 · III. (törpefeszültségű) vagy I. érintésvédelmi osztály
- **Fény:** 100–600 lm · 2700–3000 K · Ra ≥ 80 · 15–60°
- **Vezérlés:** alkonykapcsoló, időzítés, okos vezérlés (vonalak: Hálózati 50 Hz, 2,4 GHz sáv)
- **Beépítés:**
  - Törpefeszültségű rendszernél a transzformátor beltérben vagy védett helyen; a kábel feszültségesése hosszú vonalon számít.
  - 230 V-os spotnál földkábel és földbe szánt kötődoboz kell.
- **Rögzítés:** Beton
- **Előírás:** MSZ HD 60364-7-714 (kártyák: MSZ HD 60364-7-714 · Kültéri világítási berendezések)
- **Rajzjel:** `lum.outdoor` (Rajztár)
- **Hova:** kert, fák, sövény, homlokzati elemek
- **Buktatók:**
  - A felfelé irányított fény a szomszédot és az eget is világítja: pontos irányítás és árnyékoló.
- **Rokon típusok:** Földbe süllyesztett lámpa (uplight), Kerti oszloplámpa (bollard)
- **Keresőszavak:** HU: leszúrható kerti spot 12V · kerti világítás szett — EN: garden spike light 12V — DE: Erdspießstrahler 12V · Gartenbeleuchtung Set
- **Hol kapható:** Kerti világítás szaküzlet, barkácsáruház.

### Földbe süllyesztett lámpa (uplight)

*Más néven:* inground lámpa, talajba süllyesztett spot, járható lámpa

![Földbe süllyesztett lámpa (uplight)](svg/foldbe-sullyesztett.svg)

A talajba süllyesztett, felfelé világító lámpatest fák, oszlopok, homlokzatok megvilágítására vagy irányfényként; járható, egyes típusok autóval is terhelhetők.

- **Szerelés:** a talajba, burkolatba vagy teraszba süllyesztve, a fedőlap a felülettel egy síkban
- **Fényforrás:** integrált LED
- **Védettség:** IP67 – IP68 · IK08 – IK10 · III. vagy I. érintésvédelmi osztály
- **Fény:** 100–1500 lm · 2700–3000 K · Ra ≥ 80 · 15–60° felfelé, vagy szórt irányfény
- **Vezérlés:** alkonykapcsoló, időzítés, okos vezérlés (vonalak: Hálózati 50 Hz, 2,4 GHz sáv)
- **Beépítés:**
  - Az aljzat alá vízelvezető kavicsréteg, hogy a lámpa ne álljon vízben.
  - A tömszelencés kábelbevezetés gyári; a kötés földbe szánt kötőkészlettel.
  - A fedőlap felülete forró lehet: ahol mezítláb járnak, arra minősített kivitel.
- **Rögzítés:** Beton
- **Előírás:** MSZ HD 60364-7-714, MSZ EN 60598-2-13 (talajba süllyesztett lámpatestek) (kártyák: MSZ HD 60364-7-714 · Kültéri világítási berendezések, MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.outdoor` (Rajztár)
- **Hova:** terasz, kerti út, fák tövében, homlokzat előtt
- **Buktatók:**
  - Lefolyás nélküli helyen a lámpa megtelik vízzel.
  - A felfelé világító fény könnyen vakít, ha a lámpa mellett járnak.
- **Rokon típusok:** Leszúrható kerti spot, Homlokzat-megvilágító
- **Keresőszavak:** HU: földbe süllyeszthető LED lámpa járható · inground spot IP67 — EN: inground uplight IP67 · walk-over light — DE: Bodeneinbaustrahler IP67 · befahrbar
- **Hol kapható:** Kerti világítás szaküzlet, világítástechnikai szaküzlet.

### Homlokzat-megvilágító

*Más néven:* homlokzati fényvető, kültéri wall washer, díszvilágítás

![Homlokzat-megvilágító](svg/homlokzat-fenyveto.svg)

A homlokzatot vagy egy épületrészt egyenletesen, vagy súrolófénnyel megvilágító kültéri lámpatest; az épület formáját rajzolja ki éjszaka.

- **Szerelés:** a homlokzat előtt a talajra, a homlokzat aljára vagy tetejére
- **Fényforrás:** integrált LED
- **Védettség:** IP65 – IP67 · I., II. vagy III. érintésvédelmi osztály
- **Fény:** 500–5000 lm · 2700–4000 K · Ra ≥ 80 · aszimmetrikus, a fal felé
- **Vezérlés:** alkonykapcsoló, időzítés, DALI vagy okos vezérlés (vonalak: DALI, 2,4 GHz sáv)
- **Beépítés:**
  - A faltól mért távolság és a dőlésszög adja az egyenletességet: a gyártói ajánlás szerint.
  - A felfelé világító fényt árnyékolóval kell az égbolttól elzárni.
- **Rögzítés:** Rögzítő hőszigetelt homlokzathoz, Beton, Tömör tégla, Nylon terpesztődübel
- **Előírás:** MSZ HD 60364-7-714 (kártyák: MSZ HD 60364-7-714 · Kültéri világítási berendezések)
- **Rajzjel:** `lum.flood` (Rajztár)
- **Hova:** homlokzat, kerítés, kapu, támfal
- **Buktatók:**
  - Fényszennyezés: a fény ne lépje túl a megvilágítandó felületet.
- **Rokon típusok:** Fali fényvető (wall washer), Mozgásérzékelős reflektor, Földbe süllyesztett lámpa (uplight)
- **Keresőszavak:** HU: homlokzat megvilágító LED · kültéri wall washer — EN: facade lighting LED · outdoor wall washer — DE: Fassadenbeleuchtung LED · Außen Wandfluter
- **Hol kapható:** Világítástechnikai szaküzlet.

### Medencevilágítás

*Más néven:* medence lámpa, víz alatti lámpa, pool light

![Medencevilágítás](svg/medence.svg)

A víz alatt dolgozó, teljesen vízmentes lámpatest a medence falában; törpefeszültségű, és a táplálását a medence zónáin kívül elhelyezett biztonsági transzformátor adja.

- **Szerelés:** a medence falába beépítve vagy a falra szerelve, víz alatt
- **Fényforrás:** integrált LED
- **Védettség:** IP68 · III. érintésvédelmi osztály (SELV)
- **Fény:** 500–3000 lm · fehér vagy RGB · Ra ≥ 70 · széles
- **Vezérlés:** kapcsolt, RGB-vezérlő, a medencegépészet vezérlője (vonalak: 2,4 GHz sáv, 433 MHz sáv)
- **Beépítés:**
  - A medence zónáira (0, 1, 2) vonatkozó szabályok határozzák meg a feszültséget, a védettséget és a transzformátor helyét.
  - A lámpa fészke és a kábelcső a medence építésekor kerül a falba: a medenceépítővel együtt kell tervezni.
  - Egyenpotenciálú összekötés a medence fémrészeivel.
- **Rögzítés:** Beton
- **Előírás:** MSZ HD 60364-7-702 (úszómedencék) (kártyák: MSZ HD 60364-7-702 · Úszómedencék és szökőkutak)
- **Rajzjel:** `lum.outdoor` (Rajztár)
- **Hova:** kerti medence, beltéri medence, jakuzzi
- **Buktatók:**
  - A lámpacseréhez a lámpát a vízből ki kell tudni emelni: a kábelhossz tartalékot a fészekben kell hagyni.
- **Rokon típusok:** LED neon flex, Földbe süllyesztett lámpa (uplight)
- **Keresőszavak:** HU: medence lámpa 12V LED · medence transzformátor — EN: 12V LED pool light · pool light transformer — DE: Poolscheinwerfer 12V LED · Pool Trafo
- **Hol kapható:** Medencetechnikai szaküzlet.

### Napelemes kerti lámpa

*Más néven:* szolár lámpa, napelemes leszúrható lámpa

![Napelemes kerti lámpa](svg/napelemes.svg)

Saját napelemmel és akkumulátorral működő kis kerti lámpa; nem kell vezeték, alkonykor magától kapcsol. Irányfénynek és díszítésnek jó, általános világításnak kevés.

- **Szerelés:** leszúrva vagy felcsavarozva, vezeték nélkül
- **Fényforrás:** integrált LED, akkumulátor, napelem
- **Védettség:** IP44 – IP65 · III. (saját akkumulátor)
- **Fény:** 5–300 lm · 2700–6000 K · jellemzően nem megadott · kivitel szerint
- **Vezérlés:** beépített alkony- és mozgásérzékelő
- **Beépítés:**
  - Napos helyre, ahol a napelemet nem árnyékolja növény vagy épület; télen kevesebbet világít.
- **Rögzítés:** Beton, Nylon terpesztődübel
- **Előírás:** MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.outdoor` (Rajztár)
- **Hova:** kert, ágyásszegély, kerti út
- **Buktatók:**
  - Az akkumulátor néhány év után cserére szorul; az olcsó típusok télen alig világítanak.
- **Rokon típusok:** Kerti oszloplámpa (bollard), Leszúrható kerti spot
- **Keresőszavak:** HU: napelemes kerti lámpa — EN: solar garden light — DE: Solar Gartenleuchte
- **Hol kapható:** Barkácsáruház, kertészeti áruház.

### Kapuoszlop- és pillérlámpa

*Más néven:* oszlopfej lámpa, pillérlámpa, kerítéslámpa

![Kapuoszlop- és pillérlámpa](svg/kapuoszlop.svg)

A kapuoszlop vagy a pillér tetejére szerelt lámpatest; a bejáratot jelöli és a házszámot, a kaput világítja meg.

- **Szerelés:** a kapuoszlop vagy a kerítéspillér tetejére
- **Fényforrás:** E27 foglalat vagy integrált LED
- **Védettség:** IP44 – IP65 · I. vagy II. érintésvédelmi osztály
- **Fény:** 300–1000 lm · 2700–3000 K · Ra ≥ 80 · minden irányba
- **Vezérlés:** alkonykapcsoló, időzítés, a kaputelefonnal vagy a kapunyitóval összekötve (vonalak: Hálózati 50 Hz, 433 MHz sáv)
- **Beépítés:**
  - A kábelt a pillér építésekor védőcsőben kell felvezetni.
  - A pillér fedlapjába rögzítve; a kábelvég tömszelencén át.
- **Rögzítés:** Beton, Zsalukő, Betoncsavar, Nylon terpesztődübel
- **Előírás:** MSZ HD 60364-7-714 (kártyák: MSZ HD 60364-7-714 · Kültéri világítási berendezések)
- **Rajzjel:** `lum.outdoor` (Rajztár)
- **Hova:** kapu, kerítés, kocsibejáró
- **Buktatók:**
  - Utólag a pilléren belül nehéz kábelt vezetni.
- **Rokon típusok:** Kerti oszloplámpa (bollard), Kültéri falikar
- **Keresőszavak:** HU: oszlopfej lámpa kapura · pillér lámpa — EN: gate pillar light · post top light — DE: Pfeilerleuchte · Mastaufsatzleuchte
- **Hol kapható:** Lámpaszaküzlet, barkácsáruház.

### Kültéri fényfüzér

*Más néven:* kerti fényfüzér, party füzér, festoon lánc

![Kültéri fényfüzér](svg/fenyfuzer.svg)

Sorba kötött foglalatok vagy LED-ek egy kábelen, teraszok és kerti terek hangulatvilágítására; dugaszolós, ideiglenes és tartós kivitelben.

- **Szerelés:** kifeszítve teraszon, pergolán, fák között; acélsodronyra függesztve
- **Fényforrás:** E27 foglalatok vagy integrált LED
- **Védettség:** IP44 – IP65 · II. vagy III. érintésvédelmi osztály
- **Fény:** foglalatonként 50–300 lm · 2200–2700 K · Ra ≥ 80 · minden irányba
- **Vezérlés:** kapcsolt kültéri aljzatról, időzítővel vagy okos aljzattal (vonalak: Hálózati 50 Hz, 2,4 GHz sáv)
- **Beépítés:**
  - Tartós felszerelésnél acélsodronyra függesztve, hogy a kábel ne viselje a terhet.
  - A kültéri aljzat legalább IP44-es, fedeles, áram-védőkapcsolóval védett körön.
- **Rögzítés:** Fa, Tömör tégla, Nylon terpesztődübel, Menetes szár, metrikus csavar
- **Előírás:** MSZ EN 60598-2-20 (fényfüzérek) (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.outdoor` (Rajztár)
- **Hova:** terasz, pergola, kert, rendezvénytér
- **Buktatók:**
  - Beltéri füzért kültérre tenni: tilos.
- **Rokon típusok:** Napelemes kerti lámpa, Kültéri falikar
- **Keresőszavak:** HU: kültéri fényfüzér E27 IP65 — EN: outdoor festoon lights IP65 — DE: Außen Lichterkette E27 IP65
- **Hol kapható:** Barkácsáruház, lámpaszaküzlet.

### Előtető- és teraszmennyezeti lámpa

*Más néven:* kültéri downlight, eresz alatti lámpa, előtető lámpa

![Előtető- és teraszmennyezeti lámpa](svg/terasz-mennyezeti.svg)

Fedett kültéri mennyezetbe (előtető, terasz, loggia, eresz alja) szerelt, lefelé világító lámpatest; nedvesség és pára ellen védett kivitelben.

- **Szerelés:** az előtető, az eresz vagy a terasz mennyezetébe süllyesztve vagy felületre
- **Fényforrás:** integrált LED vagy GU10
- **Védettség:** IP44 – IP65 · I. vagy II. érintésvédelmi osztály
- **Fény:** 300–1200 lm · 2700–3000 K · Ra ≥ 80 · 60–100°
- **Vezérlés:** kapcsolt, mozgásérzékelő, okos vezérlés (vonalak: Hálózati 50 Hz, 2,4 GHz sáv)
- **Beépítés:**
  - Fa mennyezetbe (lambéria) a lámpa hőjét és a tűzvédelmet figyelembe véve.
  - A pára a mennyezet mögött is lecsapódhat: tömített kivitel.
- **Rögzítés:** Fa, OSB és forgácslap, Gipszkarton körkivágó, Beton
- **Előírás:** MSZ HD 60364-7-714, MSZ EN 60598-2-2 (kártyák: MSZ HD 60364-7-714 · Kültéri világítási berendezések, MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.spot` (Rajztár)
- **Hova:** terasz, előtető, loggia, kocsibeálló teteje
- **Buktatók:**
  - A rovarok a lámpa köré gyűlnek: melegebb színhőmérséklet kevésbé vonzza őket.
- **Rokon típusok:** Süllyesztett downlight, Kültéri falikar
- **Keresőszavak:** HU: kültéri beépíthető spot IP65 · eresz alatti LED lámpa — EN: outdoor soffit downlight IP65 — DE: Außen Einbaustrahler IP65 · Dachüberstand Leuchte
- **Hol kapható:** Villamossági nagykereskedés, lámpaszaküzlet.

## 8. Biztonsági és jelző

### Önálló akkumulátoros biztonsági lámpatest

*Más néven:* vészvilágító lámpatest, akkus vészvilágítás, self-contained emergency luminaire

![Önálló akkumulátoros biztonsági lámpatest](svg/onallo-biztonsagi.svg)

Saját akkumulátorral és töltővel működő biztonsági lámpatest: hálózatkimaradáskor magától bekapcsol, és a névleges ideig (jellemzően 1 vagy 3 óra) világít. Készenléti (csak kimaradáskor), állandó üzemű (mindig) vagy kombinált kivitelben.

- **Szerelés:** mennyezetre vagy falra, felületre szerelve vagy süllyesztve
- **Fényforrás:** integrált LED, NiCd / NiMH / LiFePO4 akkumulátor
- **Védettség:** IP20 – IP65 · II. érintésvédelmi osztály (gyakran)
- **Fény:** vészüzemben 100–400 lm · 4000–6500 K · Ra ≥ 70 · menekülési útvonal- vagy nyílt területi optikával
- **Vezérlés:** töltésjelző LED, próbagomb; öntesztes vagy DALI-címezhető kivitel (vonalak: DALI, Hálózati 50 Hz)
- **Beépítés:**
  - Állandó (nem kapcsolt) fázist kap a helyiség világítási áramköréről, hogy annak a kiesésére is bekapcsoljon; a kapcsolt fázis csak állandó üzemű kivitelnél, a gyártó szerint.
  - Az akkumulátor a bekötés után töltődik: a teljes idejű próba csak a teljes feltöltés után.
  - Helye a terv szerint: kijáratok, lépcsők, irányváltások, tűzoltó eszközök fölött.
- **Rögzítés:** Beton, Gipszkarton, Nylon terpesztődübel, Fém üreges fali dübel
- **Előírás:** MSZ EN 60598-2-22, MSZ EN 1838, MSZ EN 50172; a kötelezettség: OTSZ (kártyák: MSZ EN 60598-2-22 · Lámpatestek biztonsági világításhoz, MSZ EN 1838 · Vészvilágítás: alkalmazás, MSZ EN 50172 · Biztonsági világítási rendszerek, OTSZ és TvMI · Hol kell biztonsági világítás, MSZ EN 62034 · Automatikus tesztrendszerek)
- **Rajzjel:** `lum.emergency` (Rajztár)
- **Hova:** lépcsőház, folyosó, közösségi terek, munkahelyek, társasház közös terei
- **Buktatók:**
  - Az akkumulátor néhány év alatt elöregszik: az évenkénti teljes próba mutatja meg.
  - A kapcsolt fázisra kötött készenléti lámpatest lekapcsoláskor akkuról világít és lemerül.
- **Rokon típusok:** Központi akkumulátoros rendszer lámpateste, Menekülési útirány- és kijáratjelző, Vészvilágítási modul (konverziós készlet)
- **Keresőszavak:** HU: önálló akkus vészvilágító lámpatest 3 óra · öntesztes vészvilágítás — EN: self-contained emergency light 3h · self-test emergency luminaire — DE: Einzelbatterieleuchte 3h · Notleuchte Selbsttest
- **Hol kapható:** Villamossági nagykereskedés, biztonságtechnikai szaküzlet.

### Központi akkumulátoros rendszer lámpateste

*Más néven:* központi vészvilágítás, CB rendszer, central battery luminaire

![Központi akkumulátoros rendszer lámpateste](svg/kozponti-akkus.svg)

Saját akkumulátor nélküli biztonsági lámpatest, amelyet egy központi akkumulátoros egység táplál funkciómegtartó kábelhálózaton. Nagyobb épületekben: egy helyen karbantartható, felügyelhető.

- **Szerelés:** mennyezetre vagy falra, a központi rendszer áramköreire kötve
- **Fényforrás:** integrált LED
- **Védettség:** IP20 – IP65 · a gyártó szerint
- **Fény:** vészüzemben 100–1000 lm · 4000–6500 K · Ra ≥ 70 · menekülési útvonal- vagy nyílt területi optikával
- **Vezérlés:** a központ felügyeli és teszteli (címezhető lámpatestek) (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A kábelezés funkciómegtartó (tűzálló) rendszerrel, a terv szerinti időtartamra; a rögzítőelemek is a rendszer részei.
  - A lámpatest és a központ egy gyártói rendszer (címzés, felügyelet).
- **Rögzítés:** Beton, Beütős dübel, Csavaros terpesztő horgony
- **Előírás:** MSZ EN 50171, MSZ EN 60598-2-22, MSZ EN 1838, MSZ EN 50172 (kártyák: MSZ EN 50171 · Központi tápellátó rendszerek, MSZ EN 60598-2-22 · Lámpatestek biztonsági világításhoz, MSZ EN 1838 · Vészvilágítás: alkalmazás, MSZ EN 50172 · Biztonsági világítási rendszerek)
- **Rajzjel:** `lum.emergency-central` (Rajztár)
- **Hova:** irodaház, csarnok, iskola, nagy társasház, mélygarázs
- **Buktatók:**
  - A nem funkciómegtartó rögzítés (műanyag bilincs) tűzben leszakad: a kábelrendszer elemeit egyben kell minősíteni.
- **Rokon típusok:** Önálló akkumulátoros biztonsági lámpatest, Menekülési útirány- és kijáratjelző
- **Keresőszavak:** HU: központi akkumulátoros vészvilágítás · funkciómegtartó kábel E90 — EN: central battery emergency lighting — DE: Zentralbatterie Notbeleuchtung · Funktionserhalt E90
- **Hol kapható:** Biztonságtechnikai szakkereskedés, a rendszer gyártója.

### Menekülési útirány- és kijáratjelző

*Más néven:* kijáratjelző lámpa, EXIT lámpa, zöld futó emberes lámpa

![Menekülési útirány- és kijáratjelző](svg/utiranyjelzo.svg)

Belülről megvilágított biztonsági jel szabványos piktogrammal (zöld alapon fehér futó ember, ajtó, nyíl). A kijáratot és a menekülés irányát mutatja, hálózatkimaradáskor is világít.

- **Szerelés:** ajtó fölé, falra, mennyezetre függesztve vagy zászlósan
- **Fényforrás:** integrált LED, saját vagy központi akkumulátor
- **Védettség:** IP20 – IP65 · II. érintésvédelmi osztály (gyakran)
- **Fény:** a jel fénysűrűsége a lényeg, nem a fényáram · a zöld jelszín · — · a jel síkjára merőlegesen
- **Vezérlés:** állandó üzemű; öntesztes vagy címezhető kivitel (vonalak: DALI, Hálózati 50 Hz)
- **Beépítés:**
  - A piktogram iránya és a nyíl a menekülés valódi irányát mutassa: a terv és a helyszín együtt.
  - A jel méretét a felismerési távolság adja (belső megvilágítású jelnél kb. 200 × a piktogram magassága).
  - Állandó üzemű: nem kapcsolt fázist kap.
- **Rögzítés:** Beton, Gipszkarton, Nylon terpesztődübel, Fém üreges fali dübel
- **Előírás:** MSZ EN ISO 7010, MSZ EN 1838, MSZ EN 60598-2-22 (kártyák: MSZ EN ISO 7010 · Biztonsági jelek, MSZ EN 1838 · Vészvilágítás: alkalmazás, MSZ EN 60598-2-22 · Lámpatestek biztonsági világításhoz)
- **Rajzjel:** `lum.exit` (Rajztár)
- **Hova:** kijáratok, folyosók, lépcsőházak, közösségi terek
- **Buktatók:**
  - Régi, szöveges (KIJÁRAT) vagy nem szabványos piktogramú jel: cserélni kell.
  - A matricával cserélhető irányú jelnél a beszerelés után ellenőrizni kell a nyilat.
- **Rokon típusok:** Önálló akkumulátoros biztonsági lámpatest, Utánvilágító (fotolumineszcens) jel és csík
- **Keresőszavak:** HU: menekülési útirányjelző lámpa ISO 7010 · kijáratjelző akkus — EN: emergency exit sign light ISO 7010 — DE: Rettungszeichenleuchte ISO 7010
- **Hol kapható:** Villamossági nagykereskedés, biztonságtechnikai szaküzlet.

### Süllyesztett biztonsági spot

*Más néven:* álmennyezeti vészvilágító spot, beépíthető vészvilágítás

![Süllyesztett biztonsági spot](svg/sullyesztett-biztonsagi-spot.svg)

Kis méretű, álmennyezetbe süllyesztett biztonsági lámpatest cserélhető optikával: hosszú, keskeny eloszlás folyosóra (menekülési útvonal), kerek, széles eloszlás nagy térre (nyílt terület). Szinte láthatatlan, amíg nem kell.

- **Szerelés:** álmennyezetbe süllyesztve, kis kivágással
- **Fényforrás:** integrált LED, saját vagy központi akkumulátor
- **Védettség:** IP20 – IP65 (alulról) · II. érintésvédelmi osztály (gyakran)
- **Fény:** vészüzemben 150–600 lm · 5000–6500 K · Ra ≥ 70 · folyosóoptika (hosszú, keskeny) vagy nyílt területi optika (kerek, széles)
- **Vezérlés:** készenléti üzemű; öntesztes vagy DALI-címezhető kivitel (vonalak: DALI, Hálózati 50 Hz)
- **Beépítés:**
  - A kiosztás a fotometriai számításból jön: a lámpatestek közti legnagyobb távolságot a gyártó táblázata adja az optikához és a szerelési magassághoz.
  - Az akkumulátoros egység a kivágás mellett az álmennyezet fölé kerül: a cseréhez hozzáférés.
- **Rögzítés:** Gipszkarton, Gipszkarton körkivágó
- **Előírás:** MSZ EN 1838, MSZ EN 60598-2-22 (kártyák: MSZ EN 1838 · Vészvilágítás: alkalmazás, MSZ EN 60598-2-22 · Lámpatestek biztonsági világításhoz, MSZ EN 50172 · Biztonsági világítási rendszerek, MSZ EN 62034 · Automatikus tesztrendszerek)
- **Rajzjel:** `lum.emergency` (Rajztár)
- **Hova:** irodák, folyosók, üzletek, rendelők álmennyezete
- **Buktatók:**
  - A rossz optika (folyosóoptika nagy térben) foltos, a követelményt nem teljesítő megvilágítást ad.
- **Rokon típusok:** Önálló akkumulátoros biztonsági lámpatest, Nagy terek biztonsági lámpateste (nyílt terület)
- **Keresőszavak:** HU: beépíthető vészvilágító spot folyosó optika — EN: recessed emergency downlight corridor lens — DE: Einbau Sicherheitsleuchte Rettungswegoptik
- **Hol kapható:** Biztonságtechnikai szakkereskedés, villamossági nagykereskedés.

### Nagy terek biztonsági lámpateste (nyílt terület)

*Más néven:* pánikellenes világítás, csarnok vészvilágítás, anti-panic lighting

![Nagy terek biztonsági lámpateste (nyílt terület)](svg/nyilt-teruleti.svg)

Nagy terekhez (csarnok, sportterem, raktár, közösségi tér) méretezett biztonsági lámpatest nagyobb fényárammal és széles, egyenletes eloszlással, hogy áramszünetben ne törjön ki pánik, és mindenki elérje a menekülési útvonalat.

- **Szerelés:** nagy belmagasságú mennyezetre vagy falra
- **Fényforrás:** integrált LED, saját vagy központi akkumulátor
- **Védettség:** IP40 – IP65 · IK08 vagy jobb (sportcsarnokban labdaálló) · a gyártó szerint
- **Fény:** vészüzemben 500–3000 lm · 4000–6500 K · Ra ≥ 70 · széles, nyílt területi
- **Vezérlés:** készenléti vagy állandó üzemű; öntesztes vagy központi felügyelettel (vonalak: DALI, Hálózati 50 Hz)
- **Beépítés:**
  - Nyílt területre a padlón legalább 0,5 lx (a szélső 0,5 m nélkül): a kiosztást számítással kell igazolni.
  - Nagy magasságban a karbantartás (akkucsere) gépet kíván: központi rendszer lehet jobb.
- **Rögzítés:** Beton, Acélszerkezet, Csavaros terpesztő horgony
- **Előírás:** MSZ EN 1838, MSZ EN 60598-2-22 (kártyák: MSZ EN 1838 · Vészvilágítás: alkalmazás, MSZ EN 60598-2-22 · Lámpatestek biztonsági világításhoz, OTSZ és TvMI · Hol kell biztonsági világítás)
- **Rajzjel:** `lum.emergency` (Rajztár)
- **Hova:** csarnok, sportterem, raktár, mélygarázs, rendezvényterem
- **Buktatók:**
  - Sportcsarnokban labdaálló kivitel és védőrács kell.
- **Rokon típusok:** Süllyesztett biztonsági spot, Központi akkumulátoros rendszer lámpateste
- **Keresőszavak:** HU: csarnok vészvilágítás IP65 · nyílt területi vészvilágítás — EN: high bay emergency lighting · open area emergency lighting — DE: Hallen Sicherheitsleuchte · Antipanikbeleuchtung
- **Hol kapható:** Biztonságtechnikai szakkereskedés.

### Vészvilágítási modul (konverziós készlet)

*Más néven:* vészvilágító modul, emergency kit, inverter modul LED-hez

![Vészvilágítási modul (konverziós készlet)](svg/vesz-modul.svg)

Akkumulátorból, töltőből és átkapcsolóból (inverterből) álló egység, amely egy hagyományos lámpatestet biztonsági lámpatestté alakít: kimaradáskor csökkentett fényerővel a saját akkumulátoráról táplálja a LED-et.

- **Szerelés:** egy normál lámpatestbe vagy mellé építve
- **Fényforrás:** a normál lámpatest LED-je a modulról
- **Védettség:** a lámpatesté · a lámpatesté
- **Fény:** vészüzemben a normál fényáram töredéke (a modul vészüzemi fényáram-tényezője szerint) · a lámpatesté · a lámpatesté · a lámpatesté
- **Vezérlés:** töltésjelző, próbagomb, önteszt (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A modulnak kompatibilisnek kell lennie a lámpatest LED-meghajtójával és a LED-modul feszültségével (a gyártói lista szerint).
  - Az átalakított lámpatest megfelelőségéért az átalakító felel: a gyártói átalakítás vagy előre gyártott vészvilágítási kivitel biztonságosabb.
  - A vészüzemi fényáramot a lámpatest helyén is ellenőrizni kell (számítás).
- **Előírás:** MSZ EN 61347-2-7 (a modul), MSZ EN 60598-2-22 (az átalakított lámpatest) (kártyák: MSZ EN 60598-2-22 · Lámpatestek biztonsági világításhoz, MSZ EN 1838 · Vészvilágítás: alkalmazás, MSZ EN 61347 és MSZ EN 62776 · Működtetők és LED-csövek)
- **Rajzjel:** `lum.emergency` (Rajztár)
- **Hova:** ahol a normál lámpatest a biztonsági világítás része: irodák, folyosók, üzletek
- **Buktatók:**
  - Nem kompatibilis meghajtóval a modul nem kapcsol át, vagy tönkreteszi a LED-et.
  - A vészüzemi fényáram sokkal kisebb, mint a normál: a terv ezzel számoljon.
- **Rokon típusok:** Önálló akkumulátoros biztonsági lámpatest, LED-panel, Páramentes lámpatest
- **Keresőszavak:** HU: vészvilágító modul LED-hez 3 óra · inverter modul vészvilágítás — EN: LED emergency conversion kit 3h — DE: Notlichtumschaltmodul LED 3h · Notlichtbaustein
- **Hol kapható:** Villamossági nagykereskedés, biztonságtechnikai szaküzlet.

### Áramszünet-jelző éjszakai fény

*Más néven:* konnektoros vészfény, kivehető zseblámpás éjszakai fény, power failure light

![Áramszünet-jelző éjszakai fény](svg/aramszunet-feny.svg)

Lakásba való, konnektorba dugott kis lámpa: éjszakai tájékozódó fény, áramszünetkor magától bekapcsol, és sokszor kivehető zseblámpaként is használható. Nem a szabványos biztonsági világítás része, de lakásban hasznos.

- **Szerelés:** dugaszolós, a fali aljzatba
- **Fényforrás:** integrált LED, akkumulátor
- **Védettség:** IP20 · II. érintésvédelmi osztály
- **Fény:** 5–100 lm · 2700–4000 K · jellemzően nem megadott · szórt
- **Vezérlés:** alkonykapcsoló, automatikus bekapcsolás áramszünetkor (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Folyosó, lépcső, hálószoba ajtaja mellé, egy elérhető aljzatba.
- **Előírás:** MSZ EN 60598-2-12 (aljzatba dugható éjszakai fények) (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** folyosó, gyerekszoba, lépcső, idősek lakása
- **Buktatók:**
  - Nem helyettesíti a kötelező biztonsági világítást ott, ahol az előírás azt kéri.
- **Rokon típusok:** Ágy alatti orientációs fény, Falba süllyesztett lépcső- és orientációs fény
- **Keresőszavak:** HU: áramszünet lámpa konnektorba · vészfény zseblámpával — EN: plug-in power failure night light — DE: Notlicht Steckdose mit Taschenlampe
- **Hol kapható:** Barkácsáruház, műszaki áruház.

### Utánvilágító (fotolumineszcens) jel és csík

*Más néven:* fluoreszkáló menekülési jel, foszforeszkáló csík, photoluminescent sign

![Utánvilágító (fotolumineszcens) jel és csík](svg/utanvilagito-jel.svg)

Áram nélkül működő jel vagy csík, amely a környező fényből töltődik fel, és sötétben egy ideig magától világít. Kiegészíti a biztonsági világítást (lépcsőél, padló menti útvonal, jelek), de nem helyettesíti.

- **Szerelés:** falra, padlóra, lépcsőélre ragasztva vagy csavarozva
- **Fényforrás:** nincs: fotolumineszcens anyag
- **Védettség:** nem villamos termék · —
- **Fény:** nincs fényáram; az utánvilágítás fénysűrűsége (mcd/m²) a jellemző · sárgászöld · — · a felületről szórt
- **Vezérlés:** nincs: a normál világítás tölti fel
- **Beépítés:**
  - Csak ott működik, ahol a normál világítás rendszeresen feltölti.
  - A jel piktogramja szabványos legyen; méretét a felismerési távolság adja.
- **Rögzítés:** Nylon terpesztődübel, Csempe, járólap
- **Előírás:** MSZ EN ISO 7010, ISO 16069 (utánvilágító menekülési jelrendszerek) (kártyák: MSZ EN ISO 7010 · Biztonsági jelek)
- **Hova:** lépcsőház, menekülési útvonal, hajó, alagút, mélygarázs
- **Buktatók:**
  - Sötét helyen, ahol nincs feltöltő fény, nem világít.
  - Idővel halványul: cserélni kell.
- **Rokon típusok:** Menekülési útirány- és kijáratjelző
- **Keresőszavak:** HU: utánvilágító menekülési jel · fotolumineszcens csík lépcsőre — EN: photoluminescent exit sign · glow in the dark stair strip — DE: langnachleuchtendes Rettungszeichen · nachleuchtende Treppenmarkierung
- **Hol kapható:** Biztonságtechnikai szaküzlet, munkavédelmi bolt.

## 9. Kereskedelmi és ipari

### Irodai lámpatest

*Más néven:* alacsony káprázású lámpatest, UGR19 lámpatest, irodai függesztett lámpa

![Irodai lámpatest](svg/irodai-lampatest.svg)

Képernyős munkahelyekre tervezett lámpatest, amely a munkafelületen elegendő, egyenletes fényt ad, és a képernyőn nem tükröződik; káprázáskorlátozó optikával (mikroprizma, raszter).

- **Szerelés:** álmennyezetbe, felületre vagy függesztve
- **Fényforrás:** integrált LED
- **Védettség:** IP20 – IP40 · I. vagy II. érintésvédelmi osztály
- **Fény:** 3000–6000 lm · 3000–4000 K · Ra ≥ 80 (≥ 90 igényes helyen) · denevérszárny, alacsony káprázás (UGR < 19)
- **Vezérlés:** DALI, jelenlét- és fényérzékelővel, napfényfüggő szabályozás (vonalak: DALI, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA, KNX TP)
- **Beépítés:**
  - A munkahelyi megvilágítás tervét számítással kell igazolni (a munkafelületen jellemzően 500 lx irodai munkára).
  - Függesztésnél a menetes szár vagy a sodrony a födémbe, a terhelés szerint.
- **Rögzítés:** Beton, Beütős horgony, Menetes szár, metrikus csavar, Gipszkarton
- **Előírás:** MSZ EN 12464-1 (munkahelyek világítása), MSZ EN 60598-2-1 / -2-2 (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 12464-1 · Munkahelyek világítása (beltér))
- **Rajzjel:** `lum.panel` (Rajztár)
- **Hova:** iroda, tárgyaló, tanterem, otthoni dolgozószoba
- **Buktatók:**
  - A „UGR < 19” csak a megadott elrendezésre igaz: a terv számít.
- **Rokon típusok:** LED-panel, Fénysor-rendszer (trunking), LED-fénycső és armatúra
- **Keresőszavak:** HU: irodai lámpatest UGR19 · függesztett irodai LED lámpa — EN: office luminaire UGR<19 · suspended office light — DE: Büroleuchte UGR19 · Pendelleuchte Büro
- **Hol kapható:** Villamossági nagykereskedés, világítástechnikai szakkereskedés.

### Fénysor-rendszer (trunking)

*Más néven:* folytonos fénysor, trunking rendszer, sínes fénysor

![Fénysor-rendszer (trunking)](svg/fenysor.svg)

Hosszú tartósín, amelyben a betápláló vezetékek futnak, és amelybe a lámpabetétek bárhol bepattinthatók: üzletek, raktárak, csarnokok folytonos fénysorai.

- **Szerelés:** mennyezetre függesztve vagy felületre, folytonos sorban
- **Fényforrás:** LED-betétek (cserélhető optikával)
- **Védettség:** IP20 – IP54 · I. érintésvédelmi osztály
- **Fény:** betétenként 3000–10 000 lm · 4000–5000 K · Ra ≥ 80 · keskeny, széles, aszimmetrikus (polc) optikák
- **Vezérlés:** több áramkör a sínben (pl. biztonsági világítás külön), DALI (vonalak: DALI, Hálózati 50 Hz)
- **Beépítés:**
  - A sín 5–11 vezetős lehet: a betétek fázisonként és a biztonsági áramkörre is köthetők.
  - Függesztés a sín terhelése és a födém szerint.
- **Rögzítés:** Beton, Trapézlemez, acéllemez, Acélszerkezet, Beütős horgony, Menetes szár, metrikus csavar
- **Előírás:** MSZ EN 12464-1, MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 12464-1 · Munkahelyek világítása (beltér))
- **Rajzjel:** `lum.linear` (Rajztár)
- **Hova:** üzlet, raktár, csarnok, műhely
- **Buktatók:**
  - A gyártók sínei és betétei nem cserélhetők fel.
- **Rokon típusok:** Irodai lámpatest, Csarnokvilágító (high bay), Polcvilágító (kereskedelmi)
- **Keresőszavak:** HU: fénysor rendszer LED · trunking LED — EN: LED trunking system — DE: Lichtbandsystem LED
- **Hol kapható:** Világítástechnikai szakkereskedés.

### Csarnokvilágító (high bay)

*Más néven:* high bay, UFO csarnoklámpa, ipari csarnokvilágító

![Csarnokvilágító (high bay)](svg/csarnokvilagito.svg)

Nagy belmagasságú terek (csarnok, raktár, sportterem) nagy fényáramú lámpateste; az optika a szerelési magassághoz és a polcsorokhoz választható.

- **Szerelés:** 6–20 m magasan, kampóra, láncra vagy konzolra függesztve
- **Fényforrás:** integrált LED, külön vagy beépített meghajtóval
- **Védettség:** IP65 · IK08 vagy jobb · I. érintésvédelmi osztály
- **Fény:** 10 000–40 000 lm · 4000–5000 K · Ra ≥ 80 · 60°, 90°, 120° vagy folyosó (polc) optika
- **Vezérlés:** DALI, 1–10 V, jelenlét-érzékelő a nagy magassághoz (vonalak: DALI, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA)
- **Beépítés:**
  - A függesztést biztosító sodronnyal kell kiegészíteni.
  - A karbantartás emelőgépet kíván: a meghajtó élettartama és cserélhetősége számít.
- **Rögzítés:** Acélszerkezet, Beton, Beütős horgony, Menetes szár, metrikus csavar
- **Előírás:** MSZ EN 12464-1, MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 12464-1 · Munkahelyek világítása (beltér))
- **Rajzjel:** `lum.flood` (Rajztár)
- **Hova:** csarnok, raktár, műhely, sportterem, mezőgazdasági épület
- **Buktatók:**
  - Sportteremben labdaálló kivitel.
  - Túl széles optika magas polcsorok között a polcok tetejét világítja, nem a folyosót.
- **Rokon típusok:** Fénysor-rendszer (trunking), Nagy terek biztonsági lámpateste (nyílt terület), Páramentes lámpatest
- **Keresőszavak:** HU: LED csarnokvilágító 150W · high bay lámpa — EN: LED high bay 150W — DE: LED Hallenstrahler 150W
- **Hol kapható:** Villamossági nagykereskedés, világítástechnikai szakkereskedés.

### LED-fénycső és armatúra

*Más néven:* T8 LED cső, fénycsöves armatúra, LED retrofit cső

![LED-fénycső és armatúra](svg/led-fenycso.svg)

A régi T8 fénycső helyére tervezett LED-cső (G13 foglalat) vagy LED-csöves armatúra. A meglévő fénycsöves lámpatestek korszerűsítésének gyakori módja.

- **Szerelés:** armatúrába, mennyezetre vagy falra
- **Fényforrás:** T8 LED-cső (60, 120, 150 cm), G13 foglalat
- **Védettség:** az armatúrától függ (IP20 – IP65) · I. érintésvédelmi osztály (armatúra)
- **Fény:** csövenként 900–3000 lm · 4000–6500 K · Ra ≥ 80 · kb. 160°
- **Vezérlés:** kapcsolt (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A LED-cső típusa dönti el az átalakítást: elektronikus előtétes armatúrába, hagyományos (induktív) előtéteshez gyújtócserével, vagy közvetlen hálózati bekötéssel (az előtét kiiktatásával).
  - Közvetlen bekötésnél az armatúrát átalakítottként fel kell címkézni, hogy ne kerüljön bele régi fénycső.
  - Az egyoldalas és kétoldalas betáplálású csövek nem cserélhetők fel.
- **Rögzítés:** Beton, Nylon terpesztődübel, Beütős dübel
- **Előírás:** MSZ EN 62776 (kétvégű LED-csövek), MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 61347 és MSZ EN 62776 · Működtetők és LED-csövek)
- **Rajzjel:** `lum.linear` (Rajztár)
- **Hova:** garázs, pince, műhely, iroda, lépcsőház
- **Buktatók:**
  - A rossz típusú LED-cső a régi armatúrában zárlatot vagy áramütésveszélyt okozhat.
  - Átalakított armatúra jelölés nélkül: a következő fénycsőcserénél baleset.
- **Rokon típusok:** Páramentes lámpatest, Irodai lámpatest
- **Keresőszavak:** HU: T8 LED fénycső 120 cm · LED fénycső gyújtó — EN: T8 LED tube 120 cm · LED tube starter — DE: T8 LED Röhre 120 cm · LED Starter
- **Hol kapható:** Villamossági nagykereskedés, barkácsáruház.

### Polcvilágító (kereskedelmi)

*Más néven:* bolti polcvilágítás, retail polcfény

![Polcvilágító (kereskedelmi)](svg/polcvilagito.svg)

Az áru függőleges felületét egyenletesen megvilágító, aszimmetrikus lámpatest: üzletekben a polcokat világítja, nem a folyosót.

- **Szerelés:** a polc elejébe, a polcsor fölé vagy a fénysorba
- **Fényforrás:** integrált LED
- **Védettség:** IP20 · II. vagy III. érintésvédelmi osztály
- **Fény:** méterenként 500–2000 lm · 3000–4000 K (élelmiszernél speciális spektrum is) · Ra ≥ 90 · aszimmetrikus, a polc felé
- **Vezérlés:** kapcsolt, DALI (vonalak: DALI)
- **Beépítés:**
  - A polcrendszer gyártójának tápellátó sínjével vagy csatlakozóival.
- **Rögzítés:** Önfúró lemezcsavar, Forgácslapcsavar
- **Előírás:** MSZ EN 12464-1, MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 12464-1 · Munkahelyek világítása (beltér))
- **Rajzjel:** `lum.linear` (Rajztár)
- **Hova:** üzlet, bemutatóterem, kamra nagy polcrendszerrel
- **Buktatók:**
  - Élelmiszernél a színhőmérséklet és a spektrum az áru megjelenését is befolyásolja.
- **Rokon típusok:** Fénysor-rendszer (trunking), Polc- és vitrinvilágítás
- **Keresőszavak:** HU: polcvilágító LED bolt — EN: retail shelf lighting LED — DE: Regalbeleuchtung LED Laden
- **Hol kapható:** Világítástechnikai szakkereskedés, üzletberendező.

### Parkolóházi és garázslámpatest

*Más néven:* mélygarázs lámpa, parkolóház világítás

![Parkolóházi és garázslámpatest](svg/parkolohazi.svg)

Por- és vízálló, ütésálló vonali lámpatest garázsokba és parkolóházakba, gyakran mozgásérzékelővel, alapfényerőre visszakapcsolva.

- **Szerelés:** mennyezetre, felületre
- **Fényforrás:** integrált LED
- **Védettség:** IP65 · IK08 – IK10 · I. vagy II. érintésvédelmi osztály
- **Fény:** 3000–8000 lm · 4000–5000 K · Ra ≥ 80 · széles, a parkolóhelyek és a közlekedőút felé
- **Vezérlés:** mozgásérzékelő alapfényerővel, DALI, egyes típusokban vészvilágítási modullal (vonalak: DALI, Hálózati 50 Hz)
- **Beépítés:**
  - A rámpák és a bejáratok megvilágítása a szem alkalmazkodása miatt nappal erősebb lehet.
  - A kipufogógáz és a só miatt korrózióálló kivitel.
- **Rögzítés:** Beton, Beütős dübel, Üreges födémpanel
- **Előírás:** MSZ EN 12464-1, MSZ EN 60598-2-1 (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 12464-1 · Munkahelyek világítása (beltér))
- **Rajzjel:** `lum.linear` (Rajztár)
- **Hova:** mélygarázs, parkolóház, társasházi garázs
- **Buktatók:**
  - Feszített födémpanelbe fúrni csak a feszítőhuzalok elkerülésével.
- **Rokon típusok:** Páramentes lámpatest, Vészvilágítási modul (konverziós készlet), Csarnokvilágító (high bay)
- **Keresőszavak:** HU: mélygarázs LED lámpa IP65 mozgásérzékelős — EN: car park LED luminaire with sensor — DE: Tiefgaragenleuchte LED Sensor
- **Hol kapható:** Villamossági nagykereskedés.

### Utcai lámpatest (közvilágítás)

*Más néven:* közvilágítási lámpatest, útvilágító, kandeláber lámpafej

![Utcai lámpatest (közvilágítás)](svg/utcai-lampatest.svg)

Utak, járdák, terek megvilágítására szolgáló lámpafej útvilágítási optikával, amely a fényt hosszan az útra teríti, és nem világít az égre. A közvilágítás a hálózat üzemeltetőjéé vagy az önkormányzaté; magánterületen (lakópark, telephely) a tulajdonosé.

- **Szerelés:** kandeláberre vagy villanyoszlopra, karra
- **Fényforrás:** integrált LED
- **Védettség:** IP66 · IK08 vagy jobb · I. vagy II. érintésvédelmi osztály
- **Fény:** 2000–20 000 lm · 2700–4000 K (lakott területen inkább meleg) · Ra ≥ 70 · útvilágítási, aszimmetrikus
- **Vezérlés:** alkonykapcsoló, éjszakai csökkentés, távfelügyelet (vonalak: Hálózati 50 Hz, 868 MHz sáv)
- **Beépítés:**
  - Magánterületen a kandeláber alapja, földkábel, oszlopon belüli kötődoboz és biztosító a terv szerint.
  - Közterületen csak az üzemeltető megbízásából.
- **Rögzítés:** Beton, Csavaros terpesztő horgony, Vegyi dübel
- **Előírás:** MSZ EN 13201 (közúti világítás), MSZ EN 60598-2-3 (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 13201 · Közúti világítás)
- **Rajzjel:** `lum.outdoor` (Rajztár)
- **Hova:** lakópark útjai, telephely, parkoló
- **Buktatók:**
  - A felfelé szórt fény fényszennyezés és pazarlás.
- **Rokon típusok:** Kerti oszloplámpa (bollard), Mozgásérzékelős reflektor
- **Keresőszavak:** HU: LED utcai lámpatest · kandeláber — EN: LED street light · lighting column — DE: LED Straßenleuchte · Lichtmast
- **Hol kapható:** Világítástechnikai szakkereskedés, közvilágítási forgalmazó.

## 10. Niche

### Növénynevelő lámpa

*Más néven:* grow light, növénylámpa, full spectrum grow LED

![Növénynevelő lámpa](svg/novenynevelo.svg)

A növények fotoszintéziséhez illesztett spektrumú LED-lámpa (sok kék és vörös, vagy teljes spektrum); a hatékonyságát nem lumenben, hanem a fotoszintetikusan aktív sugárzásban mérik.

- **Szerelés:** a növények fölé függesztve vagy polcra szerelve
- **Fényforrás:** integrált LED, speciális spektrum
- **Védettség:** IP20 – IP65 · a gyártó szerint
- **Fény:** a lumen itt félrevezető: a PPF (µmol/s) és a PPFD (µmol/m²s) a jellemző · teljes spektrum vagy rózsaszínes (kék + vörös) · — · széles, a növényállományra
- **Vezérlés:** időzítő (napszak), dimmer, okos vezérlés (vonalak: 2,4 GHz sáv, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA)
- **Beépítés:**
  - Párás környezetben IP-s kivitel és áram-védőkapcsoló.
  - A tartós, nagy teljesítményű terheléshez méretezett áramkör.
- **Rögzítés:** Menetes szár, metrikus csavar, Fa, Beton
- **Előírás:** MSZ EN 60598-1, MSZ EN 62471 (fotobiológiai biztonság) (kártyák: MSZ EN 60598 · Lámpatestek, MSZ EN 62471 · Fotobiológiai biztonság)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** beltéri kert, üvegház, pince
- **Buktatók:**
  - A rózsaszínes fény a szemnek kellemetlen és torzítja a színeket.
- **Rokon típusok:** Akváriumi lámpa
- **Keresőszavak:** HU: növénynevelő LED lámpa teljes spektrum — EN: full spectrum LED grow light — DE: Pflanzenlampe LED Vollspektrum
- **Hol kapható:** Kertészeti szaküzlet, hidrokultúra-bolt.

### Akváriumi lámpa

*Más néven:* akvárium világítás, terrárium lámpa

![Akváriumi lámpa](svg/akvariumi.svg)

Az akvárium fölötti, nedvességálló lámpa a halak és a vízinövények igényeihez illesztett spektrummal, gyakran napszakot utánzó vezérléssel.

- **Szerelés:** az akvárium fedelébe vagy fölé
- **Fényforrás:** integrált LED
- **Védettség:** IP65 – IP67 · III. érintésvédelmi osztály (törpefeszültség, gyakran)
- **Fény:** 500–5000 lm · 6500–10 000 K, kék csatornával · — · széles
- **Vezérlés:** időzítő, napfelkelte–napnyugta program, alkalmazás (vonalak: 2,4 GHz sáv)
- **Beépítés:**
  - A tápegység a víztől távol, a vízcseppek útján kívül; áram-védőkapcsolós aljzat.
- **Előírás:** MSZ EN 60598-2-11 (akváriumlámpák) (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** nappali, akváriumszoba
- **Buktatók:**
  - A pára és a kicsapódó víz a nem tömített csatlakozót tönkreteszi.
- **Rokon típusok:** Növénynevelő lámpa
- **Keresőszavak:** HU: akvárium LED világítás — EN: aquarium LED light — DE: Aquarium LED Beleuchtung
- **Hol kapható:** Akvarisztikai szaküzlet.

### UV-C fertőtlenítő lámpa

*Más néven:* UV-C lámpa, germicid lámpa, fertőtlenítő sugárzó

![UV-C fertőtlenítő lámpa](svg/uvc.svg)

A 200–280 nm-es UV-C sugárzással a mikroorganizmusokat inaktiváló lámpa: zárt (keringtetős) készülékben vagy üres helyiség besugárzására. Az emberi szemre és bőrre veszélyes.

- **Szerelés:** mennyezetre, falra, légcsatornába vagy zárt készülékbe
- **Fényforrás:** UV-C fénycső vagy UV-C LED
- **Védettség:** IP20 – IP65 · a gyártó szerint
- **Fény:** nincs: a sugárzott UV-C teljesítmény (W) és a dózis a jellemző · — · — · a besugárzandó felületre
- **Vezérlés:** időzítő, jelenlét-érzékelős biztonsági lekapcsolás, ajtókapcsoló (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - Nyitott besugárzó csak üres helyiségben működhet: jelenlét-érzékelővel és ajtókapcsolóval reteszelni kell, figyelmeztető jelzéssel.
  - A zárt, keringtetős készülék emberek jelenlétében is használható.
- **Rögzítés:** Beton, Nylon terpesztődübel
- **Előírás:** MSZ EN 62471 (fotobiológiai biztonság), a készülékre a gyártói megfelelőség (kártyák: MSZ EN 62471 · Fotobiológiai biztonság)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** rendelő, labor, öltöző, légtechnika
- **Buktatók:**
  - Közvetlen UV-C sugárzás néhány perc alatt szem- és bőrkárosodást okoz.
  - Az ózont termelő lámpa után szellőztetni kell.
- **Rokon típusok:** Vizsgáló- és műtőlámpa
- **Keresőszavak:** HU: UV-C fertőtlenítő lámpa reteszeléssel · UV-C légtisztító — EN: UV-C germicidal lamp · UV-C air purifier — DE: UV-C Entkeimungslampe · UV-C Luftreiniger
- **Hol kapható:** Egészségügyi és laborfelszerelés-forgalmazó.

### Robbanásbiztos (Ex) lámpatest

*Más néven:* Ex lámpatest, ATEX lámpa, robbanásveszélyes térbe

![Robbanásbiztos (Ex) lámpatest](svg/robbanasbiztos.svg)

Gáz- vagy porrobbanás-veszélyes térbe (benzinkút, festőüzem, malom, gázkazánház egy része) minősített lámpatest, amely nem gyújthatja be a környező légteret.

- **Szerelés:** robbanásveszélyes zónába, felületre vagy függesztve
- **Fényforrás:** integrált LED
- **Védettség:** IP66 vagy több · IK08 vagy jobb · Ex-jelölés a zóna és a gázcsoport szerint
- **Fény:** 1000–20 000 lm · 4000–5000 K · Ra ≥ 70 · széles
- **Vezérlés:** kapcsolt, Ex-minősített kapcsolóval vagy a zónán kívülről (vonalak: Hálózati 50 Hz)
- **Beépítés:**
  - A zónabesorolás (pl. 1., 2., 21., 22.) a robbanásvédelmi dokumentációból jön; a lámpatest, a kábelbevezetés és a kötés is erre minősített legyen.
  - Csak erre jogosult szakember tervezhet és szerelhet; a szerelés után ellenőrzés.
- **Rögzítés:** Beton, Acélszerkezet, Csavaros terpesztő horgony
- **Előírás:** MSZ EN 60079 sorozat (robbanóképes közegek), ATEX irányelv (kártyák: MSZ EN 60079 és ATEX · Robbanásveszélyes terek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** benzinkút, festőüzem, akkumulátortöltő helyiség, malom, vegyi raktár
- **Buktatók:**
  - Nem minősített tömszelence vagy kötés az egész lámpatest minősítését érvényteleníti.
- **Rokon típusok:** Csarnokvilágító (high bay), Páramentes lámpatest
- **Keresőszavak:** HU: Ex lámpatest zóna 1 · ATEX LED lámpa — EN: ATEX LED luminaire zone 1 · explosion proof light — DE: Ex Leuchte Zone 1 · ATEX LED Leuchte
- **Hol kapható:** Robbanásbiztos berendezések szakkereskedése.

### Színpadi és mozgófejes lámpa

*Más néven:* mozgófej, PAR lámpa, színpadi spot, DMX lámpa

![Színpadi és mozgófejes lámpa](svg/szinpadi.svg)

Rendezvények és színpadok lámpái: színes PAR-lámpák, profilos spotok, motoros mozgófejek. DMX-vezérléssel (RS-485 alapú busz) egy pultról programozhatók.

- **Szerelés:** színpadi tartószerkezetre (truss), bilinccsel, biztosító kötéllel
- **Fényforrás:** LED, kisülőlámpa (régebben)
- **Védettség:** IP20 (kültéri IP65) · I. érintésvédelmi osztály
- **Fény:** 1000–50 000 lm · RGBW, változtatható fehér · Ra ≥ 80 – 95 · 2–60°, zoomos
- **Vezérlés:** DMX512 (RS-485 fizikai réteg), Art-Net / sACN Etherneten (vonalak: RS-485 · Modbus RTU, Ethernet csavart érpár)
- **Beépítés:**
  - Minden függesztett lámpatesthez biztosító kötél (safety) a fő rögzítés mellett.
  - A DMX-lánc végét lezárással kell ellátni, mint egy RS-485 buszt.
- **Rögzítés:** Acélszerkezet, Menetes szár, metrikus csavar
- **Előírás:** MSZ EN 60598-2-17 (színpadi és stúdió lámpatestek) (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.spot` (Rajztár)
- **Hova:** színpad, rendezvényterem, klub, templom, stúdió
- **Buktatók:**
  - Biztosító kötél nélkül a leeső lámpa életveszélyes.
- **Rokon típusok:** Sínrendszer 230 V, HCL: emberközpontú világítás (hangolható fehér)
- **Keresőszavak:** HU: DMX mozgófej · LED PAR lámpa — EN: DMX moving head · LED PAR can — DE: DMX Moving Head · LED PAR Scheinwerfer
- **Hol kapható:** Színpadtechnikai szaküzlet.

### Száloptikás csillagos mennyezet

*Más néven:* csillagos égbolt mennyezet, fiber optic star ceiling

![Száloptikás csillagos mennyezet](svg/csillagos-mennyezet.svg)

Egyetlen fényforrás (projektor) fényét sok optikai szál vezeti a mennyezet apró furataiba: csillagos égbolt hatás, villódzó, színváltó változatban is. A furatokban nincs elektromosság.

- **Szerelés:** a mennyezetbe fűzött optikai szálak, a fényforrás a mennyezet fölött
- **Fényforrás:** LED-projektor optikai szálköteggel
- **Védettség:** a szálvégeken nincs villamos rész · a projektoré
- **Fény:** nagyon kevés: díszítő fény · meleg vagy hideg fehér, RGB · — · pontszerű csillagok
- **Vezérlés:** a projektor távirányítója, okos vezérlés (vonalak: 2,4 GHz sáv)
- **Beépítés:**
  - A projektor hozzáférhető helyre (revíziós nyílás), a szálak hossza ehhez igazítva.
  - A szálakat a gipszkarton lapozása előtt vagy a lap átfúrásával fűzik; a végeket síkba vágják.
- **Rögzítés:** Gipszkarton, Fa
- **Előírás:** MSZ EN 60598-1 (a projektor) (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** hálószoba, gyerekszoba, házimozi, szauna
- **Buktatók:**
  - A projektor ventilátora zajos lehet: hálószobában a helye számít.
- **Rokon típusok:** Világító mennyezet, Szaunavilágítás
- **Keresőszavak:** HU: száloptikás csillagos mennyezet készlet — EN: fiber optic star ceiling kit — DE: Sternenhimmel Glasfaser Set
- **Hol kapható:** Világítástechnikai szaküzlet, szaunaszaküzlet.

### Napfénycső (fénycsatorna)

*Más néven:* tubular daylight device, fénycső tetőre, Solatube-típusú

![Napfénycső (fénycsatorna)](svg/napfenycso.svg)

A tetőn lévő kupola napfényt gyűjt, a belül tükröző cső levezeti, és a mennyezeti szórólap szétszórja: elektromosság nélküli „lámpa” ablaktalan helyiségekbe. Kiegészítőként beépített LED-del vagy szellőzővel is kapható.

- **Szerelés:** a tetőn át a mennyezetig, belül tükrös csővel
- **Fényforrás:** napfény (kiegészítő LED-modul)
- **Védettség:** a tetőátvezetés vízzáró szerkezet · a LED-kiegészítőé
- **Fény:** a nappali fénytől függ: derült időben egy erős lámpa fényárama · a nappali fényé · a nappali fényé · szórt
- **Vezérlés:** nincs (a kiegészítő LED kapcsolható)
- **Beépítés:**
  - A tetőátvezetést a tetőfedővel együtt kell beépíteni; a cső hossza és a kanyarok száma a fényt csökkenti.
  - Hőszigetelt padláson a cső szigetelése a páralecsapódás ellen.
- **Rögzítés:** Fa, Gipszkarton
- **Előírás:** a gyártó beépítési útmutatója; a LED-kiegészítőre MSZ EN 60598-1 (kártyák: MSZ EN 60598 · Lámpatestek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** ablaktalan fürdő, folyosó, kamra, belső helyiség
- **Buktatók:**
  - Éjszaka nem ad fényt: a helyiségben más világítás is kell.
- **Rokon típusok:** Világító mennyezet, HCL: emberközpontú világítás (hangolható fehér)
- **Keresőszavak:** HU: napfénycső tetőre · fénycsatorna — EN: tubular skylight · sun tunnel — DE: Tageslichtspot · Lichtröhre Dach
- **Hol kapható:** Tetőablak-forgalmazó, tetőfedő anyagkereskedés.

### HCL: emberközpontú világítás (hangolható fehér)

*Más néven:* human centric lighting, tunable white, biodinamikus világítás

![HCL: emberközpontú világítás (hangolható fehér)](svg/hcl.svg)

A színhőmérsékletet és a fényerőt a napszakhoz igazító világítás: reggel és napközben hidegebb, erősebb, este melegebb, halványabb fény, a napi ritmus támogatására. Nem egy lámpa, hanem lámpák és vezérlés rendszere.

- **Szerelés:** bármely lámpatest-forma hangolható fehér kivitelben
- **Fényforrás:** hangolható fehér (CCT) LED, két csatornával
- **Védettség:** a lámpatesté · a lámpatesté
- **Fény:** a lámpatesté · jellemzően 2700–6500 K között változtatható · Ra ≥ 90 · a lámpatesté
- **Vezérlés:** DALI DT8, Zigbee, Thread / Matter, KNX: időprogrammal vagy napkövetéssel (vonalak: DALI, 2,4 GHz sáv, KNX TP)
- **Beépítés:**
  - Egy helyiségben azonos vezérlési rendszer és egymáshoz hangolt lámpatestek kellenek, különben eltérő színek.
  - A két csatorna (meleg és hideg) bekötése a meghajtó szerint.
- **Előírás:** MSZ EN 12464-1; a nem vizuális hatásokra CIE S 026 (tájékoztató) (kártyák: MSZ EN 12464-1 · Munkahelyek világítása (beltér))
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** iroda, iskola, idősotthon, otthoni dolgozószoba és hálószoba
- **Buktatók:**
  - Különböző gyártók hangolható fehér lámpái ugyanazon a beállításon eltérő színt adhatnak.
- **Rokon típusok:** Világító mennyezet, LED-panel, Napfénycső (fénycsatorna)
- **Keresőszavak:** HU: hangolható fehér LED DALI DT8 · human centric lighting — EN: tunable white LED DALI DT8 · human centric lighting — DE: Tunable White LED DALI DT8 · Human Centric Lighting
- **Hol kapható:** Világítástechnikai szakkereskedés.

### Sütő- és hűtővilágítás

*Más néven:* sütőlámpa, hűtőlámpa, hőálló izzó

![Sütő- és hűtővilágítás](svg/sutovilagitas.svg)

A háztartási gépek belső világítása: a sütőben hőálló (jellemzően 300 °C-ig) izzó vagy LED, a hűtőben hidegben is működő LED. A gép része, cseréje az alkatrész szerint.

- **Szerelés:** a háztartási gépben, gyári foglalatban
- **Fényforrás:** hőálló E14 / G9 izzó, vagy gyári LED-modul
- **Védettség:** a gépé · a gépé
- **Fény:** kevés: belső megvilágítás · meleg vagy semleges fehér · — · szórt
- **Vezérlés:** ajtókapcsoló, a gép vezérlése
- **Beépítés:**
  - Csere előtt a gépet feszültségmentesíteni kell; a búra tömítését vissza kell tenni.
- **Előírás:** a gépre MSZ EN 60335 sorozat; a fényforrásra a gyártói jelölés (kártyák: MSZ EN 60335 · Háztartási készülékek)
- **Rajzjel:** `lum.general` (Rajztár)
- **Hova:** konyha
- **Buktatók:**
  - Sütőbe csak sütőbe minősített fényforrás való: a közönséges izzó vagy LED elolvad vagy szétreped.
- **Rokon típusok:** Konyhai pult alatti világítás
- **Keresőszavak:** HU: sütő izzó 300 fok · hűtőgép LED izzó — EN: oven lamp 300°C · fridge LED bulb — DE: Backofenlampe 300°C · Kühlschranklampe LED
- **Hol kapható:** Háztartásigép-alkatrész bolt, műszaki áruház.

### Vizsgáló- és műtőlámpa

*Más néven:* orvosi vizsgálólámpa, műtőlámpa, nagyítós lámpa

![Vizsgáló- és műtőlámpa](svg/vizsgalolampa.svg)

Egészségügyi és kozmetikai célú, nagy megvilágítású, árnyékmentes és kiváló színvisszaadású lámpa; a műtőlámpa orvostechnikai eszköz, külön szabályozással.

- **Szerelés:** mennyezetre, falra vagy gurulós állványra, karral
- **Fényforrás:** integrált LED
- **Védettség:** IP20 – IP54 · a gyártó szerint, orvosi minősítéssel
- **Fény:** a jellemző a megvilágítás a munkamezőben (több tízezer lux) · 4000–5000 K · Ra ≥ 90 – 95 · keskeny, fókuszálható
- **Vezérlés:** a lámpán: fényerő, fókusz, steril fogantyú
- **Beépítés:**
  - Mennyezeti karnál a födém teherbírása és a rögzítőlap a gyártó szerint; a helyiség orvosi villamos előírásai (csoportok, potenciálkiegyenlítés).
- **Rögzítés:** Beton, Vegyi dübel, Menetes szár, metrikus csavar
- **Előírás:** MSZ EN 60601-2-41 (műtő- és vizsgálólámpák), MSZ HD 60364-7-710 (orvosi helyiségek) (kártyák: MSZ HD 60364-7-710 · Orvosi helyiségek)
- **Rajzjel:** `lum.spot` (Rajztár)
- **Hova:** rendelő, kozmetika, fogorvosi rendelő, műtő
- **Buktatók:**
  - Orvosi helyiségben a villamos szerelésnek külön szabályai vannak.
- **Rokon típusok:** UV-C fertőtlenítő lámpa
- **Keresőszavak:** HU: LED vizsgálólámpa · kozmetikai nagyítós lámpa — EN: LED examination light · magnifying lamp — DE: LED Untersuchungsleuchte · Lupenleuchte
- **Hol kapható:** Orvostechnikai forgalmazó, kozmetikai nagyker.

### Jelzőtorony és jelzőfény

*Más néven:* toronyfény, jelzőoszlop, villogó, stack light

![Jelzőtorony és jelzőfény](svg/toronyfeny.svg)

Színes jelzőfények egymásra épített sora vagy egyetlen villogó: gépállapotot (piros hiba, sárga figyelmeztetés, zöld üzem), kapumozgást vagy riasztást jelez, gyakran hangjelzővel együtt.

- **Szerelés:** gépre, vezérlőszekrényre, kapura vagy falra
- **Fényforrás:** integrált LED
- **Védettség:** IP54 – IP66 · a gyártó szerint (24 V vagy 230 V)
- **Fény:** a láthatóság a lényeg: folyamatos, villogó vagy forgó fény · piros, sárga, zöld, kék, fehér · — · minden irányba
- **Vezérlés:** a gép vezérlése (PLC kimenet), a kapunyitó vezérlése, IO-Link (vonalak: RS-485 · Modbus RTU, Analóg jelszint: 0–10 V, 1–10 V, 4–20 mA)
- **Beépítés:**
  - A színek jelentése a gép vagy a rendszer dokumentációja szerint egységes legyen.
  - Kapunyitónál a villogó a mozgás előtt kezdjen jelezni.
- **Rögzítés:** Önfúró lemezcsavar, Nylon terpesztődübel
- **Előírás:** MSZ EN 60204-1 (gépek villamos szerkezetei, a jelzőfények színei) (kártyák: MSZ EN 60204-1 · Gépek villamos szerkezetei)
- **Rajzjel:** `meas.lamp` (Rajztár)
- **Hova:** műhely, gépsor, kapu, garázskapu, vezérlőszekrény
- **Buktatók:**
  - Túl sok villogó jel csökkenti a figyelmet a valódi riasztásra.
- **Rokon típusok:** Kapuoszlop- és pillérlámpa
- **Keresőszavak:** HU: jelzőtorony LED 24V · villogó lámpa kapunyitóhoz — EN: LED stack light 24V · warning beacon gate — DE: Signalsäule LED 24V · Warnleuchte Tor
- **Hol kapható:** Ipari automatizálási kereskedés, kapunyitó-forgalmazó.
