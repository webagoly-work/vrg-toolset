# Field survey: camera and note/intake features (scout notes)

Date read: 2026-11-18. Scout: Akecheta. Question: which CAMERA and NOTES/INTAKE
features of field-documentation apps are worth building into our Android field
tool (Kotlin/Compose, TakePicture intent, offline first, no paid SDK, HU UI).

**Reading limits.** Web search worked; direct page fetch was blocked in this
session (hosts did not resolve), so every claim below comes from search-result
summaries, not from reading the full pages. Vendor pages are marketing. Items
marked (own) are my conclusion, not a source claim. Items marked (unverified)
had no source found.

Constraint that shapes everything (own): with TakePicture intent we do NOT own
the viewfinder. So burst, overlay/ghost, live stamping, live AR are out unless
we later switch to CameraX. Everything below that works AFTER the photo returns
(tag, markup, voice, link to pin, EXIF, OCR) is cheap and fits.

## 1. Camera features (ranked)

Value = for an electrician's one-phone survey. Cost = for us (S/M/L).

| # | Feature | Who has it (source) | Value | Cost | Recommendation |
|---|---|---|---|---|---|
| 1 | Purpose/shot-type tag per photo (e.g. "elosztó nyitva", "mérő") | CompanyCam tags, room tags [1]; Jobber/magicplan notes+labels [5][6] | high | S | build now |
| 2 | Required shot list per job type (checklist; job not "done" until all shots exist) | CompanyCam photo checklists [1]; Jobber checklists with images [5]; SafetyCulture EV survey template [9] | high | S-M | build now (core idea) |
| 3 | Gallery grouped by room/purpose, filter by tag | CompanyCam tag filter [1]; magicplan photos by room [6]; Autodesk tags [4] | high | S | build now |
| 4 | Offline capture + queue, sync later | Fulcrum offline focus [3]; Fieldwire (third-party claim) [2] | high | S (offline is our default) | build now |
| 5 | Link photo to plan location / pin (floor plan or our Planner symbol) | magicplan pins on plan [6]; Fieldwire task pins on plan [2] | high | M (depends on our plan model) | build now if a plan exists, else later |
| 6 | Markup on photo: arrows, circles, text | CompanyCam arrows/measurements/notes [1]; Fieldwire markup, only on photos attached to task/plan/form [2] | high | M (Compose Canvas, save as separate overlay, keep original) | build now (minimal: arrow, circle, text, colour) |
| 7 | Timestamp + GPS stored in EXIF / metadata | Timestamp/GPS camera apps write EXIF and/or burn overlay [7]; Fulcrum geotagged photos [3] | med | S (read EXIF + location at capture, store in DB) | build now, in DB not burned in |
| 8 | Voice note / dictation attached to photo | CompanyCam voice caption (AI to text) [1]; magicplan: none found [6] | high | S-M (Android SpeechRecognizer intent, hu-HU; audio file as fallback) | build now (dictation text); audio file later |
| 9 | Before/after pairing | CompanyCam before/after tool + ghost overlay [1] | low for survey, med for renovation | M (S if only pair-by-tag, L for ghost overlay) | later; pair-by-tag only |
| 10 | Nameplate / label OCR (type plate, meter number) | ML Kit on-device Latin text recognition, offline, bundled model ~260 KB/arch [10]; no field app confirmed having it (unverified) | med-high (meter number, breaker type typed by hand today) | M | later (prototype on one shot type: mérőszám). Check ML Kit licence/terms first [10] |
| 11 | Burn-in stamp on the picture (date/address overlay) | Timestamp Camera family [7] | low (own: DB metadata suffices; burn-in alters the image) | M | skip; optionally stamp on export only |
| 12 | Burst / sequence capture (e.g. up to 10 photos without leaving camera) | Jobber bulk capture, up to 10 [5] | med | L with TakePicture intent (needs own camera) | skip for now; "take another" button as substitute (S) |
| 13 | Video / walkthrough of cable route | EV installer guides recommend a short walk video over many photos [9a] | med | S (CaptureVideo intent) | later |
| 14 | 360 / panorama rooms | magicplan 360 pinned to plan [6] | low (own: sizes, offline cost, needs own camera) | L | skip |
| 15 | Measurement from photo / AR | magicplan builds plans from camera scan (vendor claim) [6] | med | L (ARCore; many cheap phones unsupported) | skip; manual measure notes + "length" field per pin |
| 16 | Privacy: blur faces / house numbers | no source found for the apps above (unverified) | med (own: client homes) | M | later; at minimum a "contains personal data" flag and strip GPS on export |

Notes on the table.
- CompanyCam description (tags, arrows, measurements, before/after, voice, checklists) comes from search summaries of CompanyCam pages [1]; plan tiers vary by source, do not rely on price.
- Fieldwire: a photo uploaded straight to the Photos tab cannot be marked up; it must belong to a task, plan or form [2]. (own) Design lesson: every photo should belong to a survey item, which also makes markup and pinning free.
- Jobber's "up to 10 photos in a row" is from its help centre summary [5].
- Procore / Raken / PlanGrid: search returned only comparison pages; Autodesk Build/Forma auto-tagging and issue-linked photos [4]; nothing confirmed on Raken daily-log photos or Procore albums. Not used for ranking.
- SiteCam / SiteCapture: not found in this pass (unverified).

## 2. Notes and client-intake features (ranked)

| # | Feature | Who has it (source) | Value | Cost | Recommendation |
|---|---|---|---|---|---|
| 1 | Checklist per job type (checkbox, dropdown, short/long text, photo, signature) | Jobber checklists [5]; magicplan forms [6]; ServiceTitan smart forms [8]; GoCanvas [11] | high | M (JSON template + generic renderer) | build now |
| 2 | Quick tag/answer chips (single/multi choice instead of typing) | magicplan dropdown/multi-select fields [6]; Jobber dropdowns [5] | high | S | build now |
| 3 | Conditional questions (skip logic), e.g. "EV töltő? -> parkolóhely távolsága" | Fulcrum conditional logic [3]; GoCanvas conditions incl. contains/blank [11] | high | M (simple rule: show if field X = value) | build now, simple `showIf` only |
| 4 | Voice dictation into any text field | CompanyCam voice [1] | high | S (keyboard mic already works; add a mic button via RecognizerIntent) | build now |
| 5 | Structured client-needs capture (what they want, per room) | magicplan custom fields/notes per room [6]; Jobber job-level custom fields e.g. panel size, service voltage (secondary source) [5b] | high | M | build now (per-room list of "igény" items with category) |
| 6 | Job-scope categories (új kiépítés / csere / bővítés / javítás / hibakeresés / felülvizsgálat) | ServiceTitan/Jobber job types (general) [8] | med-high | S | build now (one enum, drives which template loads) |
| 7 | Existing-installation facts as typed fields (fázis, főbiztosíték A, mérő gyártó/szám, FI-relé van/nincs, földelés TN/TT) | EV survey templates ask supply/earthing/fuse [9]; EICR guides [12] | high | S (part of templates) | build now |
| 8 | Budget / deadline capture (keret, határidő, rugalmas?) | generic; no electrician-app source found (unverified) | med | S | build now (3 fields) |
| 9 | Signature (ügyfél aláírás: felmérés átvétele / hozzájárulás fotózáshoz) | Jobber [5]; magicplan forms [6] | med | M (Compose canvas to PNG) | later |
| 10 | Follow-up questions / open-items list ("még kérdezni: ...") | (own) not found as a named feature; Fieldwire tasks on plan is nearest [2] | med-high | S | build now (flag any answer "Tisztázandó", list at the end) |
| 11 | Report/export (PDF or share of photos + answers) | magicplan reports [6]; CompanyCam reports [1] | high later | M-L | later; first export plain text/ZIP |
| 12 | Prefilled/auto-populated fields (customer, date, address) | ServiceTitan smart forms auto-populate [8] | low | S | skip until a client record exists |

## 3. Required photos per job type

Honest source status: UK sources are concrete for consumer unit/meter/EV. The
Hungarian meter-location documents are about what the registered installer must
BUILD and hand over, not about survey photos; no HU document with a photo list
was found. HU photo requirements for MVM/E.ON: not confirmed, ask the DSO.
The lists below are our proposal (own) grounded in the cited items; "(S: n)" = source.

**Rule set for all lists (own):** each required shot has an id, a Hungarian label,
a "why" hint line, and may be marked "nem releváns" with a reason (no silent skip).

### 3.1 General survey (all jobs)
1. Building front/entrance (context; ensures right address, mind house number privacy).
2. Each room in scope: one wide shot from the door, one per wall that has work.
3. Access/obstacles: attic hatch, cellar, riser, gate, parking.
4. Any visible hazard (burn marks, exposed wires, wet area). (S: EICR guides list burn marks near consumer unit/meter [12])
5. Walking video of the proposed cable route when it is long (S: [9a]).

### 3.2 Meter / connection point (mérőhely, csatlakozási pont)
1. Meter cabinet closed, wide, showing surroundings and access (S: UK guides want the meter box photo to show supply type and capacity [9a]).
2. Cabinet open: meter, main fuse/cut-out, tails. (S: UK sequence consumer unit front, inside, cut-out label, meter tails, earth terminal [12])
3. Meter label close-up: serial number, type (OCR candidate; own).
4. Main fuse/cut-out label (rating in A).
5. Incoming service: overhead (légvezeték) or underground (földkábel) and where it enters. (own; HU documents mark the connection point CSP, branch point LÁ and meter location MH on the site plan [13])
6. Seals/plombák intact (own).
HU context: MEE VET "mérőhelyi ellenőrző lista" requirements and the 2025 meter-cabinet modernisation process exist for registered installers [13][14]; read them before fixing the HU template.

### 3.3 Consumer unit / elosztó
1. Front closed, with the room around it (access, clearance from storage; S: EICR checklist item "free from storage" [12]).
2. Open, cover off if allowed, all devices visible and sharp enough to read labels.
3. Circuit chart/labelling (S: check that chart matches breakers [12]).
4. RCD/FI-relé label (30 mA presence; S: [12]).
5. Earth terminal and bonding clamps (water/gas bond; S: UK pre-survey forms ask for evidence of water and gas/oil bonding [9]). HU equivalent: védővezető, EPH/egyenpotenciálra hozás (own).
6. Free DIN space (spare ways) shot, ruler or finger count in frame (S: photos show available space and existing protection [9a]).
7. Previous inspection/stickers or labels (S: [12]).

### 3.4 Bathroom (fürdőszoba)
(own; no source with a bathroom photo list found)
1. Wide from door; zones around bath/shower visible.
2. Each wall with sockets/switches/lights; ceiling light positions.
3. Existing FI/RCD protection of the circuit (note, link to the elosztó photo).
4. Ventilator and heated floor/towel rail points.
5. Equipotential bonding visible at pipes/bath if accessible.

### 3.5 Kitchen (konyha)
(own)
1. Wide shot each wall; planned appliance positions marked with arrows (markup).
2. Existing sockets above worktop and behind appliances.
3. Oven/hob feed: cable/outlet, rating plate if visible.
4. Wall construction clue: tile, plasterboard, brick (for chase decisions).
5. Where the dedicated circuit would run back to the elosztó.

### 3.6 EV charger (e-autó töltő)
(S: SafetyCulture EV site survey records incoming supply, metering, earthing and photos of charger location, fuse board, cutting loop, meter [9]; installer guides name consumer unit, meter box, charger location and cable route as the key photos [9a])
1. Proposed charger position, wide, plus close shot of wall/post.
2. Parking place with the car's charging port side (own).
3. Consumer unit front and open (see 3.3).
4. Meter and main fuse (see 3.2).
5. Earthing/bonding evidence (S: [9]); for TN-C-S (PME) UK forms add precautions [9]; HU: earthing system TN-C-S/TT must be noted (own).
6. Cable route: start-to-end photos, wall/floor penetrations, trench path; or walk video (S: [9a]).
7. Distance elosztó -> charger: measure and write in a field (own).
8. Network/WiFi signal at the charger place (own; many chargers want connectivity).
9. Society/condominium: written consent of owner/közös képviselő, separate metering (S: E.ON article mentions separately billed home charging in társasház [15]).

### 3.7 Solar / HMKE (napelem, háztartási méretű kiserőmű)
(HMKE = household-size small power plant per Energiaklub document [16]; S: solar survey starts with on-site survey and annual consumption [15].)
1. Roof: each pitch, material, condition, orientation (compass note) (own).
2. Shading sources: trees, chimneys, neighbours (own).
3. Meter cabinet and main fuse (see 3.2): phase count and A rating limit the system size (own).
4. Consumer unit with free space for inverter AC protection (own).
5. Inverter/battery location, wall, ventilation (own).
6. DC cable route: roof entry, attic, to inverter (own).
7. Last 12 months electricity bills (photo of the bill: total kWh only, hide name/address) (own).
HU: grid-connection steps and meter photo rules by DSO not confirmed.

### 3.8 Renovation / existing installation (felújítás, meglévő hálózat)
(S: EICR scope covers final circuits, consumer unit, protective devices, service head/earthing and bonding; appliances are out of scope [12])
1. Consumer unit (3.3) and meter (3.2).
2. Every socket/switch type: representative shot per room (aluminium vs copper unknown; open one box if allowed) (own).
3. Visible wiring type/age: old cloth/PVC, junction boxes, surface cables (own).
4. Any previous inspection report, certificate sticker (S: [12]).
5. Known-fault evidence (tripping, burning smell) with note (S: [12]).
6. Walls/ceilings to be opened: construction type, tile, plaster (own).
7. Gas/water/heating pipe positions near planned routes (own).

## 4. Starter intake questions (per job type)

Each question: 2-5 chips (Hungarian). "Egyéb" always allowed with free text/dictation.
Source status: these are our starter set (own) built from the cited survey forms
(EV [9], EICR [12], solar [15]); no source gives a complete HU question list.

### 4.0 Every job
- Mi a kérés lényege? Új kiépítés / Csere / Bővítés / Javítás-hibakeresés / Felülvizsgálat
- Ki fér hozzá az ingatlanhoz? Tulajdonos / Bérlő / Közös képviselő / Kulcs külön egyeztetve
- Mikorra kell? Sürgős (napokon belül) / 1 hónapon belül / Rugalmas / Konkrét dátum
- Van költségkeret? Nincs / Max ... Ft (szám) / Árajánlat után döntünk
- Lakott közben a munka? Igen / Nem / Részben
- Fényképezhetünk? Igen / Csak a villamos részt / Nem
- Van régi dokumentáció (tervek, jegyzőkönyv)? Igen / Nincs / Keresik

### 4.1 Meglévő hálózat / felújítás
- Mikor készült a hálózat? 1970 előtt / 1970-1990 / 1990-2010 / 2010 után / Nem tudja
- Vezeték anyaga? Alumínium / Réz / Vegyes / Nem tudni
- Van FI-relé (életvédelmi)? Van / Nincs / Nem tudja
- Biztosíték típusa? Olvadóbetétes / Kismegszakító / Vegyes
- Volt már gond? Leold a FI / Szikrázik, ég szag / Melegedő aljzat / Nincs (S: warning signs list [12])
- Volt-e utolsó érintésvédelmi/felülvizsgálat? Éven belül / 1-5 éve / 5+ éve / Soha, nem tudja (S: [12])

### 4.2 Mérőhely / teljesítménybővítés
- Fázisszám most? 1 fázis / 3 fázis / Nem tudja
- Főbiztosíték? 1x25 A / 3x25 A / Más (A) / Nem tudja
- Mérő helye? Épületen belül / Kerítésnél / Tartóoszlopon / Nem tudom
- Bekötés? Légvezeték / Földkábel / Nem látszik
- Tervezett új fogyasztó? Töltő / Hőszivattyú / Napelem / Indukciós főzőlap / Légkondi
- Mérőszekrény állapota? Rendben / Törött-rozsdás / Nincs hely / Plombált, nem hozzáférhető

### 4.3 Elosztó / fogyasztásmérő utáni rész
- Szabad hely az elosztóban? Van (hány modul) / Tele van / Nem tudja
- Felirat/áramköri lista? Van, naprakész / Van, hiányos / Nincs
- Fém vagy műanyag szekrény? Műanyag / Fém / Nem látszik
- Földelés ismert? TN-C-S / TT / Nem tudja (S: earthing arrangement is a standard survey item [9])
- Kell új elosztó? Igen / Csak bővítés / Nem tudom, dönts te

### 4.4 Fürdőszoba / konyha
- Mit szeretne? Új lámpák / Új aljzatok / Gépek bekötése / Padlófűtés / Szellőző
- Gépek? Mosógép / Mosogatógép / Sütő / Főzőlap / Bojler
- Főzőlap típusa? Gáz / Villany / Indukció / Még nincs döntés
- Csempézés? Már kész / Még nem kész / Nem lesz / Nem tudja
- Bekötési hely felirat? Már megvan / Szerelő jelöli ki / Tervező adja

### 4.5 EV töltő
- Autó típusa és töltési teljesítménye (AC)? 3,7 kW / 7,4 kW (1f) / 11 kW (3f) / 22 kW / Nem tudja
- Töltő teljesítménye, amit szeretne? 3,7 / 7,4 / 11 / Szerelő javasoljon
- Parkoló helye? Garázs / Kocsibeálló / Utcafront / Társasházi mélygarázs
- Távolság az elosztótól? <5 m / 5-15 m / 15-30 m / 30+ m
- Okos funkció? Alap / Napelemes (PV) vezérlés / Terheléskezelés / Nem érdekli
- Megvan a tulajdonosi/közös képviselői hozzájárulás? Igen / Kell kérni / Nem szükséges / Nem tudja (S: társasház case [15])
- Van WiFi a parkolónál? Jó / Gyenge / Nincs

### 4.6 Napelem / HMKE
- Éves fogyasztás? <2500 kWh / 2500-5000 / 5000-8000 / 8000+ (S: size is derived from annual consumption [15])
- Tető? Cserép / Lemez / Lapostető / Egyéb
- Tájolás? Dél / Kelet-nyugat / Egyéb / Nem tudja
- Akkumulátor? Igen / Később / Nem
- Meglévő napelem? Nincs / Van, bővítenék / Van, hibás
- Hálózatüzemeltetői ügyintézés kell? Igen, kérem / Már elindult / Magam intézem

## 5. Build-now shortlist (own conclusion)

1. Survey item = (job type template) -> (required shot or question) -> answer + photos. Photo belongs to an item.
2. Tag per photo from template (feature 1.1, 1.2, 1.3).
3. EXIF/GPS/time into the DB at capture; no burn-in (1.7).
4. Minimal markup overlay with arrow/circle/text, original untouched (1.6).
5. Dictation button on every text field and photo caption (1.8, 2.4).
6. JSON templates per job type with chips and simple `showIf` (2.1-2.3, 2.7).
7. "Tisztázandó" flag and open-items list (2.10).
8. Link item to a plan pin when the plan model allows (1.5).
Later: OCR for mérőszám (needs licence check), signature, export report, pair-by-tag before/after, privacy flag.
Skip: burst, 360, AR, burn-in stamps.

## 6. Sources (read 2026-11-18 via search summaries unless noted)

[1] CompanyCam: beginner guide https://www.companycam.com/blog/beginners-guide-to-companycam ; advanced features https://companycam.com/blog/work-smarter-with-these-advanced-companycam-features ; May 2024 newsletter https://companycam.com/resources/blog/may-2024-newsletter ; training page https://training.wgrestoration.com/pages/companycam
[2] Fieldwire help https://help.fieldwire.com/hc/en-us/articles/360049713811 and https://help.fieldwire.com/hc/en-us/articles/211358926 ; offline claim is third-party: https://librecam.pages.dev/compare/best-offline-construction-apps (promotional, low trust)
[3] Fulcrum https://www.fulcrumapp.com/ and https://fulcrumapp.com/platform/
[4] Autodesk Build/Forma tags (secondary): https://www.drawboard.com/blog/best-procore-alternatives and https://gitnux.org/best/construction-photo-documentation-software/
[5] Jobber help (checklists, images, signatures; bulk photos) https://help.getjobber.com/hc/en-us/articles/115009740048 ; https://www.getjobber.com/?p=825 ; [5b] job custom fields (vendor review, secondary) https://fieldservicesoftware.io/best-software-for-electrical-services-field-service-companies/
[6] magicplan: https://magicplan.app/visual-documentation , https://magicplan.app/product/notes , https://magicplan.app/product/forms , https://help.magicplan.app/magicplans-enhanced-photo-features
[7] Timestamp/GPS camera listings (self-reported): https://apps.apple.com/us/app/id6760161417 , https://mwm.ai/apps/gps-camera-timestamp-map/6787955697 , https://mwm.ai/apps/gps-camera-timestamp-geo-tag/6788018751 . Open Camera: not confirmed.
[8] ServiceTitan smart forms: https://www.servicetitan.com/templates/electrical , https://www.servicetitan.com/blog/electrical-forms . Tradify: no feature docs found; only https://www.tradifyhq.com/blog/eicr-checklist-for-electricians (not read).
[9] EV survey templates: SafetyCulture https://safetyculture.com/library/energy-and-utilities/ev-site-survey-ykxtk0dwqvowqyfz ; https://safetyculture.com/library/energy-and-utilities/see-services-ltd-electric-vehicle-charge-point-pre-installation-survey-8snr4vdybcdgedos ; Jotform pre-survey https://form.jotform.com/202746204186352 ; Andersen https://support.andersen-ev.com/help-centre/articles/surveys/what-information-do-i-need-to-provide-during-the-survey ; Octopus/Cord self-survey https://www.cord-ev.com/halfords/knowledge-base/guide-to-completing-a-virtual-self-home-survey.html
[9a] Installer guides (photo set, cable-route video): https://site-evtariff-co-uk.pages.dev/blog/how-to-install-home-ev-charger-uk/ ; https://professional-electrician.com/?p=31913 ; https://sagnikbhattacharya.com/blog/ev-charger-site-survey-checklist-ai (secondary; not fully read)
[10] ML Kit text recognition (Android, Latin, on-device) https://developers.google.com/ml-kit/vision/text-recognition/v2/android ; pricing/licence not verified
[11] GoCanvas conditions https://help.gocanvas.com/hc/en-us/articles/26429701985431
[12] EICR/photo guidance (vendor and training sites; not BS 7671 text): https://certbox.pages.dev/guides/eicr-inspection-checklist/ ; https://www.aspect.co.uk/blog/electrical-safety-check/ ; https://squote.app/knowledge/electrical/inspection-checklist ; https://www.newham.gov.uk/downloads/file/848/visualelectricalchecklist . Verify against BS 7671 and Electrical Safety First guide before treating as normative.
[13] MEE VET mérőhelyi ellenőrző lista (2023-04-26) https://elektrotanya.com/sites/default/files/comment/2023/08/merohelyi_ellenorzo_lista_check_lista_kovetelmenyrendszere_regisztralt_szerelok_reszere_2023.04.26.pdf ; UT 347 2. melléklet https://elektrotanya.com/sites/default/files/comment/2023/08/ut-347_2._sz._melleklet_v02_-_felhasznalasi_hely_felulvizsgalati_adatlap_bekapcsolashoz_tobbletigenyhez_2023.03.21.pdf ; E-közmű helyszínrajz leírás https://www.meevet.mee.hu/img/uploads/5/Helyszinrajz_keszitese_E_koezmuvel_Leiras_11_14.docx (PDFs/DOCX not opened; from search summary)
[14] Társasházi mérőszekrény korszerűsítés (rev 2025-06-16) https://www.meevet.mee.hu/kcfinder/upload/files/merohelyi-ellenorzo-lista-kovetelmenyrendszere/t-rsash-zi-m-r-szekr-nyek-korszer-s-t-si-folyamata-s-alapelvei-rev2025-06-16.pdf
[15] E.ON/Fronius HU solar and charging article https://www.fronius.com/hu-hu/hungary/napenergia/rolunk/hirek/kifizetd-elektromobilits-01062023 (the E.ON-based text; summary only)
[16] Energiaklub HMKE definition https://energiaklub.hu/files/article/0826_plug-in%20solar_javaslatcsomag_egyeztetesi_anyag.pdf

## 7. Not confirmed

- Page contents were not read in full (fetch blocked); all claims from search summaries.
- SiteCam/SiteCapture, Raken, Procore photo albums, PlanGrid specifics: nothing usable.
- Open Camera geotag behaviour: not confirmed.
- Any HU document that lists required meter-location PHOTOS (MVM/E.ON): none found; ask the DSO.
- magicplan voice notes: none found.
- ML Kit "free" licence terms and Hungarian label accuracy: not verified.
- Tradify forms/custom fields: not found.
