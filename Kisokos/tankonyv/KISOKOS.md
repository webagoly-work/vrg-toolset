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
- `R = ρ · l / A` — vezeték ellenállása: fajlagos ellenállás × hossz (m) / keresztmetszet (mm²); rézre ρ ≈ 0,0178 Ω·mm²/m (a régi 1/56 tankönyvi érték; 20 °C-on 0,0172, üzemi 70 °C-on kb. 0,021)

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

Tájékoztató értékek (váltakozó áram, kéz–láb út): kb. 0,5 mA érezhető; néhány mA-től (átlagosan kb. 10 mA-nél) sokan már nem tudják elengedni a vezetőt, a határ személyenként és az érintkezési felülettől függ; néhány tíz mA felett, rövid idő alatt életveszély. Ezért old ki az áram-védőkapcsoló 30 mA-nél, gyorsan.

Az emberi test ellenállása (kéz–kéz) nagyjából 1000–2000 Ω (a feszültségtől és az érintkezési felülettől is függ), nedves bőrrel kevesebb: 230 V-on ez százas nagyságrendű mA (kb. 115–230 mA), ami halálos lehet.

Az öt biztonsági szabály (MSZ EN 50110-1:2023), ebben a sorrendben: 1. leválasztás minden pólusán; 2. biztosítás visszakapcsolás ellen (lezárás, tábla); 3. a feszültségmentesség megállapítása kétpólusú feszültségvizsgálóval; 4. földelés és rövidrezárás, ahol szükséges; 5. a szomszédos, feszültség alatt maradó részek letakarása vagy elkerítése.

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

A harmonizált jelölés egy példán, H07V-U: H = harmonizált; 07 = 450/750 V névleges feszültség; V = PVC szigetelés; U = tömör, kör keresztmetszetű ér (R = sodrott, merev, kör keresztmetszetű; K = finoman sodrott, hajlékony, fix szereléshez). A régi magyar nevek (MCu, MKH, MBCu) ma is élnek a nagykereskedésekben.

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

Sodrott eret ónnal bemártva csavaros kötésbe kötni nem ajánlott, kerülendő: az ón idővel „folyik”, a kötés meglazul.

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

## 2. szint: Szakmunkás

- [1. Hálózati rendszerek: TN-C, TN-S, TN-C-S, TT, IT](#s01-halozati-rendszerek)
- [2. Érintésvédelem: alap-, hiba- és kiegészítő védelem](#s02-erintesvedelem)
- [3. Túláramvédelem: kismegszakító és biztosító](#s03-tularamvedelem)
- [4. Keresztmetszet és feszültségesés](#s04-keresztmetszet)
- [5. A lakáselosztó](#s05-lakaseloszto)
- [6. Áramkörök kiosztása egy lakásban](#s06-aramkor-kiosztas)
- [7. Mérőhely és betáplálás](#s07-merohely)
- [8. Földelés és egyenpotenciálú összekötés](#s08-foldeles-eph)
- [9. Különleges helyiségek a gyakorlatban](#s09-kulonleges-helyisegek)
- [10. Ellenőrző mérések és a jegyzőkönyv](#s10-ellenorzo-meresek)
- [11. Kábelek a gyakorlatban](#s11-kabelek)
- [12. Villám- és túlfeszültség-védelem](#s12-tulfeszultseg-villamvedelem)
- [13. Motorok és transzformátor](#s13-motorok-transzformator)
- [14. Épületautomatizálás alapjai](#s14-epuletautomatizalas)
- [15. Napelemes rendszer telepítői szemmel](#s15-napelemes-rendszer)

<a id="s01-halozati-rendszerek"></a>

### 1. Hálózati rendszerek: TN-C, TN-S, TN-C-S, TT, IT

*Előtte:* 4. Váltakozó áram, fázis, nulla, védővezető, 5. A háromfázisú rendszer

**Célok**

- Kiolvasni a hálózati rendszer betűjeléséből, hogyan van földelve a táppont és a fogyasztó.
- Megtalálni egy épületben, hol válik szét a PEN vezető N-re és PE-re.
- Megérteni, miért veszélyes a régi lakások „nullázása”.

Az első betű a táppont (transzformátor) kapcsolata a földdel: T = közvetlenül földelt, I = a földtől elszigetelt vagy nagy impedancián át földelt. A második betű a fogyasztói fém testeké: T = helyben földelt (saját földelő), N = védővezetőn át a táppont földelt pontjára kötött.

TN-C: a nulla- és a védővezető egy közös vezető (PEN) a teljes hálózatban. TN-S: a nulla (N) és a védővezető (PE) végig külön fut. TN-C-S: a hálózat egy részén közös (PEN), egy ponton szétválik, és onnan külön fut. Magyarországon a közcélú kisfeszültségű hálózat jellemzően PEN-nel jut el az épületig, és a fogyasztói berendezés TN-C-S: a PEN a mérőhelynél vagy a főelosztóban válik szét.

A szétválasztás után az N és a PE nem köthető össze újra. Ha összekötnénk, az üzemi áram egy része a védővezetőn és a fémszerkezeteken folyna vissza, és az áram-védőkapcsoló kioldana.

TT: a fogyasztónak saját földelője van, a fém testek ehhez kapcsolódnak. A hibaáram a földön át jut vissza, ezért kicsi lehet; ilyenkor a lekapcsolást áram-védőkapcsoló végzi. IT: a táppont nincs (közvetlenül) földelve; egy első testzárlat nem okoz lekapcsolást, ezért ott használják, ahol a folyamatos táplálás fontos (orvosi helyiségek csoport 2, ipar), szigetelésfigyelővel.

Régi lakásokban gyakori a „nullázás”: kétvezetékes hálózat, ahol az aljzat védőérintkezőjét a nullavezetőhöz kötötték (TN-C a lakásban). Ha a PEN megszakad, a fogyasztón keresztül a fázisfeszültség megjelenik minden így bekötött készülék házán. Felújításnál ezt meg kell szüntetni.

**Képletek**

- `RA · IΔn ≤ 50 V` — TT rendszerben az érintési feszültség feltétele: földelési ellenállás (Ω) × az áram-védőkapcsoló kioldóárama (A)

**Kidolgozott példa**

Egy TT rendszerű kerti házban 30 mA-es áram-védőkapcsoló védi a köröket. Legfeljebb mekkora lehet a földelési ellenállás a feltétel szerint?

1. RA ≤ 50 V / 0,03 A.
2. RA ≤ 1667 Ω.

→ A feltétel kb. 1667 Ω-ig teljesül, vagyis az áram-védőkapcsoló gyenge földelés mellett is véd. A gyakorlatban ennél jóval kisebb, stabil földelési ellenállásra kell törekedni, mert a talaj kiszárad vagy átfagy, és a túlfeszültség-védelemnek is jó földelés kell.

**Gyakorló feladatok**

1. Mit jelent a TN-C-S, és hol van a „C” és az „S” rész egy családi házban?
   <details><summary>Megoldás</summary>A hálózat egy részén közös a nulla- és védővezető (PEN, C), majd egy ponton szétválik (S). A közcélú hálózat és a csatlakozás a PEN-es rész; a mérőhelytől vagy a főelosztótól a ház belső hálózata külön N és PE.</details>
2. Miért nem szabad a szétválasztás után az N-t és a PE-t újra összekötni?
   <details><summary>Megoldás</summary>Mert az üzemi áram egy része a védővezetőn és a fémszerkezeteken folyna, a fémrészek feszültség alá kerülhetnek, és az áram-védőkapcsoló kioldana.</details>
3. Mi a veszélye a régi „nullázott” aljzatnak?
   <details><summary>Megoldás</summary>Ha a PEN megszakad, a fogyasztón át a fázisfeszültség megjelenik a nullázott készülékházakon.</details>

**Biztonság**

- Régi lakásban nem szabad feltételezni, hogy van védővezető: mérni kell.
- A PEN vezetőt soha nem szabad megszakítani vagy kapcsolni.

*Kapcsolódó kártyák:* Hálózati 50 Hz, MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, MSZ HD 60364-7-710 · Orvosi helyiségek

<a id="s02-erintesvedelem"></a>

### 2. Érintésvédelem: alap-, hiba- és kiegészítő védelem

*Előtte:* 1. Hálózati rendszerek: TN-C, TN-S, TN-C-S, TT, IT, 6. Áramütés és az öt biztonsági szabály

**Célok**

- Megkülönböztetni az alapvédelmet, a hibavédelmet és a kiegészítő védelmet.
- Kiszámolni, legfeljebb mekkora hurokimpedancia mellett kapcsol le időben egy kismegszakító.
- Kiválasztani az áram-védőkapcsoló típusát (AC, A, F, B) a fogyasztóhoz.

Alapvédelem: megakadályozza, hogy normál üzemben feszültség alatti részt érinthessünk (szigetelés, burkolat, elhelyezés). Hibavédelem: ha az alapvédelem meghibásodik (testzárlat), az érintés ne legyen veszélyes. Kiegészítő védelem: további biztonság arra az esetre, ha mindkettő elégtelen vagy a felhasználó gondatlan (30 mA-es áram-védőkapcsoló, kiegészítő egyenpotenciálú összekötés).

A hibavédelem leggyakoribb módja az önműködő lekapcsolás: testzárlatkor a hibaáram a védővezetőn folyik vissza, és a túláramvédelem vagy az áram-védőkapcsoló adott időn belül lekapcsol. Ehhez a hibahurok impedanciájának elég kicsinek kell lennie, hogy a hibaáram elég nagy legyen.

Lekapcsolási idők (tájékoztató, 230 V / 400 V hálózat, MSZ HD 60364-4-41): TN rendszerben 0,4 s, TT rendszerben 0,2 s. Ez a legfeljebb 63 A-es, aljzatot tartalmazó végáramkörökre és a legfeljebb 32 A-es, csak fixen bekötött készüléket tápláló végáramkörökre vonatkozik; elosztó áramkörökben TN-ben legfeljebb 5 s, TT-ben legfeljebb 1 s. TT rendszerben, ha túláramvédelem old le és minden idegen vezetőképes rész be van kötve az egyenpotenciálú összekötésbe, a TN idők is használhatók.

További hibavédelmi módok: kettős vagy megerősített szigetelés (II. érintésvédelmi osztály, ezért nincs védővezető-csatlakozása), törpefeszültség (SELV, PELV), villamos elválasztás (leválasztó transzformátor).

Az áram-védőkapcsoló típusa azt mondja meg, milyen alakú hibaáramot érzékel: AC: csak szinuszos (ma lakásba már kevés); A: szinuszos és lüktető egyen (a legtöbb elektronikus készülékhez); F: mint az A, plusz a frekvenciaváltós egyfázisú gépek vegyes frekvenciás hibaárama (inverteres mosógép, hőszivattyú); B: sima egyenáramú hibaáramot is (háromfázisú inverterek, autótöltő, ha a töltő maga nem tartalmaz egyenáram-érzékelést).

**Képletek**

- `Zs · Ia ≤ U0` — TN rendszer: hurokimpedancia (Ω) × a védelem előírt időn belüli kioldóárama (A) ≤ fázisfeszültség (230 V)
- `Ia (B) ≈ 5 · In · Ia (C) ≈ 10 · In` — a kismegszakító azonnali kioldásának felső határa B és C karakterisztikánál

**Kidolgozott példa**

Egy aljzatkört B16-os kismegszakító véd TN-C-S rendszerben. Legfeljebb mekkora lehet a hurokimpedancia, hogy testzárlatkor 0,4 s-on belül lekapcsoljon?

1. B karakterisztikánál az azonnali kioldás biztosan bekövetkezik 5 × In-nél: Ia = 5 × 16 = 80 A.
2. Zs ≤ U0 / Ia = 230 / 80 ≈ 2,9 Ω.

→ A hurokimpedancia legfeljebb kb. 2,9 Ω lehet (a mért értéket a vezeték melegedése miatt tartalékkal kell értékelni). Ha a mért érték nagyobb, a kismegszakító nem kapcsol le időben: rövidebb vagy vastagabb vezeték kell, vagy áram-védőkapcsoló.

**Gyakorló feladatok**

1. Mekkora a megengedett hurokimpedancia C16-os kismegszakítónál ugyanebben a körben?
   <details><summary>Megoldás</summary>Ia = 10 × 16 = 160 A, Zs ≤ 230 / 160 ≈ 1,44 Ω.</details>
2. Miért nincs védővezető-csatlakozása egy II. osztályú készüléknek?
   <details><summary>Megoldás</summary>Mert a hibavédelmet a kettős vagy megerősített szigetelése adja, nem a lekapcsolás.</details>
3. Milyen típusú áram-védőkapcsoló való egy inverteres hőszivattyú egyfázisú köréhez?
   <details><summary>Megoldás</summary>Legalább F típusú (vagy a gyártó előírása szerint B).</details>

**Biztonság**

- Az áram-védőkapcsolót a próbagombjával rendszeresen ki kell próbálni; a próbagomb csak a mechanikát ellenőrzi, a kioldási időt és áramot mérni kell.
- Az áram-védőkapcsoló nem véd a fázis–nulla közötti áramütés ellen, ha nem folyik áram a föld felé.

*Kapcsolódó kártyák:* MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, MSZ HD 60364-7-701 · Fürdő- és zuhanyhelyiségek, MSZ EN 60669 és MSZ HD 60884 · Kapcsolók és dugaszolóaljzatok, Páramentes lámpatest

<a id="s03-tularamvedelem"></a>

### 3. Túláramvédelem: kismegszakító és biztosító

*Előtte:* 2. Teljesítmény, energia, melegedés, 8. Vezetékek és kábelek

**Célok**

- Megérteni a túlterhelés és a zárlat különbségét, és hogy melyik ellen mi véd.
- Kiválasztani a kismegszakító névleges áramát és karakterisztikáját.
- Megérteni a szelektivitás alapjait.

Túlterhelés: a kör tartósan több áramot visz, mint amire a vezeték méretezve van (sok fogyasztó). Zárlat: a fázis közvetlenül a nullával, a védővezetővel vagy egy másik fázissal érintkezik; az áram ezerszeres is lehet. Mindkettő a vezeték melegedését okozza, a zárlat egy pillanat alatt.

A kismegszakítóban két kioldó dolgozik: a hőkioldó (bimetall) a túlterhelésre lassan, a mágneses kioldó a zárlatra azonnal. A karakterisztika azt mondja meg, a névleges áram hányszorosánál old ki azonnal: B: 3–5 × In (lakás, világítás, aljzat), C: 5–10 × In (motorok, nagyobb bekapcsolási áramú fogyasztók), D: 10–20 × In (nagy indítóáramú gépek, transzformátorok).

A zárlati megszakítóképesség (pl. 6 kA vagy 10 kA) az a legnagyobb zárlati áram, amelyet a kismegszakító biztonságosan megszakít; a beépítés helyén várható zárlati áramnál nagyobbnak kell lennie.

A vezeték védelmének feltétele: a terhelés árama ≤ a védelem névleges árama ≤ a vezeték terhelhetősége (Ib ≤ In ≤ Iz). A vezeték terhelhetősége a keresztmetszettől és a szerelési módtól függ (4. lecke).

Szelektivitás: hiba esetén csak a hibához legközelebbi védelem kapcsoljon le, ne a főbiztosító. Ehhez a felsőbb szintű védelem nagyobb és lassabb legyen; a pontos összehangolás a gyártói táblázatokból jön (3. szint).

**Képletek**

- `Ib ≤ In ≤ Iz` — terhelőáram ≤ a kismegszakító névleges árama ≤ a vezeték terhelhetősége

**Kidolgozott példa**

Egy 2,5 mm²-es, falban védőcsőben futó aljzatkörre (terhelhetősége a szerelési módtól függően kb. 18–27 A; falban, védőcsőben kb. 23–24 A) milyen kismegszakító kerül, és miért B?

1. Ib: aljzatkörre jellemzően 16 A-es terhelést tervezünk.
2. In = 16 A: 16 ≤ Iz (kb. 23 A falban, védőcsőben), a feltétel teljesül.
3. Karakterisztika: az aljzatokra kötött háztartási készülékek bekapcsolási árama kicsi, a B old ki a legkisebb hibaáramnál, így a hurokimpedancia-feltétel (2. lecke) könnyebben teljesül.

→ B16. C16 csak indokolt esetben (nagy bekapcsolási áramú fogyasztó), mert annál kisebb hurokimpedancia kell az időben való lekapcsoláshoz.

**Gyakorló feladatok**

1. Mi ellen véd a kismegszakító hőkioldója, és mi ellen a mágneses?
   <details><summary>Megoldás</summary>A hőkioldó a túlterhelés ellen (késleltetve), a mágneses a zárlat ellen (azonnal).</details>
2. Miért nem szabad egy 1,5 mm²-es világítási kört B20-as kismegszakítóval védeni?
   <details><summary>Megoldás</summary>Mert a 20 A meghaladhatja az 1,5 mm²-es vezeték terhelhetőségét (In ≤ Iz nem teljesül): túlterheléskor a vezeték túlmelegedne, mielőtt a védelem lekapcsol.</details>
3. Mi a szelektivitás?
   <details><summary>Megoldás</summary>Az, hogy hiba esetén csak a hibához legközelebbi védelem kapcsoljon le, a felsőbb szintű (pl. főbiztosító) ne.</details>

**Biztonság**

- Kioldott kismegszakítót visszakapcsolni csak a kiváltó ok ismeretében szabad; ismételt kioldásnál a kört ki kell vizsgálni.
- Nagyobb kismegszakító beépítése a „gyakran old” panaszra tilos: a vezeték védtelenné válik.

*Kapcsolódó kártyák:* MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, Hálózati 50 Hz

<a id="s04-keresztmetszet"></a>

### 4. Keresztmetszet és feszültségesés

*Előtte:* 1. Feszültség, áram, ellenállás, 3. Túláramvédelem: kismegszakító és biztosító

**Célok**

- Megérteni, mitől függ egy vezeték terhelhetősége.
- Kiszámolni egy áramkör feszültségesését egy- és háromfázisú esetben.
- Eldönteni, mikor kell a következő keresztmetszetet választani.

A vezeték terhelhetősége (Iz) az a tartós áram, amelynél a szigetelés még nem melegszik túl. Függ a keresztmetszettől, az anyagtól, a szigeteléstől, és erősen a szerelési módtól: falban csőben, falon kívül, hőszigetelésben, kötegben, földben. Több, egymás mellett futó terhelt kör vagy magas környezeti hőmérséklet csökkenti (csökkentő tényezők).

Tájékoztató értékek (réz, PVC, 30 °C, két terhelt ér; DIN VDE 0298-4 / HD 60364-5-52): 1,5 mm² kb. 15,5–19,5 A, 2,5 mm² kb. 18,5–27 A a szerelési módtól függően; három terhelt érnél (háromfázisú kör) 1,5 mm² kb. 13–17,5 A, 2,5 mm² kb. 17,5–24 A. Mindig a szerelési móddal együtt add meg.

A feszültségesés a vezeték ellenállásán keletkezik (1. szint, 1. lecke). Ha túl nagy, a fogyasztó kevesebb feszültséget kap, a motorok nehezebben indulnak, a hosszú vezeték melegszik, és a hurokimpedancia is nő.

Tájékoztató határ közcélú hálózatról táplált berendezésben (MSZ HD 60364-5-52 tájékoztató melléklete): a betáplálási ponttól világításnál kb. 3 %, egyéb fogyasztóknál kb. 5 %. A teljes esést kell nézni: a fővezetéken és a végáramkörön együtt.

Ha a feszültségesés vagy a hurokimpedancia nem fér bele, a következő keresztmetszetet kell választani, vagy rövidíteni a vezetéket (pl. alelosztóval közelebb vinni a táplálást).

**Képletek**

- `ΔU = 2 · l · I · ρ / A` — egyfázisú kör feszültségesése (oda-vissza), ohmos közelítéssel; l a kör hossza (m)
- `ΔU = √3 · l · I · ρ / A` — háromfázisú kör vonali feszültségesése, ohmos közelítéssel
- `ε = ΔU / U · 100 %` — feszültségesés százalékban (egyfázisnál 230 V-hoz, háromfázisnál 400 V-hoz)

**Kidolgozott példa**

Egy 25 m-es, 2,5 mm²-es aljzatkör 16 A-rel terhelve, és egy 30 m-es, 6 mm²-es háromfázisú autótöltő-kör 32 A-rel. Mekkora a feszültségesés?

1. Aljzatkör: ΔU = 2 × 25 × 16 × 0,0178 / 2,5 ≈ 5,7 V; 5,7 / 230 ≈ 2,5 %.
2. Töltőkör: ΔU = 1,732 × 30 × 32 × 0,0178 / 6 ≈ 4,9 V; 4,9 / 400 ≈ 1,2 %.

→ Az aljzatkör 2,5 %-a egymagában rendben van, de a fővezeték esésével együtt a 5 %-ot kell tartani. A töltőkör 1,2 %-kal bőven belefér; a keresztmetszetet itt a terhelhetőség és a hurokimpedancia is meghatározza.

**Gyakorló feladatok**

1. Mekkora a feszültségesés egy 40 m-es, 1,5 mm²-es világítási körön 6 A-nél?
   <details><summary>Megoldás</summary>ΔU = 2 × 40 × 6 × 0,0178 / 1,5 ≈ 5,7 V ≈ 2,5 %.</details>
2. Miért csökken egy vezeték terhelhetősége hőszigetelésben?
   <details><summary>Megoldás</summary>Mert a hőszigetelés nem engedi elvezetni a vezeték hőjét, így kisebb áramnál éri el a szigetelés megengedett hőmérsékletét.</details>
3. Mi a teendő, ha egy hosszú kör feszültségesése túl nagy?
   <details><summary>Megoldás</summary>Nagyobb keresztmetszet, vagy rövidebb vezeték (pl. alelosztó a fogyasztók közelében).</details>

**Biztonság**

- A terhelhetőséget mindig a tényleges szerelési módra kell venni: a falon kívüli értéket nem szabad hőszigetelésben futó kábelre alkalmazni.

*Kapcsolódó kártyák:* MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, Hálózati 50 Hz, LED-szalag (12 / 24 V)

<a id="s05-lakaseloszto"></a>

### 5. A lakáselosztó

*Előtte:* 2. Érintésvédelem: alap-, hiba- és kiegészítő védelem, 3. Túláramvédelem: kismegszakító és biztosító, 4. Keresztmetszet és feszültségesés

**Célok**

- Megismerni a lakáselosztó elemeit és sorrendjüket.
- Áram-védőkapcsoló csoportokat tervezni úgy, hogy egy hiba ne sötétítse el az egész lakást.
- Rendezett, feliratozott, bővíthető elosztót építeni.

A tipikus sorrend a betáplálástól: főkapcsoló (leválasztó), túlfeszültség-levezető (2. típusú), áram-védőkapcsolók csoportonként, alattuk a csoport kismegszakítói. A nagy fogyasztók (főzőlap, bojler) és a túlfeszültség-levezető a csoportokon kívül is kaphat helyet a tervező döntése szerint.

Áram-védőkapcsoló csoportok: ha egyetlen áram-védőkapcsoló véd mindent, egy hibás készülék az egész lakást lekapcsolja. Jobb két-három csoport (pl. világítás és aljzatok külön ágon keverve, hogy egy kioldásnál maradjon fény), vagy körönként kombinált készülék (kismegszakító + áram-védőkapcsoló egyben).

Minden áram-védőkapcsoló csoportnak saját nullasínje van: egy kör nullája csak a saját csoportja áram-védőkapcsolóján át mehet. Ha két csoport nullája keveredik, az áram-védőkapcsolók kioldanak.

A PE-sín az összes védővezetőt fogadja, az N-sínektől külön (TN-C-S rendszerben a szétválasztás után).

Feliratozás és dokumentáció: minden készülék alatt a kör neve, az ajtón az áramköri tábla. Tartalékhely: legalább 20–30 % szabad modulhely a későbbi bővítésre (töltő, napelem, okos eszközök).

**Kidolgozott példa**

Tervezzünk egy egyfázisú, háromszobás lakás elosztóját.

1. Főkapcsoló 40 A, túlfeszültség-levezető (2. típus).
2. 1. csoport, 40 A / 30 mA A típus: világítás 1 (B10), aljzatok nappali és hálók (B16, B16), fürdő aljzat (B16).
3. 2. csoport, 40 A / 30 mA A típus: világítás 2 (B10), konyhai aljzatok (B16, B16), mosógép (B16, vagy F típusú csoport, ha inverteres).
4. Bojler és főzőlap a gyártói előírás szerinti saját körön és védelemmel.
5. Számolás: 2 csoport × (2 + 4 modul) + főkapcsoló és levezető + a nagy fogyasztók ≈ 20–24 modul; 30 % tartalékkal egy 2 × 18 vagy 3 × 12 modulos elosztó.

→ Két csoport úgy osztva, hogy bármelyik kioldásakor maradjon világítás és aljzat; a nullák csoportonként külön sínen; a tartalékkal a töltő vagy a napelem később elfér.

**Gyakorló feladatok**

1. Mi történik, ha az egyik csoport körének nulláját a másik csoport nullasínjére kötik?
   <details><summary>Megoldás</summary>Az áram-védőkapcsolók kioldanak, mert az egyiken befolyó áram a másikon jön vissza, és mindkettő különbségi áramot érzékel.</details>
2. Miért érdemes a világítási köröket két különböző áram-védőkapcsoló csoportra tenni?
   <details><summary>Megoldás</summary>Hogy egy hiba miatti kioldáskor ne legyen teljes sötétség a lakásban.</details>
3. Mennyi tartalékhelyet érdemes hagyni?
   <details><summary>Megoldás</summary>Legalább 20–30 % szabad modulhelyet.</details>

**Biztonság**

- Az elosztóban munka előtt a főkapcsolót le kell kapcsolni, de a főkapcsoló bemenő oldala feszültség alatt marad: azt letakarni vagy a mérőhely előtti leválasztást használni.
- A feliratozás nélküli elosztó veszélyes: a hibás kör nem azonosítható gyorsan.

*Kapcsolódó kártyák:* MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, MSZ EN 60669 és MSZ HD 60884 · Kapcsolók és dugaszolóaljzatok, MSZ HD 60364-7-701 · Fürdő- és zuhanyhelyiségek

<a id="s06-aramkor-kiosztas"></a>

### 6. Áramkörök kiosztása egy lakásban

*Előtte:* 5. A lakáselosztó

**Célok**

- Egy lakás fogyasztóit áramkörökre osztani úgy, hogy egy hiba ne bénítsa meg a lakást.
- Tudni, mely fogyasztók kapnak saját kört.
- A vezetékeket kiszámítható helyen, szerelési zónákban vezetni.

Alapelvek: a világítás és az aljzatok külön körön; egy helyiség világítása és aljzatai ne ugyanazon a körön legyenek (ha az aljzatkör kiold, maradjon fény); a köröket a fázisok és az áram-védőkapcsoló csoportok között egyenletesen kell elosztani (5. lecke).

Saját kör kell a nagy és tartós fogyasztóknak: főzőlap és sütő (a gyártó előírása szerint egy- vagy háromfázisú), mosogatógép, mosógép, szárítógép, villanybojler, klíma, hőszivattyú, autótöltő. A konyhai munkalap aljzatai legalább két körre kerüljenek (3. lecke: három konyhagép már túlterhel egy kört). A fürdő aljzatai saját körön; a kültéri aljzatok és a kerti világítás külön körön.

Az aljzatok számánál az a cél, hogy ne kelljen hosszabbító: a bútorozási tervből kell kiindulni (TV-fal, ágy két oldala, íróasztal, konyhapult). Jellemző magasságok a gyakorlatban: aljzat a kész padló fölött kb. 30 cm, kapcsoló kb. 1,05–1,10 m (akadálymentes lakásban alacsonyabb), konyhai munkalap fölötti aljzat kb. 1,05–1,15 m. A pontos magasságot a megrendelővel és a bútortervvel kell egyeztetni.

Szerelési zónák: a vezetékek a falban vízszintesen a mennyezet alatt és a padló fölött 15–45 cm-es sávban, valamint az ajtókilincs magasságában; függőlegesen az ajtók, ablakok és sarkok mellett 10–30 cm-es sávban futnak. Ez a német DIN 18015-3 gyakorlata; nálunk nem kötelező, de ha betartjuk, később bárki tudja, hol nem szabad fúrni (Rögzítéstechnika).

**Kidolgozott példa**

Egy 75 m²-es, kétszobás lakás áramkörei (egyfázisú betáplálás, villanyfőzőlappal).

1. Világítás: 2 kör (a lakás két fele), B10.
2. Aljzatok: nappali 1, hálók 1–2, előszoba és közlekedő 1, B16.
3. Konyha: munkalap 2 kör, hűtő és mikró a pult körein; mosogatógép 1, sütő 1; főzőlap a gyártó szerint (egyfázison jellemzően B32 vagy B25, 6 mm² vagy 4 mm²).
4. Fürdő: aljzat és mosógép 1–2 kör; villanybojler 1 (B16 vagy B20 a teljesítmény szerint).
5. Erkély vagy kültér 1, médiadoboz 1 aljzat a hálózati eszközöknek.

→ Kb. 14–16 kör, két áram-védőkapcsoló csoportban, úgy keverve, hogy egy kioldásnál maradjon fény és működjön a hűtő.

**Gyakorló feladatok**

1. Miért ne legyen egy helyiség világítása és aljzatai ugyanazon a körön?
   <details><summary>Megoldás</summary>Mert egy hibás készülék miatti kioldáskor a helyiség sötétben maradna, és a hibát is nehezebb megtalálni.</details>
2. Mely fogyasztók kapnak jellemzően saját kört?
   <details><summary>Megoldás</summary>Főzőlap, sütő, mosogatógép, mosógép, szárítógép, bojler, klíma, hőszivattyú, autótöltő.</details>
3. Mire jók a szerelési zónák?
   <details><summary>Megoldás</summary>Arra, hogy a falban futó vezetékek helye kiszámítható legyen: fúráskor és utólagos szereléskor elkerülhetők.</details>

**Biztonság**

- Konyhában és fürdőben az aljzatok helyét a vízvételi helyektől és a fürdőszobai zónáktól függetlenül is úgy kell kijelölni, hogy fröccsenő víz ne érje őket.

*Kapcsolódó kártyák:* Kapcsolt aljzat (a dugaszolós lámpák köre), Konyhai pult alatti világítás, MSZ HD 60364-7-701 · Fürdő- és zuhanyhelyiségek, Ethernet csavart érpár, Vezeték- és vaskereső

<a id="s07-merohely"></a>

### 7. Mérőhely és betáplálás

*Előtte:* 1. Hálózati rendszerek: TN-C, TN-S, TN-C-S, TT, IT, 5. A lakáselosztó

**Célok**

- Megismerni az út a közcélú hálózattól a lakáselosztóig.
- Tudni, mi a szolgáltatóé és mi a fogyasztóé, és mit szabad megbontani.
- Kiszámolni egy csatlakozás teljesítményét és tudni, hogyan bővíthető.

A közcélú hálózatról (légvezeték vagy földkábel) a csatlakozó vezeték jut a mérőhelyre. A mérőhelyen a mérő előtti kismegszakító vagy biztosító, a fogyasztásmérő és a hozzá tartozó szerelvények vannak; a mérő utáni rész a fővezeték, amely a lakáselosztóig fut.

A mérő előtti rész plombált: azt csak az elosztói engedélyes (a terület áramszolgáltatója) vagy az általa megbízott bonthatja meg. A mérőhely kialakítását a szolgáltató műszaki követelményei írják elő; új vagy átalakított mérőhelyhez terv és szolgáltatói ügyintézés kell.

A csatlakozási teljesítményt a mérő előtti védelem névleges árama adja: egyfázisú 32 A kb. 7,4 kW, háromfázisú 3 × 16 A kb. 11 kW, 3 × 25 A kb. 17 kW. Bővítést (pl. hőszivattyúhoz, autótöltőhöz) igényléssel lehet kérni; a díj és a feltételek a szolgáltatótól függenek.

Vezérelt (külön mérésű, kedvezményes) áram: a bojler vagy a fűtés köre csak a szolgáltató által engedélyezett időszakokban kap áramot, külön mérővel vagy külön mérési körrel. Napelemes rendszernél (háztartási méretű kiserőmű) kétirányú mérő méri a betáplált és a vételezett energiát.

Az okos mérők a szolgáltató felé kommunikálnak (mobilhálózaton vagy a hálózati vezetéken, PLC); egyes típusok helyi adatkimenetet is adnak.

**Képletek**

- `P ≈ U · I (1 fázis) · P ≈ √3 · 400 · I (3 fázis)` — a csatlakozás teljesítménye a mérő előtti védelem névleges áramából

**Kidolgozott példa**

Egy egyfázisú 32 A-es csatlakozású családi házba 7,5 kW-os hőszivattyút és 11 kW-os autótöltőt terveznek. Elég-e a csatlakozás?

1. A meglévő csatlakozás: 230 × 32 ≈ 7,4 kW.
2. Csak a két új fogyasztó: 7,5 + 11 = 18,5 kW (a töltő háromfázisú).
3. Háromfázisú bővítés kell: 3 × 32 A ≈ 22 kW, vagy 3 × 25 A ≈ 17 kW terheléskezeléssel (a töltő visszaszabályoz, amikor a ház többi része sokat fogyaszt).

→ A mostani csatlakozás nem elég; háromfázisú bővítés kell, és érdemes terheléskezeléssel tervezni (3. szint: energiamenedzsment).

**Gyakorló feladatok**

1. Szabad-e a villanyszerelőnek a mérő előtti plombált részt megbontani?
   <details><summary>Megoldás</summary>Nem: azt csak a szolgáltató vagy az általa megbízott végezheti.</details>
2. Mekkora teljesítményt ad egy 3 × 25 A-es csatlakozás?
   <details><summary>Megoldás</summary>√3 × 400 × 25 ≈ 17,3 kW.</details>
3. Mi a vezérelt áram lényege?
   <details><summary>Megoldás</summary>Egy kör (pl. bojler) csak a szolgáltató által engedélyezett időszakokban kap áramot, külön, kedvezményes mérés mellett.</details>

**Biztonság**

- A mérőhelyen a mérő előtti rész a lakás főkapcsolójával nem válik feszültségmentessé.
- A csatlakozó vezeték és a mérő előtti rész zárlati árama nagy: nagyobb megszakítóképességű védelem és ennek megfelelő munkavégzés kell.

*Kapcsolódó kártyák:* Hálózati 50 Hz, PLC szűksávú, Mobilhálózat (4G, 5G), MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések

<a id="s08-foldeles-eph"></a>

### 8. Földelés és egyenpotenciálú összekötés

*Előtte:* 1. Hálózati rendszerek: TN-C, TN-S, TN-C-S, TT, IT, 2. Érintésvédelem: alap-, hiba- és kiegészítő védelem

**Célok**

- Megismerni a földelők fajtáit.
- Megérteni a fő és a helyi egyenpotenciálú összekötés szerepét.
- Kiválasztani az összekötő vezetők keresztmetszetét.

A földelő a talajjal jó villamos kapcsolatban lévő fémszerkezet. Alapföldelő: horganyzott acél szalag vagy köracél, amelyet a sávalap betonjába ágyaznak a betonozás előtt (Társszakmák: földmunka, alapozás); a legjobb és legtartósabb megoldás. Rúdföldelő: a talajba vert szondák; szalagföldelő: a talajba fektetett szalag. Utólag, meglévő épületnél jellemzően rúdföldelő.

Fő egyenpotenciálú összekötés (fő EPH): az épületbe belépő fémszerkezeteket (vízcső, gázcső a szigetelő közdarab után, fűtéscső, szerkezeti acél, a villámvédelem levezetője) egy fő földelősínen összekötik a védővezetővel és a földelővel. Így hiba esetén nem keletkezik veszélyes feszültségkülönbség a fémrészek között.

Helyi (kiegészítő) egyenpotenciálú összekötés: ahol a szabvány előírja (pl. medence, egyes esetekben fürdő), a helyiség egyidejűleg érinthető fémrészeit és a védővezetőket helyben is összekötik.

Keresztmetszetek (tájékoztató): a fő EPH vezető legalább a legnagyobb védővezető felét, de legalább 6 mm² rezet kell érjen (25 mm²-nél többre nincs szükség); a kiegészítő összekötő vezető két idegen vezetőképes rész között legalább 2,5 mm² (mechanikai védelemmel) vagy 4 mm² (védelem nélkül) réz; test és idegen rész között legalább a hozzá csatlakozó védővezető fele, két test között legalább a kisebbik védővezető vezetőképessége (a hatályos MSZ szöveggel ellenőrizendő).

**Képletek**

- `R = U / I` — a földelési ellenállást földelésmérő műszer méri, segédszondákkal vagy lakatfogós módszerrel

**Kidolgozott példa**

Egy családi ház fővezetéke 10 mm²-es, a legnagyobb védővezető is 10 mm². Mekkora fő EPH vezető kell?

1. A legnagyobb védővezető fele: 5 mm².
2. A legkisebb megengedett: 6 mm² réz.
3. A kettő közül a nagyobb: 6 mm².

→ 6 mm²-es réz fő EPH vezető kell; zöld-sárga szigetelésű, a fő földelősínre és minden belépő fémvezetékre bekötve, feliratozott kötésekkel.

**Gyakorló feladatok**

1. Mikor kell az alapföldelőt elhelyezni?
   <details><summary>Megoldás</summary>A sávalap betonozása előtt; utólag nem pótolható.</details>
2. Melyik oldalon kötjük be a gázcsövet a fő EPH-ba?
   <details><summary>Megoldás</summary>Az épületbe lépés után, a szigetelő közdarab épület felőli oldalán.</details>
3. Mi a fő EPH célja?
   <details><summary>Megoldás</summary>Hogy az épület fémszerkezetei között hiba esetén se keletkezzen veszélyes feszültségkülönbség.</details>

**Biztonság**

- A gázcsövet földelőként használni tilos; csak összekötni szabad a fő EPH-ban.
- A meglazult EPH-kötés nem látszik, de a védelem nem működik: a kötéseket hozzáférhetően és feliratozva kell elkészíteni.

*Kapcsolódó kártyák:* MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, MSZ HD 60364-7-702 · Úszómedencék és szökőkutak, MSZ HD 60364-7-701 · Fürdő- és zuhanyhelyiségek, Medencevilágítás

<a id="s09-kulonleges-helyisegek"></a>

### 9. Különleges helyiségek a gyakorlatban

*Előtte:* 2. Érintésvédelem: alap-, hiba- és kiegészítő védelem, 8. Földelés és egyenpotenciálú összekötés

**Célok**

- Egy fürdőszobát a zónák szerint megtervezni.
- Tudni, mit kér a medence, a szauna és a kültéri világítás a lakásokhoz képest pluszban.
- Az Előírások kártyáit a munkában alkalmazni.

A különleges helyiségekben (MSZ HD 60364-7-xx részek) a víz, a hő vagy a környezet miatt nagyobb az áramütés vagy a tűz veszélye, ezért az általános szabályokon felül további szabályok vannak. A részleteket az Előírások kártyái foglalják össze; ez a lecke a gyakorlati sorrendet adja.

Fürdőszoba (MSZ HD 60364-7-701, 2024-es kiadás): 1. a kád vagy a zuhany helyének ismeretében berajzolni a zónákat (kádnál 0., 1. és 2.; zuhanynál csak 0. és 1., tálca nélkül a vízkifolyótól 1,2 m sugárral); 2. a zónákba csak oda szánt, megfelelő IP-jű szerkezetet tervezni; 3. aljzat a 0. zónában nem lehet, az 1. és 2. zónában csak törpefeszültségű (a 2. zónában még borotva-tápegység); kapcsoló a 2. zónában IPX4-gyel lehet, az 1. és 0. zónában nem; 4. minden kör 30 mA-es áram-védőkapcsolóval; a 2007-es kiadás (2027-12-06-ig párhuzamosan érvényes) zuhanynál is 2. zónát és a kapcsolót a zónákon kívül kérte; 5. az egyenpotenciálú összekötést a szabvány és a helyi viszonyok szerint ellenőrizni.

Medence: a zónákba csak törpefeszültségű víz alatti lámpa és oda szánt berendezés, a transzformátor a zónákon kívül; a medence fémszerkezeteinek helyi egyenpotenciálú összekötése; a gépészet a medenceépítővel közösen.

Szauna: hőmérsékleti zónák, hőálló vezetékek és szerelvények a kabin felső részén, a kapcsolókészülékek a kabinon kívül, a kályha a gyártó előírása szerint.

Kültéri világítás: legalább IP33, a földkábel védelme és jelzése, a 2,5 m alatti szerelvényajtók kulccsal vagy szerszámmal zárva, a 2,8 m alatti fényforrás csak szerszámmal hozzáférhető; 30 mA-es áram-védőkapcsoló a kültéri aljzatkörökre és a kioszkok, buszvárók, hirdetőtáblák világítására.

**Kidolgozott példa**

Egy 2 × 2,5 m-es fürdőszoba zuhanytálcával (90 × 90 cm), mosdóval és mosógéppel. Hova kerüljön a mennyezeti lámpa, a tükörlámpa, a kapcsoló és a mosógép aljzata?

1. Zóna 0: a tálca belseje; zóna 1: a zuhanytálca fölött 2,25 m-ig, a tálca kiterjedésében. Zuhanynál nincs 2. zóna (2024-es kiadás; a 2007-es szerint a tálca szélétől további 0,6 m 2. zóna volt).
2. Mennyezeti lámpa: ha a zóna 1-be esik (2,25 m alatti mennyezetnél), legalább IPX4 (vízsugárnál IPX5); a zónákon kívül is IP44 ajánlott a pára miatt.
3. Tükörlámpa a mosdó fölött, a zónákon kívül, IP44.
4. Kapcsoló a fürdőn kívül vagy az ajtó mellett, a zónákon kívül.
5. Mosógép aljzata a zónákon kívül, saját körön, 30 mA-es (inverteres gépnél F típusú) áram-védőkapcsolóval.

→ Minden szerkezet a zónájának megfelelő védettségű, a kapcsolók és aljzatok a zónákon kívül, minden kör 30 mA-es védelem alatt.

**Gyakorló feladatok**

1. Milyen védettség kell legalább a fürdőszobai zóna 1-be szerelt lámpatestnek?
   <details><summary>Megoldás</summary>Legalább IPX4; ahol vízsugár éri (pl. tisztításkor), IPX5.</details>
2. Hová kerül a medence víz alatti lámpájának transzformátora?
   <details><summary>Megoldás</summary>A medence zónáin kívülre.</details>
3. Hová kerülnek a szauna kapcsolókészülékei?
   <details><summary>Megoldás</summary>A kabinon kívülre (a kályha vezérlője a gyártó előírása szerint).</details>

**Biztonság**

- A különleges helyiségek szabályai a hatályos MSZ HD 60364-7-xx szövegből ellenőrizendők munka előtt; ez a lecke csak a gyakorlati sorrendet adja.

*Kapcsolódó kártyák:* MSZ HD 60364-7-701 · Fürdő- és zuhanyhelyiségek, MSZ HD 60364-7-702 · Úszómedencék és szökőkutak, MSZ HD 60364-7-703 · Szaunák, MSZ HD 60364-7-714 · Kültéri világítási berendezések, Fürdőszobai mennyezeti lámpa, Tükörvilágítás, Medencevilágítás, Szaunavilágítás

<a id="s10-ellenorzo-meresek"></a>

### 10. Ellenőrző mérések és a jegyzőkönyv

*Előtte:* 2. Érintésvédelem: alap-, hiba- és kiegészítő védelem, 8. Földelés és egyenpotenciálú összekötés

**Célok**

- Ismerni az első ellenőrzés lépéseit és sorrendjüket.
- Elvégezni és értékelni a szigetelés-, a hurokimpedancia- és az áram-védőkapcsoló-mérést.
- Jegyzőkönyvet készíteni.

Az átadás előtt minden új vagy átalakított berendezést ellenőrizni kell (MSZ HD 60364-6): szemrevételezés, majd mérések, végül a működés próbája, és mindezt jegyzőkönyvben dokumentálni.

Sorrend: feszültségmentesen először a védővezetők folytonossága (kis ellenállású mérés), majd a szigetelési ellenállás, majd a polaritás. Csak ezek után szabad feszültség alá helyezni, és mérni a hurokimpedanciát (az önműködő lekapcsolás feltételét) és az áram-védőkapcsolók kioldását.

Szigetelési ellenállás (tájékoztató): 500 V-ig terjedő körökben 500 V egyenfeszültségű méréssel, legalább 1 MΩ; törpefeszültségű körökben 250 V-tal, legalább 0,5 MΩ. Mérés előtt a túlfeszültség-levezetőt és az érzékeny elektronikát (LED-meghajtó, okos kapcsoló) le kell választani, vagy a fázist és a nullát összekötve a védővezetőhöz képest mérni. Ha a túlfeszültség-levezetőt vagy más készüléket nem lehet leválasztani (pl. levezetős aljzat), a vizsgálófeszültség az adott körre 250 V-ra csökkenthető, de legalább 1 MΩ szükséges.

Hurokimpedancia: a mért érték legyen kisebb a 2. lecke szerinti határnál. A vezeték üzemi melegedése miatt a mért (hideg) értéket tartalékkal értékeljük: a gyakorlatban elterjedt (az angol BS 7671 / IET útmutatókból származó) szabály, hogy a hidegen mért érték ne haladja meg a táblázati határ 80 %-át, mert a határ az üzemi hőmérsékletű vezetékre vonatkozik; az MSZ HD 60364 szövege ezt nem írja elő.

Áram-védőkapcsoló: a próbagomb nem elég; műszerrel kell mérni a kioldási áramot és a kioldási időt. Tájékoztató értékek általános típusnál: névleges kioldóáramon legfeljebb 300 ms, ötszörös áramon legfeljebb 40 ms. Egyes 30 mA-es készülékeknél a gyártó a 40 ms-ot 5 × IΔn helyett 250 mA-nél garantálja; ilyenkor a műszeres próbát a gyártói adat szerint kell értékelni.

**Képletek**

- `Zs,mért ≤ 0,8 · U0 / Ia` — gyakorlati szabály a hideg állapotban mért hurokimpedancia értékelésére

**Kidolgozott példa**

Egy B16-os aljzatkörön a mért hurokimpedancia 1,9 Ω, az áram-védőkapcsoló 30 mA-en 24 ms alatt old. Megfelel?

1. Határ (2. lecke): 230 / 80 ≈ 2,9 Ω; 80 %-a ≈ 2,3 Ω.
2. 1,9 Ω < 2,3 Ω: a kismegszakító időben lekapcsol.
3. 24 ms < 300 ms: az áram-védőkapcsoló kioldási ideje megfelel.

→ A kör megfelel; a jegyzőkönyvbe a mért értékek, a határértékek, a műszer és a dátum kerül.

**Gyakorló feladatok**

1. Miért a feszültségmentes mérésekkel kezdünk?
   <details><summary>Megoldás</summary>Mert a folytonossági és a szigetelési hibát még a feszültség alá helyezés előtt meg kell találni, különben a bekapcsolás veszélyes lehet.</details>
2. Mi a teendő a szigetelésmérés előtt a LED-meghajtókkal és a túlfeszültség-levezetővel?
   <details><summary>Megoldás</summary>Le kell választani őket, vagy a fázist és a nullát összekötve a védővezetőhöz képest kell mérni, különben tönkremehetnek vagy hamis eredményt adnak.</details>
3. Elég-e a próbagomb megnyomása az áram-védőkapcsoló ellenőrzéséhez átadáskor?
   <details><summary>Megoldás</summary>Nem: műszerrel kell mérni a kioldási áramot és időt.</details>

**Biztonság**

- A szigetelésmérés 500 V-os feszültsége érintésre kellemetlen és veszélyes lehet: mérés közben senki ne dolgozzon a körön.
- A mérések a berendezés átadásához kötött dokumentumok: hamis vagy elmaradt mérés jogi felelősséggel jár.

*Kapcsolódó kártyák:* MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, MSZ EN 60669 és MSZ HD 60884 · Kapcsolók és dugaszolóaljzatok, LED-szalag (12 / 24 V)

<a id="s11-kabelek"></a>

### 11. Kábelek a gyakorlatban

*Előtte:* 4. Keresztmetszet és feszültségesés, 6. Áramkörök kiosztása egy lakásban

**Célok**

- Nyomvonalat tervezni a szerelési zónák és a szerkezet szerint.
- A fektetési módhoz illő kábelt és védőcsövet választani.
- Földkábelt fektetni, és tudni, mikor kell összekötő vagy végelzáró készlet.

A nyomvonal a rajzon kezdődik: a kábel a falban a szerelési zónákban fut (6. lecke), vízszintesen vagy függőlegesen, sosem átlósan, hogy később fúráskor kiszámítható legyen, hol van. Ahol a zónától el kell térni, azt a tervbe és az átadási dokumentációba be kell rajzolni.

Fektetési módok: vakolat alatt (falhoronyban, gipszelve), védőcsőben (falban, padlóban, betonban), falon kívül (kábelcsatornában, bilinccsel, tálcán), szerelt falban és álmennyezetben, földben. A fektetési mód a terhelhetőséget is meghatározza (4. lecke), ezért a tervben szerepelnie kell.

Kábel vagy vezeték: a falban, vakolat alatt köpenyes kábel (pl. NYM-J) vagy védőcsőbe húzott egyerű vezeték (H07V-U, H07V-R) fut; egyerű vezeték védőcső nélkül nem fektethető. Földbe csak földkábel (pl. NYY-J, E-YY-J) kerülhet, a lakáskábel nem. A hajlítási sugarat a gyártó adja; köpenyes PVC kábelnél fix szerelésben jellemzően a kábelátmérő négyszerese.

Védőcső: a merev cső falon kívülre és egyenes szakaszra való, a gégecső falba, padlóba és szerelt falba. Betonba csak az erre minősített, nagyobb nyomószilárdságú cső kerülhet (a jelölése a csövön van); a sima gégecső a betonozáskor összenyomódik. A cső legyen akkora, hogy a vezeték később is kihúzható és cserélhető legyen; a kanyarok számát doboz vagy húzódoboz korlátozza.

Földkábel (tájékoztató, a hazai gyakorlat szerint): kb. 0,7 m mélyen, alatta és fölötte homokágy, fölötte kb. 20–30 cm-rel figyelmeztető szalag; úttest, kocsibejáró alatt mélyebben és védőcsőben. Az épületbe és a kapuoszlopba védőcsőben lép be. Földben kábelt csak erre gyártott összekötő készlettel (gyantás vagy zsugorcsöves) szabad toldani; a sorkapocs szigetelőszalaggal a földben tönkremegy.

Átvezetések: ahol a kábel tűzszakasz határán (tűzfal, födém, aknafal) halad át, az átvezetést minősített tűzgátló anyaggal kell lezárni (OTSZ). Kültéren UV-álló kötegelőt és bilincset kell használni, és a kábelbevezetést tömszelencével tömíteni. A gyengeáramú kábel a 230 V-os kábeltől elválasztva fusson (Kommunikációs vonalak, Ethernet).

**Képletek**

- `ΔU = 2 · l · I · ρ / A` — egyfázisú kör feszültségesése (4. lecke); hosszú földkábelnél ellenőrizni kell

**Kidolgozott példa**

A ház falától 25 m-re lévő kapuoszlopba egy lámpa és egy 16 A-es kültéri aljzat kerül. Milyen kábel, hogyan fektetve, és belefér-e a feszültségesés?

1. Kábel: földkábel, 3 × 2,5 mm² (pl. NYY-J), mert földbe lakáskábel nem kerülhet.
2. Fektetés: kb. 0,7 m mélyen homokágyban, fölötte figyelmeztető szalag; a ház és az oszlop felé védőcsőben, az oszlopban tömszelencével.
3. Feszültségesés: ΔU = 2 × 25 × 16 × 0,0178 / 2,5 ≈ 5,7 V, ez 230 V-nak kb. 2,5 %-a: belefér.
4. Védelem: saját kör, kismegszakító és 30 mA-es áram-védőkapcsoló (kültéri aljzat).

→ 3 × 2,5 mm² földkábel 0,7 m mélyen, a végeken védőcsőben; a feszültségesés kb. 2,5 %, a kör 30 mA-es védelem alatt.

**Gyakorló feladatok**

1. Miért nem szabad a kábelt a falban átlósan vezetni?
   <details><summary>Megoldás</summary>Mert később senki sem számít rá: fúráskor vagy szegezéskor megsérül. A zónákban, vízszintesen vagy függőlegesen futó kábel helye kiszámítható.</details>
2. Mehet-e sima gégecső a födém betonjába?
   <details><summary>Megoldás</summary>Nem: csak a betonba minősített, nagyobb nyomószilárdságú cső, mert a sima gégecső betonozáskor összenyomódik.</details>
3. Mit kell tenni, ahol a kábel egy tűzfalon halad át?
   <details><summary>Megoldás</summary>Az átvezetést minősített tűzgátló anyaggal (tömítéssel, habarccsal, mandzsettával) le kell zárni.</details>

**Biztonság**

- Falhorony és fúrás előtt vezetékkeresővel ellenőrizni, hol futnak meglévő vezetékek és csövek.
- Földmunkánál a közművek (gáz, víz, távközlés) helyét előbb a szolgáltatóktól meg kell tudni.

*Kapcsolódó kártyák:* Vezeték- és vaskereső, Dobozfúró korona, Beton, Gipszkarton, Ethernet csavart érpár, Hálózati 50 Hz, Kapuoszlop- és pillérlámpa, Kerti oszloplámpa (bollard), MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések

<a id="s12-tulfeszultseg-villamvedelem"></a>

### 12. Villám- és túlfeszültség-védelem

*Előtte:* 1. Hálózati rendszerek: TN-C, TN-S, TN-C-S, TT, IT, 5. A lakáselosztó, 8. Földelés és egyenpotenciálú összekötés

**Célok**

- Megérteni, honnan jön a túlfeszültség, és mit véd ki a levezető.
- Az 1., 2. és 3. típusú levezetőt a helyére tenni a lakáselosztóban és a készüléknél.
- Ismerni a villámvédelmi rendszer részeit, és tudni, mi tartozik a villanyszerelőre.

Túlfeszültség keletkezhet közeli vagy közvetlen villámcsapástól, a hálózati kapcsolásoktól, és bejöhet a táp-, az antenna- vagy az adatvezetéken is. A levezető (SPD) normál feszültségen nem vezet, túlfeszültségnél rövid időre levezeti az áramot a védővezetőre, és a feszültséget a készülék által elviselt szintre korlátozza.

Típusok: az 1. típus a villámáramot (10/350 µs hullám) vezeti le; oda kell, ahol az épületnek külső villámvédelme van, vagy szabadvezetékről kap táplálást, a betáplálás közelében. A 2. típus (8/20 µs) a lakáselosztóba való, ez a leggyakoribb. A 3. típus finomvédelem a készülék közelében (pl. levezetős aljzat), csak a 2. típus mögött. Kombinált (1+2) levezető is van.

Bekötés: a levezető bekötővezetéke legyen a lehető legrövidebb (a fázis és a védővezető felé együtt jellemzően legfeljebb 0,5 m), mert a hosszú vezeték induktivitása rontja a védelmet. Keresztmetszet tájékoztatóul: a 2. típus védővezetője legalább 4 mm², az 1. típusé legalább 16 mm² réz (MSZ HD 60364-5-53, ellenőrizendő a hatályos kiadással). Az előtét-biztosítót a gyártó adja meg.

Hely: TN-C-S rendszerben a levezető az áram-védőkapcsoló elé kerül (különben a levezetett áram kioldja); TT rendszerben a gyártó „3+1” kapcsolása kell (a fázisok és a nulla közé levezető, a nulla és a védővezető közé szikraköz). Az Uc (legnagyobb tartós üzemi feszültség) 230/400 V-os hálózaton jellemzően 275 V.

Mikor kötelező: az MSZ HD 60364-4-443 sok esetben előírja (ahol a túlfeszültség emberi életet, közszolgáltatást vagy sok embert érint), egyébként kockázatelemzés alapján dönthető el; családi háznál ma általános a 2. típusú levezető. Az antennát, a műholdvevőt és a hosszú adatvezetéket is be kell vonni (antennaföldelés, adat-levezető).

Villámvédelmi rendszer (MSZ EN 62305): külső része a felfogó, a levezető és a földelő; belső része az egyenpotenciálú összekötés (8. lecke) és a túlfeszültség-levezetők. A külső villámvédelem tervezése és felülvizsgálata külön szakterület, jogosultsághoz kötött; a villanyszerelő a belső villámvédelemért és a levezetőkért felel, és a villámvédelmi földelést a ház földeléséhez köti.

**Kidolgozott példa**

Egy TN-C-S rendszerű, földkábeles betáplálású családi háznak nincs külső villámvédelme. Milyen levezető kerüljön a lakáselosztóba, és hogyan?

1. Külső villámvédelem és szabadvezeték nincs, ezért 1. típus nem kell; 2. típusú levezető, Uc ≈ 275 V.
2. Hely: a főkapcsoló után, az áram-védőkapcsolók elé.
3. Bekötés: a fázis- és a védővezető felé együtt legfeljebb kb. 0,5 m, a védővezető legalább 4 mm² réz, előtét-biztosító a gyártó szerint.
4. A tévé és a hálózati eszközök elé 3. típusú finomvédelem, az antennakábel földelve.

→ 2. típusú levezető a főkapcsoló után, rövid bekötéssel; finomvédelem a drága készülékeknél.

**Gyakorló feladatok**

1. Miért kell a levezető bekötővezetékét a lehető legrövidebbre venni?
   <details><summary>Megoldás</summary>Mert a hosszú vezeték induktivitásán a villámáram nagy feszültséget ejt, ami a levezető korlátozó feszültségéhez adódik: a készülékre több jut.</details>
2. TN-C-S rendszerben az áram-védőkapcsoló elé vagy mögé kerül a levezető?
   <details><summary>Megoldás</summary>Elé, különben a levezetett áramot hibaáramnak érzékelve kioldhat, vagy a lökés tönkreteheti.</details>
3. Mikor kell 1. típusú levezető?
   <details><summary>Megoldás</summary>Ha az épületnek külső villámvédelme van, vagy szabadvezetékről kap táplálást.</details>

**Biztonság**

- A levezetőt csak feszültségmentes elosztóban szabad cserélni; a kijelzője (piros ablak) azt jelzi, hogy már nem véd.
- Szigetelésmérés előtt a levezetőt le kell választani (10. lecke).

*Kapcsolódó kártyák:* MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, Koax: műholdas középfrekvencia, Koax: antenna és kábel-TV, Ethernet csavart érpár, Hálózati 50 Hz

<a id="s13-motorok-transzformator"></a>

### 13. Motorok és transzformátor

*Előtte:* 5. A háromfázisú rendszer, 2. Érintésvédelem: alap-, hiba- és kiegészítő védelem, 3. Túláramvédelem: kismegszakító és biztosító

**Célok**

- Megérteni a forgó mágneses teret és az aszinkron motor működését.
- Egy motort a hálózathoz kötni: csillag vagy delta, védelem, indítás.
- Mágneskapcsolós forgásirányváltást bekötni reteszeléssel; ismerni a transzformátor alapjait.

A háromfázisú tekercsek a 120°-kal eltolt áramokkal forgó mágneses teret hoznak létre. Ennek fordulatszáma n0 = 60 · f / p (p a póluspárok száma): 50 Hz-en 3000, 1500, 1000 1/perc. Az aszinkron motor forgórésze ennél kicsit lassabban forog (szlip, jellemzően néhány %), ezért a 4 pólusú motor adattábláján kb. 1420–1460 1/perc áll.

Adattábla: névleges teljesítmény (a tengelyen leadott!), feszültség (pl. 230/400 V Δ/Y), áram, cos φ, fordulatszám, védettség. Ha a hálózat 3 × 400 V és a motor 230/400 V-os, csillagba kell kötni; ha 400/690 V-os, deltába. A kapocsdobozban az átkötő hidak állítják be.

Indítás: közvetlen indításkor a motor a névleges áram többszörösét (jellemzően 5–8-szorosát) veszi fel. A csillag-delta indítás (csak deltában üzemelő, 400/690 V-os motornál) az indítóáramot és a nyomatékot kb. harmadára csökkenti; a lágyindító és a frekvenciaváltó fokozatosan, kíméletesen indít, a frekvenciaváltó a fordulatszámot is szabályozza.

Forgásirányváltás: két fázis felcserélésével. Mágneskapcsolós kapcsolásban két kontaktor (előre, hátra) kapcsolja a motort; a kettő egyszerre soha nem húzhat be (zárlat), ezért villamos reteszelés kell (egymás vezérlőkörében egy-egy nyitó segédérintkező), és gyakran mechanikus is. A vezérlőkör: a STOP nyomógomb (nyitó) sorban, az indító nyomógombok (záró) mellett öntartó segédérintkező. Ez tipikus vizsgafeladat.

Védelem: a motorvédő kapcsoló vagy a hőkioldó (túlterhelés-relé) a motor névleges áramára állítandó, a rövidzárlatot a kapcsoló mágneses kioldója vagy az előtét védi. Frekvenciaváltónál árnyékolt motorkábel és a gyártó szerinti áram-védőkapcsoló kell (jellemzően B vagy F típus, 2. lecke); a gépek kezelőszerveinek színe az MSZ EN 60204-1 szerint.

Transzformátor: két tekercs közös vasmagon; U1 / U2 = N1 / N2, az áram fordítva arányos. Biztonsági transzformátor (MSZ EN 61558-2-6) táplálja a törpefeszültségű (SELV) köröket, pl. a medence lámpáit; a toroid transzformátor bekapcsolási áramlökése nagy, ezért a kismegszakító karakterisztikáját ehhez kell választani.

**Képletek**

- `n0 = 60 · f / p` — a forgó mágneses tér (szinkron) fordulatszáma, 1/perc; p a póluspárok száma
- `I = P / (√3 · U · cos φ · η)` — háromfázisú motor árama a tengelyteljesítményből (P), a vonali feszültségből (U), a teljesítménytényezőből és a hatásfokból
- `U1 / U2 = N1 / N2` — transzformátor áttétele: a feszültségek aránya a menetszámok aránya

**Kidolgozott példa**

Egy 4 kW-os, 230/400 V-os, cos φ = 0,85, η = 0,87 adatú motort 3 × 400 V-ról táplálunk. Hogyan kötjük, mekkora az áram, és mire állítjuk a motorvédőt?

1. Kötés: 400 V-os hálózat, 230/400 V-os motor: csillag (Y).
2. Áram: I = 4000 / (1,732 × 400 × 0,85 × 0,87) ≈ 4000 / 512 ≈ 7,8 A.
3. Motorvédő kapcsoló: 6,3–10 A-es tartomány, 7,8 A-re állítva (vagy az adattábla áramára).
4. Közvetlen indításkor az áram rövid ideig kb. 40–60 A: a motorvédő mágneses kioldója ezt elviseli, a kismegszakító helyett a motorvédő véd.

→ Csillag kötés, kb. 7,8 A, a motorvédő 7,8 A-re állítva.

**Gyakorló feladatok**

1. Hogyan változtatod meg egy háromfázisú motor forgásirányát?
   <details><summary>Megoldás</summary>Két fázis felcserélésével.</details>
2. Miért kell reteszelni a forgásirányváltó két mágneskapcsolóját?
   <details><summary>Megoldás</summary>Mert ha egyszerre behúznak, két fázist rövidre zárnak; a reteszelés (nyitó segédérintkező a másik vezérlőkörében) ezt megakadályozza.</details>
3. Mekkora a 2 pólusú (p = 1) motor szinkron fordulatszáma 50 Hz-en?
   <details><summary>Megoldás</summary>60 × 50 / 1 = 3000 1/perc; a valóságos fordulatszám a szlip miatt kicsit kevesebb.</details>

**Biztonság**

- Motor kapocsdobozán dolgozni csak feszültségmentesen és a gép indítását megakadályozva (öt szabály); a frekvenciaváltó kondenzátora a lekapcsolás után percekig feszültséget tart.
- A forgó gép elkapja a ruhát és a kezet: próbaüzem előtt a burkolatok a helyükön.

*Kapcsolódó kártyák:* MSZ EN 60204-1 · Gépek villamos szerkezetei, MSZ HD 60364-7-702 · Úszómedencék és szökőkutak, RS-485 · Modbus RTU, Hálózati 50 Hz

<a id="s14-epuletautomatizalas"></a>

### 14. Épületautomatizálás alapjai

*Előtte:* 10. Az első áramkörök: kapcsolások, 6. Áramkörök kiosztása egy lakásban

**Célok**

- A KNX és a DALI vezetékezését és szabályait ismerni.
- Okos szerelvényt helyesen bekötni egy meglévő lakásban.
- Egy rendszert élesíteni és átadni: címzés, próba, dokumentáció.

Az épületautomatizálásban a kapcsoló és a fogyasztó között nem közvetlen vezeték, hanem jel van: a nyomógomb üzenetet küld, a kapcsolóaktor kapcsol. A vezetékes rendszerek (KNX, DALI) megbízhatóak és tervezhetőek, a rádiósok (Zigbee, Z-Wave, Wi-Fi, Thread) utólag is beépíthetők. A rendszer kiválasztása tervezési kérdés (3. szint), a szerelés és az élesztés a szakmunkásé.

KNX TP: kéteres buszkábel (jellemzően zöld köpenyű, árnyékolt, 2 × 2 × 0,8 mm; a piros–fekete pár a busz), 30 V DC busztáp fojtóval. Vonalanként legfeljebb 64 eszköz (szokásos tápnál), legfeljebb 1000 m kábel, a táptól legfeljebb 350 m, két eszköz között legfeljebb 700 m (Kommunikációs vonalak, KNX). A busz törpefeszültségű (SELV): a 230 V-tól elválasztva kell vezetni, a dobozban a gyártó és a KNX-irányelv szerinti távolsággal.

DALI: kéteres vezérlővonal a lámpatestek működtetőihez, egy vonalon legfeljebb 64 cím és 16 csoport, a buszt egy DALI-táp látja el. A DALI-erek nem törpefeszültségűek a szabvány értelmében, ezért egy kábelben futhatnak a hálózati erekkel (pl. 5 × 1,5 mm²: L, N, PE, DA, DA); a vonal hossza a feszültségesés miatt korlátozott (Kommunikációs vonalak, DALI).

Okos szerelvény utólag: a legtöbb okos kapcsoló, relé és dimmer nullát kér a kapcsolódobozban. A régi lakásban a kapcsolóhoz gyakran csak a fázis és a kapcsolt fázis megy le: ilyenkor nullát kell levinni, vagy nulla nélküli eszközt választani, amelyik LED-terhelésnél minimális terhelést vagy áthidaló tagot kér. Dimmernél a LED-fényforrással való összeférhetőséget (fázishasításos: fel- vagy lefutó él) a gyártói listán kell ellenőrizni.

Élesztés: minden eszköz megkapja a címét (KNX-ben az ETS szoftverrel, a programozó gombbal; DALI-ban a vezérlő címzi), majd a csoportokat és a funkciókat beállítják, és minden funkciót kipróbálnak. Átadáskor a tulajdonos megkapja a projektfájlt (KNX: ETS-projekt), a címlistát és a jelszavakat: ezek nélkül a rendszer később nem bővíthető.

**Kidolgozott példa**

Egy régi lakásban a nappali kapcsolóját okos kapcsolóra cserélnék. A dobozban csak két vezeték van, a lámpa LED-es. Mit teszel?

1. A két vezeték a fázis és a kapcsolt fázis: nulla nincs a dobozban.
2. 1. lehetőség: nullát vinni a dobozba (a kötődobozból, védőcsőben vagy új vezetékkel), és nullás okos kapcsolót tenni: ez a megbízható megoldás.
3. 2. lehetőség: nulla nélküli okos kapcsoló; LED-lámpánál a gyártó szerinti áthidaló tag (bypass) a lámpánál, különben a LED villog vagy dereng.
4. A dimmelhető LED-fényforrást és a dimmer típusát a gyártói összeférhetőségi lista szerint ellenőrizni.

→ Ha lehet, nulla a dobozba és nullás eszköz; ha nem, nulla nélküli eszköz áthidaló taggal.

**Gyakorló feladatok**

1. Futhat-e a KNX buszkábel egy védőcsőben a 230 V-os vezetékekkel?
   <details><summary>Megoldás</summary>Nem az elválasztás nélkül: a KNX busz törpefeszültségű (SELV), a gyártó és a KNX-irányelv szerinti elválasztás és távolság kell.</details>
2. Futhatnak-e a DALI-erek egy kábelben a hálózati erekkel?
   <details><summary>Megoldás</summary>Igen, a DALI-erek nem törpefeszültségűek, ezért pl. egy 5 × 1,5 mm²-es kábel két ere lehet DALI-vonal.</details>
3. Mit kell a tulajdonosnak átadni egy KNX-rendszer élesztése után?
   <details><summary>Megoldás</summary>Az ETS-projektfájlt, a címlistát és a jelszavakat, és a dokumentációt.</details>

**Biztonság**

- Okos szerelvény cseréjénél a dobozban több kör is lehet: minden kört le kell kapcsolni és feszültségmentességet mérni.
- A rádiós eszközök hálózati része is 230 V: a dobozba csak az előírt helyre és a gyártói hőleadási feltételek mellett szerelhető.

*Kapcsolódó kártyák:* KNX TP, DALI, 2,4 GHz sáv, 868 MHz sáv, Ethernet csavart érpár, MSZ EN 60669 és MSZ HD 60884 · Kapcsolók és dugaszolóaljzatok, HCL: emberközpontú világítás (hangolható fehér), LED-szalag (12 / 24 V)

<a id="s15-napelemes-rendszer"></a>

### 15. Napelemes rendszer telepítői szemmel

*Előtte:* 2. Érintésvédelem: alap-, hiba- és kiegészítő védelem, 7. Mérőhely és betáplálás, 12. Villám- és túlfeszültség-védelem

**Célok**

- Egy napelemes rendszer részeit és energiaútját ismerni.
- A stringfeszültséget hidegre ellenőrizni, a DC-oldalt helyesen szerelni.
- Az AC-oldali bekötést, a védelmeket és az engedélyezés lépéseit ismerni.

A napelem (modul) egyenáramot termel; a sorba kötött modulok sorát stringnek nevezzük. Az inverter a DC-t a hálózattal szinkron váltakozó árammá alakítja. A háztartási méretű kiserőmű (HMKE, legfeljebb 50 kVA) a lakás elosztójára csatlakozik, a többletet a kétirányú mérő méri (7. lecke). A szerelést az MSZ HD 60364-7-712 szabályozza; a villanyszerelő napelemes feladatát a KKK 2024-től az EU 2018/2001 irányelv (RED II) IV. melléklete szerint fogalmazza meg.

Stringfeszültség: a modul üresjárási feszültsége (Voc) hidegben nő (jellemzően kb. −0,3 %/K). A string feszültségét a legalacsonyabb várható hőmérsékletre (pl. −10 … −20 °C) kell kiszámítani, és ennek az inverter legnagyobb DC-feszültsége alatt kell maradnia, különben az inverter tönkremehet. A melegben mért, alacsonyabb feszültségnek pedig az inverter munkatartományában (MPP) kell lennie.

DC-oldal: napelemkábel (pl. H1Z2Z2-K, 4 vagy 6 mm²), UV- és időjárásálló; a csatlakozókat (pl. MC4-típus) csak azonos gyártó azonos típusú párjával szabad összedugni, és a gyártó szerszámával krimpelni. A DC-leválasztó és a DC-oldali túlfeszültség-levezető a gyártó és a terv szerint; három vagy több párhuzamos stringnél stringbiztosíték is kellhet. A plusz és a mínusz kábelt egymás mellett, hurok nélkül kell vezetni (kis hurokterület a villám indukált feszültsége ellen).

AC-oldal: az inverter saját körön, saját kismegszakítóval csatlakozik; az áram-védőkapcsoló típusát az inverter kézikönyve adja (ha az inverter kizárja a sima egyenáramú hibaáramot, általában az A típus elég, egyébként B). A bekötés előtt az elosztói engedélyesnél (áramszolgáltató) be kell jelenteni a kiserőművet, és a mérőt cserélni; a rendszer csak az engedély után kapcsolható a hálózatra.

Biztonság és tűzvédelem: a DC-oldal nappal mindig feszültség alatt van, az inverter lekapcsolása után is; a modulokat nem lehet „kikapcsolni”. Ezért a DC-vezetéket rövid, védett nyomvonalon kell vezetni, a mérőhelyen és az elosztón a napelemes rendszert figyelmeztető táblával jelölni, és a tűzvédelmi előírásokat (OTSZ, a vonatkozó TvMI) betartani. A tetőn végzett munka magasban végzett munka: leesés elleni védelem kell.

**Képletek**

- `Uoc,string = n · Voc · (1 + β · (T − 25 °C))` — a string üresjárási feszültsége T hőmérsékleten; n a modulok száma, β a Voc hőmérsékleti tényezője (pl. −0,0028 1/K)

**Kidolgozott példa**

12 modul egy stringben, Voc = 37,5 V (25 °C), β = −0,28 %/K. Az inverter legnagyobb DC-feszültsége 600 V. Megfelel-e −10 °C-on?

1. Hőmérséklet-különbség: −10 − 25 = −35 K.
2. Szorzó: 1 + (−0,0028 × −35) = 1 + 0,098 = 1,098.
3. Egy modul: 37,5 × 1,098 ≈ 41,2 V; a string: 12 × 41,2 ≈ 494 V.
4. 494 V < 600 V: megfelel; 14 modulnál ≈ 577 V még igen, 15-nél ≈ 618 V már nem.

→ A 12 modulos string −10 °C-on kb. 494 V, az inverter határa alatt; legfeljebb 14 modul fér egy stringbe.

**Gyakorló feladatok**

1. Miért hidegre kell ellenőrizni a stringfeszültséget, és nem melegre?
   <details><summary>Megoldás</summary>Mert a modul üresjárási feszültsége hidegben a legnagyobb; ha ekkor is az inverter határa alatt marad, mindig alatta marad.</details>
2. Összedugható-e két különböző gyártó MC4-típusú csatlakozója?
   <details><summary>Megoldás</summary>Nem: csak azonos gyártó azonos típusú párja; a vegyes csatlakozás melegszik, ívet húzhat, és a garancia is elvész.</details>
3. Mikor kapcsolható a HMKE a hálózatra?
   <details><summary>Megoldás</summary>Az elosztói engedélyes (áramszolgáltató) engedélye és a mérőcsere után.</details>

**Biztonság**

- A DC-oldal nappal feszültség alatt van, az inverter lekapcsolása után is: a DC-csatlakozót terhelés alatt bontani tilos (ív).
- Tetőn csak leesés elleni védelemmel, és a modulok törött üvege alatt is lehet feszültség.

*Kapcsolódó kártyák:* MSZ HD 60364 sorozat · Kisfeszültségű villamos berendezések, RS-485 · Modbus RTU, 2,4 GHz sáv, Hálózati 50 Hz
