# Tankönyv — a Kisokos

*Generálva a lecke-kártyákból (`node Kisokos/kisokos.js md`); ne szerkeszd kézzel. Saját írás; a számpéldák kerekítettek. Vázlat: minden lecke ellenőrzésre vár. A tanterv: `docs/kisokos/tankonyv.md`.*

## 1. szint: Kezdő

- [1. Feszültség, áram, ellenállás](#k01-alapfogalmak)
- [2. Teljesítmény, energia, melegedés](#k02-teljesitmeny)
- [3. Soros és párhuzamos kapcsolás](#k03-soros-parhuzamos)
- [4. Váltakozó áram, fázis, nulla, védővezető](#k04-valtakozo-aram)
- [5. A háromfázisú rendszer](#k05-haromfazis)
- [6. Áramütés és az öt biztonsági szabály](#k06-aramutes-biztonsag)
- [7. Szerszámok és mérőműszerek](#k07-muszerek)
- [8. Vezetékek és kábelek](#k08-vezetekek)
- [9. Kötéstechnika](#k09-kotestechnika)
- [10. Az első áramkörök: kapcsolások](#k10-elso-aramkorok)

<a id="k01-alapfogalmak"></a>

### 1. Feszültség, áram, ellenállás

**Célok**

- Megérteni, mi a feszültség, az áram és az ellenállás, és mi a mértékegységük.
- Ohm törvényével kiszámolni bármelyiket a másik kettőből.
- Kiszámolni egy rézvezeték ellenállását a hossza és a keresztmetszete alapján.

A feszültség (U, volt, V) az a „nyomás”, amely a töltéseket mozgatja: két pont közötti különbség. Egy aljzat fázisa és nullája között kb. 230 V van.

Az áram (I, amper, A) a vezetőn átfolyó töltés mennyisége másodpercenként. Az áram csak zárt körben folyik: a forrástól a fogyasztón át vissza a forrásig.

Az ellenállás (R, ohm, Ω) azt mutatja meg, mennyire akadályozza egy anyag vagy alkatrész az áramot. A réz jól vezet (kicsi az ellenállása), a műanyag szigetel (nagyon nagy).

A hármat Ohm törvénye köti össze: adott feszültségnél minél nagyobb az ellenállás, annál kisebb az áram.

A vezeték maga is ellenállás: minél hosszabb és minél vékonyabb, annál nagyobb. Ezért melegszik a túl vékony vagy túl hosszú vezeték, és ezért esik rajta feszültség.

**Képletek**

- `U = R · I` — feszültség (V) = ellenállás (Ω) × áram (A); átrendezve I = U / R és R = U / I
- `R = ρ · l / A` — vezeték ellenállása: fajlagos ellenállás × hossz (m) / keresztmetszet (mm²); rézre ρ ≈ 0,0178 Ω·mm²/m

**Kidolgozott példa**

Mekkora egy 20 m hosszú, 1,5 mm²-es rézér ellenállása, és mennyi feszültség esik egy 20 m-es áramkör oda-vissza vezetékén 10 A-nél?

1. Egy ér: R = 0,0178 × 20 / 1,5 ≈ 0,237 Ω.
2. Az áram a fázisvezetőn megy oda és a nullán jön vissza: a hurok kb. 2 × 0,237 = 0,475 Ω.
3. Feszültségesés: U = R · I = 0,475 × 10 ≈ 4,7 V.

→ Kb. 4,7 V esik a vezetéken, ez a 230 V kb. 2 %-a. Hosszabb vagy vékonyabb vezetéknél ez gyorsan nő; ezért méretezni kell (2. szint).

**Gyakorló feladatok**

1. Egy 230 V-os fűtőszál ellenállása 26,5 Ω. Mekkora áram folyik rajta?
   <details><summary>Megoldás</summary>I = 230 / 26,5 ≈ 8,7 A.</details>
2. Mekkora a 2,5 mm²-es, 30 m-es rézér ellenállása?
   <details><summary>Megoldás</summary>R = 0,0178 × 30 / 2,5 ≈ 0,21 Ω.</details>
3. Egy lámpán 230 V mellett 0,05 A folyik. Mekkora az ellenállása működés közben?
   <details><summary>Megoldás</summary>R = 230 / 0,05 = 4600 Ω.</details>

**Biztonság**

- A 230 V halálos lehet: minden mérést és szerelést feszültségmentes állapotban kell kezdeni (lásd a 6. leckét).

*Kapcsolódó kártyák:* Hálózati 50 Hz

<a id="k02-teljesitmeny"></a>

### 2. Teljesítmény, energia, melegedés

*Előtte:* 1. Feszültség, áram, ellenállás

**Célok**

- Kiszámolni egy fogyasztó teljesítményét és áramát.
- Megérteni a kWh-t és a villanyszámlát.
- Megérteni, miért ég le egy rossz kötés.

A teljesítmény (P, watt, W) azt mutatja meg, mennyi energiát alakít át egy fogyasztó másodpercenként. Ohmos (fűtő) fogyasztónál P = U · I.

Az energia (W, kilowattóra, kWh) a teljesítmény és az idő szorzata: 1 kW teljesítmény 1 órán át 1 kWh. A villanyszámla ezt méri.

Az áram minden ellenálláson hőt termel: P = I² · R. A hő a négyzetes összefüggés miatt kétszeres áramnál négyszeres. Ezért kell az áramhoz méretezni a vezetéket, és ezért veszélyes a laza kötés: az átmeneti ellenállása kicsi, de 16 A-nél sok hőt termel egy pontban.

**Képletek**

- `P = U · I` — teljesítmény (W) = feszültség (V) × áram (A), ohmos fogyasztónál; átrendezve I = P / U
- `P = I² · R` — egy ellenálláson (vezeték, kötés) termelt hő
- `W = P · t` — energia (kWh) = teljesítmény (kW) × idő (h)

**Kidolgozott példa**

Egy laza kötés átmeneti ellenállása 0,1 Ω. Mennyi hőt termel 16 A-nél? És mennyi áramot vesz fel egy 2000 W-os vízforraló, és mennyi energiát használ 3 perc alatt?

1. Kötés: P = 16² × 0,1 = 25,6 W: egy pontban, a dobozban, mint egy kis forrasztópáka.
2. Vízforraló árama: I = 2000 / 230 ≈ 8,7 A.
3. Energia: 2 kW × 0,05 h (3 perc) = 0,1 kWh.

→ A laza kötés kb. 26 W hőt termel egy pontban: ettől olvad meg a szigetelés és a doboz. A vízforraló 8,7 A-t vesz fel, és 3 perc alatt 0,1 kWh-t használ.

**Gyakorló feladatok**

1. Mekkora áramot vesz fel egy 3,5 kW-os villanybojler 230 V-on?
   <details><summary>Megoldás</summary>I = 3500 / 230 ≈ 15,2 A: egy 16 A-es körre éppen ráfér, mást ne kössünk mellé.</details>
2. Egy 10 W-os LED-lámpa napi 5 órát ég. Mennyi energiát használ egy év alatt?
   <details><summary>Megoldás</summary>10 W × 5 h × 365 = 18 250 Wh ≈ 18,3 kWh.</details>
3. Hányszorosára nő egy vezeték melegedése, ha az áram 10 A-ről 20 A-re nő?
   <details><summary>Megoldás</summary>Négyszeresére, mert P = I² · R.</details>

**Biztonság**

- A melegedő, elszíneződött kötés, a meglazult aljzat és a „büdös” elosztó tűzveszélyes: azonnal feszültségmentesíteni és javítani kell.

*Kapcsolódó kártyák:* Hálózati 50 Hz

<a id="k03-soros-parhuzamos"></a>

### 3. Soros és párhuzamos kapcsolás

*Előtte:* 1. Feszültség, áram, ellenállás, 2. Teljesítmény, energia, melegedés

**Célok**

- Felismerni a soros és a párhuzamos kapcsolást.
- Kiszámolni az eredő ellenállást.
- Megérteni, miért párhuzamosan vannak kötve a lakás fogyasztói, és miért sorosan a kapcsoló.

Soros kapcsolásban az áram egyetlen úton halad át minden elemen: az áram mindenhol ugyanaz, a feszültség megoszlik. Ha egy elem megszakad, az egész kör leáll. A kapcsoló ezért sorosan van a lámpával: megszakítja a kört.

Párhuzamos kapcsolásban minden elem ugyanazt a feszültséget kapja, az áramok összeadódnak. A lakás minden fogyasztója párhuzamosan kapja a 230 V-ot: ezért működik egymástól függetlenül, és ezért adódik össze az áramuk az áramkör vezetékén.

Kirchhoff csomóponti törvénye: egy csomópontba befolyó áramok összege egyenlő a kifolyókéval. Huroktörvénye: egy zárt hurokban a feszültségek összege nulla.

**Képletek**

- `R = R1 + R2 + …` — soros eredő ellenállás
- `1 / R = 1 / R1 + 1 / R2 + …` — párhuzamos eredő ellenállás (két elemre R = R1 · R2 / (R1 + R2))
- `I = I1 + I2 + …` — párhuzamos ágak áramai összeadódnak (Kirchhoff csomóponti törvénye)

**Kidolgozott példa**

Egy 16 A-es konyhai aljzatkörön egyszerre megy egy 2000 W-os vízforraló, egy 1200 W-os mikró és egy 800 W-os kávéfőző. Elég-e a kör?

1. Áramok: 2000/230 ≈ 8,7 A; 1200/230 ≈ 5,2 A; 800/230 ≈ 3,5 A.
2. Párhuzamosan kötve összeadódnak: 8,7 + 5,2 + 3,5 = 17,4 A.

→ 17,4 A több, mint 16 A: a kismegszakító egy idő után kiold. A konyhában ezért több aljzatkör kell (lásd a 2. szint áramkör-kiosztását).

**Gyakorló feladatok**

1. Két 100 Ω-os ellenállás sorosan, majd párhuzamosan. Mekkora az eredő?
   <details><summary>Megoldás</summary>Sorosan 200 Ω, párhuzamosan 50 Ω.</details>
2. Miért nem kötjük a lámpákat sorba egy helyiségben?
   <details><summary>Megoldás</summary>Mert akkor egy kiégett lámpa az egész sort lekapcsolná, és a feszültség megoszlana közöttük: egyik sem kapná a 230 V-ot.</details>
3. Egy csomópontba 10 A folyik be, egyik kimenő ágon 4 A megy ki. Mennyi a másikon?
   <details><summary>Megoldás</summary>6 A (Kirchhoff csomóponti törvénye).</details>

**Biztonság**

- A párhuzamos fogyasztók árama összeadódik: hosszabbítóra, elosztóra nem szabad a névleges áramánál többet kötni.

*Kapcsolódó kártyák:* Kapcsolt aljzat (a dugaszolós lámpák köre)

<a id="k04-valtakozo-aram"></a>

### 4. Váltakozó áram, fázis, nulla, védővezető

*Előtte:* 2. Teljesítmény, energia, melegedés

**Célok**

- Megérteni, mit jelent az 50 Hz és a 230 V effektív érték.
- Tudni a fázisvezető, a nullavezető és a védővezető szerepét.
- Megérteni, miért nem „biztonságos” a nullavezető.

A hálózati feszültség szinuszosan váltakozik, másodpercenként 50-szer (50 Hz, a periódusidő 20 ms). A 230 V az effektív érték: az az egyenfeszültség, amely ugyanannyi hőt termelne. A csúcsérték ennél nagyobb, kb. 325 V.

Fázisvezető (L): a feszültség alatt lévő vezető. Nullavezető (N): az áram visszavezetője; a szolgáltatónál földelt, ezért normál esetben közel földpotenciálon van. Védővezető (PE, zöld-sárga): normál üzemben nem visz áramot; a fém készüléktesteket köti a földhöz, hogy hiba esetén a védelem lekapcsoljon.

A nullavezető nem érinthető veszélytelenül: megszakadt nulla esetén a fogyasztón át a fázisfeszültség jelenhet meg rajta, és terhelt körben is lehet rajta feszültség. Mindig feszültség alatt lévőnek kell tekinteni.

Induktív (motor, régi előtét) és kapacitív (LED-tápegység) fogyasztóknál az áram és a feszültség nincs fázisban: a hasznos teljesítmény ilyenkor P = U · I · cos φ.

**Képletek**

- `Ucsúcs = U · √2` — csúcsérték: 230 × 1,414 ≈ 325 V
- `T = 1 / f` — periódusidő: 1 / 50 Hz = 20 ms
- `P = U · I · cos φ` — hasznos (hatásos) teljesítmény váltakozó áramnál

**Kidolgozott példa**

Egy motor 230 V-on 5 A-t vesz fel, a teljesítménytényezője cos φ = 0,8. Mekkora a hasznos teljesítménye?

1. P = 230 × 5 × 0,8 = 920 W.

→ 920 W hasznos teljesítmény, pedig a vezetéken 5 A folyik (ami ohmos fogyasztónál 1150 W lenne): a vezetéket az áramra kell méretezni, nem a wattra.

**Gyakorló feladatok**

1. Mekkora a 400 V-os vonali feszültség csúcsértéke?
   <details><summary>Megoldás</summary>400 × 1,414 ≈ 566 V.</details>
2. Milyen színű a védővezető, és visz-e áramot normál üzemben?
   <details><summary>Megoldás</summary>Zöld-sárga; normál üzemben nem visz áramot.</details>
3. Szabad-e a nullavezetőt kapcsolni a lámpa helyett a fázis helyett?
   <details><summary>Megoldás</summary>Nem: akkor kikapcsolt állapotban is fázis lenne a lámpafoglalaton (lásd a 10. leckét).</details>

**Biztonság**

- A nullavezetőt is feszültség alatt lévőnek kell tekinteni.
- A zöld-sárga vezetőt kizárólag védővezetőként szabad használni.

*Kapcsolódó kártyák:* Hálózati 50 Hz, MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések

<a id="k05-haromfazis"></a>

### 5. A háromfázisú rendszer

*Előtte:* 4. Váltakozó áram, fázis, nulla, védővezető

**Célok**

- Megérteni, honnan jön a 230 V és a 400 V.
- Kiszámolni egy háromfázisú fogyasztó áramát.
- Megismerni a vezetők színjelölését.

A közcélú hálózat háromfázisú: három fázisvezető (L1, L2, L3), mindegyiken 230 V a nullához képest, egymáshoz képest egy periódus harmadával (120°-kal) eltolva. Két fázis között ezért nem 460 V, hanem 400 V van.

A lakások egy része egyfázisú (egy fázis és nulla), nagyobb fogyasztóknál (főzőlap, hőszivattyú, autótöltő, műhely) háromfázisú a bekötés.

Ha a három fázis egyformán terhelt (szimmetrikus terhelés), a nullavezetőn nem folyik áram; aszimmetrikus terhelésnél a különbség folyik rajta. Ezért kell a lakás köreit a fázisok között elosztani.

Színjelölés: fázisvezetők barna, fekete, szürke; nullavezető kék; védővezető zöld-sárga.

**Képletek**

- `Uv = Uf · √3` — vonali feszültség = fázisfeszültség × 1,732: 230 × 1,732 ≈ 400 V
- `P = √3 · Uv · I · cos φ` — háromfázisú teljesítmény

**Kidolgozott példa**

Mekkora teljesítményt tud egy 3 × 16 A-es háromfázisú bekötés (ohmos terhelésnél)? És mekkora áramot vesz fel fázisonként egy 11 kW-os autótöltő?

1. P = 1,732 × 400 × 16 ≈ 11 085 W ≈ 11 kW.
2. Fordítva: I = 11 000 / (1,732 × 400) ≈ 15,9 A fázisonként.

→ A 3 × 16 A kb. 11 kW-ot ad: egy 11 kW-os töltő egyedül kihasználja a bekötést.

**Gyakorló feladatok**

1. Mekkora feszültség van két fázisvezető között?
   <details><summary>Megoldás</summary>Kb. 400 V.</details>
2. Egy háromfázisú 7,5 kW-os hőszivattyú (cos φ ≈ 0,9) mekkora áramot vesz fel?
   <details><summary>Megoldás</summary>I = 7500 / (1,732 × 400 × 0,9) ≈ 12 A fázisonként.</details>
3. Miért kell a lakás áramköreit a fázisok között elosztani?
   <details><summary>Megoldás</summary>Hogy a fázisok terhelése közel egyforma legyen: így kisebb a nulla árama és nem terhelődik túl egy fázis.</details>

**Biztonság**

- Háromfázisú körben két fázis között 400 V van: az áramütés még veszélyesebb.
- Fázissorrend: motoroknál a forgásirányt határozza meg.

*Kapcsolódó kártyák:* Hálózati 50 Hz, Csillár

<a id="k06-aramutes-biztonsag"></a>

### 6. Áramütés és az öt biztonsági szabály

*Előtte:* 4. Váltakozó áram, fázis, nulla, védővezető

**Célok**

- Megérteni, mitől veszélyes az áramütés.
- Megtanulni a feszültségmentesítés öt lépését, sorrendben.
- Megérteni, miért 30 mA az áram-védőkapcsoló érzékenysége.

Az áramütés veszélyét a testen átfolyó áram adja, nem a feszültség maga: nagysága, útja (kéz–kéz, kéz–láb a szíven át) és ideje. Már néhány tíz milliamper néhány tized másodperc alatt szívkamraremegést okozhat.

Tájékoztató értékek (váltakozó áram, kéz–láb út): kb. 0,5 mA érezhető; kb. 10 mA felett a kéz már nem tudja elengedni a vezetőt; néhány tíz mA felett, rövid idő alatt életveszély. Ezért old ki az áram-védőkapcsoló 30 mA-nél, gyorsan.

Az emberi test ellenállása (kéz–kéz) nagyjából 1000–2000 Ω, nedves bőrrel kevesebb: 230 V-on ez 100–200 mA, ami halálos lehet.

Az öt biztonsági szabály (MSZ EN 50110-1), ebben a sorrendben: 1. leválasztás minden pólusán; 2. biztosítás visszakapcsolás ellen (lezárás, tábla); 3. a feszültségmentesség megállapítása kétpólusú feszültségvizsgálóval; 4. földelés és rövidrezárás, ahol szükséges; 5. a szomszédos, feszültség alatt maradó részek letakarása vagy elkerítése.

**Képletek**

- `I = U / Rtest` — a testen átfolyó áram: 230 V / 1000 Ω ≈ 0,23 A = 230 mA

**Kidolgozott példa**

Valaki egy lámpát cserél; a falikapcsoló ki van kapcsolva. Biztonságos-e?

1. A falikapcsoló csak egy pólust szakít meg; ha rosszul kötötték (a nullát kapcsolja), a foglalaton fázis van.
2. Az öt szabály szerint: kismegszakító le (leválasztás), lezárni vagy táblát kitenni, kétpólusú feszültségvizsgálóval ellenőrizni a foglalatot.

→ A kikapcsolt falikapcsoló nem feszültségmentesítés. A biztos állapot: kismegszakító lekapcsolva, biztosítva, mérve.

**Gyakorló feladatok**

1. Mi a harmadik biztonsági szabály, és mivel végezzük?
   <details><summary>Megoldás</summary>A feszültségmentesség megállapítása, kétpólusú feszültségvizsgálóval (nem fázisceruzával).</details>
2. Miért 30 mA az áram-védőkapcsoló érzékenysége a személyvédelemben?
   <details><summary>Megoldás</summary>Mert e fölött, rövid idő alatt, már életveszélyes szívritmuszavar léphet fel; a 30 mA-es készülék ennél előbb lekapcsol.</details>
3. Mitől függ az áramütés veszélye?
   <details><summary>Megoldás</summary>Az áram nagyságától, útjától a testen át és az idejétől.</details>

**Biztonság**

- Feszültség alatti munkát csak erre kiképzett és felhatalmazott személy végezhet, külön előírások szerint.
- Áramütés után orvosi vizsgálat kell akkor is, ha a sérült jól érzi magát.

*Kapcsolódó kártyák:* MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, Vezeték- és vaskereső

<a id="k07-muszerek"></a>

### 7. Szerszámok és mérőműszerek

*Előtte:* 6. Áramütés és az öt biztonsági szabály

**Célok**

- Kiválasztani a megfelelő műszert a feszültség, az áram és az ellenállás méréséhez.
- Megérteni, miért nem megbízható a fázisceruza.
- Ismerni a mérési kategóriákat (CAT II–IV).

Kétpólusú feszültségvizsgáló: a feszültségmentesség megállapításának eszköze. Mindkét pontot érinteni kell vele (pl. fázis–nulla, fázis–PE, nulla–PE), és használat előtt és után egy ismert feszültségen ellenőrizni.

Fázisceruza (csavarhúzós): a test ellenállásán át jelez, a cipőtől, a padlótól és a fénytől függően; nem jelez megbízhatóan, ezért feszültségmentesség megállapítására nem való.

Multiméter: feszültség (párhuzamosan a mérendő ponttal), ellenállás és folytonosság (csak feszültségmentes körben!), áram (sorba kötve, a ritkábban használt bemenettel). Lakatfogóval az áram a vezeték körülfogásával, bontás nélkül mérhető (egy eret kell körülfogni).

Mérési kategória: a műszer a jelölt kategóriájú helyen használható. CAT II: aljzatba dugott készülékek; CAT III: épületen belüli szerelés, elosztó; CAT IV: a betáplálás, a mérőhely és a földkábel oldala. A feszültség mellett a kategória is számít.

**Kidolgozott példa**

Egy aljzat „nem megy”. Hogyan mérjük meg biztonságosan, és mit jelentenek az eredmények?

1. Kétpólusú vizsgálóval: L–N, L–PE és N–PE.
2. L–N 230 V és L–PE 230 V: az aljzat rendben, a hiba a készülékben.
3. L–N 0 V, de L–PE 230 V: a nulla szakadt meg (a doboznál vagy feljebb).
4. Mindenhol 0 V: a kör ki van kapcsolva vagy a fázis szakadt meg: az elosztóban kell kezdeni.

→ Három méréssel eldönthető, melyik vezető hiányzik; a javítás az öt biztonsági szabály szerint, feszültségmentesen.

**Gyakorló feladatok**

1. Mivel állapítjuk meg a feszültségmentességet?
   <details><summary>Megoldás</summary>Kétpólusú feszültségvizsgálóval, amelyet használat előtt és után ellenőrzünk.</details>
2. Szabad-e ellenállást mérni egy feszültség alatt lévő körben?
   <details><summary>Megoldás</summary>Nem: a műszer tönkremehet és az eredmény hamis; ellenállást és folytonosságot csak feszültségmentesen.</details>
3. Milyen kategóriájú műszer kell a mérőhelyen való méréshez?
   <details><summary>Megoldás</summary>CAT IV.</details>

**Biztonság**

- A multiméter mérőzsinórja és bemenete is a kategóriának megfelelő legyen.
- Árammérő állásban hagyott műszerrel feszültséget mérni zárlatot okoz.

*Kapcsolódó kártyák:* Vezeték- és vaskereső, Fúrókalapács és ütvefúró

<a id="k08-vezetekek"></a>

### 8. Vezetékek és kábelek

*Előtte:* 2. Teljesítmény, energia, melegedés

**Célok**

- Felismerni a lakásban használt vezeték- és kábeltípusokat a jelölésükről.
- Tudni, milyen keresztmetszet jellemző a világításhoz és az aljzatokhoz.
- Megérteni a tömör és a sodrott ér különbségét.

Vezeték: egy vagy több szigetelt ér; kábel: több ér közös köpenyben, nagyobb mechanikai védelemmel. A köznyelv a kettőt keveri.

A harmonizált jelölés egy példán, H07V-U: H = harmonizált; 07 = 450/750 V névleges feszültség; V = PVC szigetelés; U = tömör, kör keresztmetszetű ér (R = tömör sodrott, K = hajlékony, finoman sodrott). A régi magyar nevek (MCu, MKH, MBCu) ma is élnek a nagykereskedésekben.

NYM-J: PVC köpenyes installációs kábel, a J azt jelenti, hogy van benne zöld-sárga védővezető. NYY-J: erőátviteli kábel, földbe és kültérre is. A darabszám × keresztmetszet: pl. 3 × 1,5 = három 1,5 mm²-es ér.

Jellemző lakossági gyakorlat: világításhoz 1,5 mm², aljzatkörökhöz 2,5 mm², nagyobb fogyasztóhoz (főzőlap, bojler) a terhelés szerint. A pontos választás a terheléstől, a szerelési módtól, a hossztól és a védelemtől függ (méretezés: 2. szint).

Tömör ér: falba, védőcsőbe, csavaros kötésbe. Sodrott (hajlékony) ér: mozgó részekhez, elosztóba; csavaros kötésbe érvéghüvellyel.

**Kidolgozott példa**

Mit jelent: NYM-J 5 × 1,5 mm²? Mire jó?

1. NYM: PVC köpenyes installációs kábel; J: van benne zöld-sárga védővezető.
2. 5 ér: pl. három fázis (vagy két kapcsolt fázis), nulla és védővezető, egyenként 1,5 mm².

→ Csillárkapcsolós lámpához, két kapcsolt körhöz, DALI-hoz (két ér a vezérlésnek) vagy egy háromfázisú kisebb fogyasztóhoz jó.

**Gyakorló feladatok**

1. Mit jelent a K betű a H07V-K jelölésben?
   <details><summary>Megoldás</summary>Hajlékony, finoman sodrott ér.</details>
2. Mi a különbség az NYM-J és az NYY-J között?
   <details><summary>Megoldás</summary>Az NYM-J beltéri installációs kábel, az NYY-J erőátviteli kábel, földbe és kültérre is fektethető.</details>
3. Szabad-e alumíniumvezetéket rézzel közvetlenül összecsavarni?
   <details><summary>Megoldás</summary>Nem: a két fém közti korrózió és az alumínium folyása miatt a kötés meglazul és melegszik; erre minősített kötőelem kell.</details>

**Biztonság**

- Csak a köpeny és a szigetelés sértetlen kábelt szabad beépíteni.
- Régi lakásokban alumíniumvezeték lehet: kezelése külön figyelmet kér.

*Kapcsolódó kártyák:* Hálózati 50 Hz, Páramentes lámpatest

<a id="k09-kotestechnika"></a>

### 9. Kötéstechnika

*Előtte:* 8. Vezetékek és kábelek

**Célok**

- Kiválasztani a megfelelő kötőelemet a vezetékhez.
- Jó minőségű, tartós kötést készíteni.
- Felismerni a hibás kötést.

A kötés a villanyszerelés leggyakoribb hibahelye: a rossz kötés melegszik (lásd a 2. leckét), és tüzet okozhat. A jó kötés kis átmeneti ellenállású, mechanikailag tartós, és ellenőrizhető.

Rugós (karos vagy dugaszolós) kötőelem: gyors, egyenletes szorítóerő; a gyártó megadja, milyen ért (tömör, sodrott) és milyen keresztmetszetet fogad. A csupaszítási hosszt a kötőelemen jelzett érték szerint kell tartani.

Csavaros sorkapocs: a gyártói meghúzási nyomatékkal kell meghúzni, a túl laza és a túl szoros (az eret elnyíró) kötés is hibás. Sodrott ért érvéghüvellyel kell bekötni.

Sodrott eret ónnal bemártva csavaros kötésbe kötni nem szabad: az ón idővel „folyik”, a kötés meglazul.

Kötni csak dobozban (kötődoboz, szerelvénydoboz), hozzáférhető helyen lehet; vakolat alá rejtett kötés tilos.

**Kidolgozott példa**

Egy doboz kötéseit kell elkészíteni: 2 × NYM-J 3 × 1,5 (tömör) és egy lámpa sodrott vezetéke találkozik. Mit használjunk?

1. A három fázisér, a három nullaér és a három védővezető egy-egy háromvezetékes rugós kötőelembe kerül, ha az a tömör és a sodrott eret is fogadja.
2. A csupaszítás a kötőelem jelölése szerint; a szigetelés a kötőelem pereméig érjen.
3. A védővezetőket mindig kötni kell, akkor is, ha a lámpa II. osztályú (a továbbmenő kör miatt).

→ Háromszor három ér, három rugós kötőelem, egyenként ellenőrizve (meghúzással), a dobozban rendezetten.

**Gyakorló feladatok**

1. Mi a teendő sodrott érrel csavaros kötés előtt?
   <details><summary>Megoldás</summary>Érvéghüvelyt kell rápréselni.</details>
2. Miért hibás a túl hosszú csupaszítás?
   <details><summary>Megoldás</summary>Mert a kötőelemen kívül csupasz rész marad, ami érintésveszélyes és zárlatot okozhat.</details>
3. Hol szabad kötést készíteni?
   <details><summary>Megoldás</summary>Csak hozzáférhető dobozban; vakolat alatt vagy dobozon kívül nem.</details>

**Biztonság**

- A kötések elkészülte után minden eret meghúzással ellenőrizni kell.
- Elszíneződött, olvadt kötést nem javítani, hanem kicserélni kell, a sérült érvéget levágva.

*Kapcsolódó kártyák:* Gipszkarton, Hálózati 50 Hz

<a id="k10-elso-aramkorok"></a>

### 10. Az első áramkörök: kapcsolások

*Előtte:* 4. Váltakozó áram, fázis, nulla, védővezető, 9. Kötéstechnika

**Célok**

- Bekötni egy lámpát egy kapcsolóval.
- Megérteni a csillár-, a váltó- és a keresztkapcsolást.
- Tudni, mikor jobb az impulzusrelé.

Egypólusú kapcsolás: a kapcsoló a fázisvezetőt szakítja meg, a nulla közvetlenül a lámpára megy. Ha a nullát kapcsolnánk, kikapcsolt lámpánál is feszültség lenne a foglalaton.

Csillárkapcsolás: két kapcsolóbetét egy kereten, két külön kapcsolt fázis (két lámpacsoport), közös nulla. A lámpához két kapcsolt fázisér, a nulla és a védővezető megy (pl. NYM-J 4 × 1,5); a kapcsolóhoz a betápláló fázis és a két kapcsolt fázis.

Váltókapcsolás: két helyről kapcsolható lámpa (folyosó, lépcső). Két váltókapcsoló; köztük két „összekötő” ér fut. Az egyik kapcsoló közös pontjára jön a fázis, a másik közös pontjáról megy a kapcsolt fázis a lámpára.

Keresztkapcsolás: három vagy több helyről. A két szélső váltókapcsoló közé, az összekötő erekbe kerül egy vagy több keresztkapcsoló.

Impulzusrelé (lépcsőházi automatika vagy impulzuskapcsoló): sok helyről nyomógombokkal, párhuzamosan kötve. Egyszerűbb vezetékezés, időzítés is lehet; a relé az elosztóban vagy dobozban.

**Kidolgozott példa**

Egy folyosót két végéről kell kapcsolni. Milyen vezetékek kellenek a kapcsolók és a lámpa között?

1. Betáplálás a lámpadobozba: fázis, nulla, védővezető.
2. Az 1. kapcsolóhoz: a fázis (oda) és két összekötő ér a 2. kapcsoló felé.
3. A 2. kapcsolótól: a kapcsolt fázis vissza a lámpához.
4. A nulla és a védővezető a lámpadobozból közvetlenül a lámpára.

→ A két kapcsoló között háromerű kapcsolt vezeték helyett két összekötő ér fut; a lámpánál a kapcsolt fázis, a nulla és a védővezető találkozik.

**Gyakorló feladatok**

1. Melyik vezetőt kapcsolja az egypólusú kapcsoló?
   <details><summary>Megoldás</summary>A fázisvezetőt.</details>
2. Hány helyről kapcsolható egy lámpa két váltó- és két keresztkapcsolóval?
   <details><summary>Megoldás</summary>Négy helyről.</details>
3. Mikor jobb impulzusrelé a keresztkapcsolásnál?
   <details><summary>Megoldás</summary>Sok kapcsolóhelynél (pl. lépcsőház): a nyomógombok párhuzamosan köthetők, a vezetékezés egyszerűbb, és időzítés is adható.</details>

**Biztonság**

- Minden szerelés feszültségmentesen, az öt biztonsági szabály szerint.
- Bekapcsolás előtt ellenőrizni: nincs zárlat, a védővezető bekötve, és a kapcsoló a fázist kapcsolja.

*Kapcsolódó kártyák:* Mennyezeti lámpa (plafonlámpa), Csillár, Kapcsolt aljzat (a dugaszolós lámpák köre), MSZ EN 60669 és MSZ HD 60884 · Kapcsolók és dugaszolóaljzatok, KNX TP
