# Personal App v1: what we already own, and two editions

*2026-11-20, cloud session. The Founder asked: take stock of the code we own, then pick the features for a first
personal app (an app that serves one person), in two versions: a **general default** and one **geared to the
Founder** (work and personal). The background reading is
[`docs/research/reports/Personal apps - software for one.md`](../research/reports/Personal%20apps%20-%20software%20for%20one.md).
Nothing here is built or decided yet. Section 5 lists the questions to answer before a WP is written.*

## 0. The short answer

VRG Mobile is already most of a personal app. It has one shell, a feature catalogue as data, 34 features, its own
device trust, self-update and a relay to the PC. What it lacks is the *person*: today every tile serves the VRG work,
and nothing serves the rest of a day. The Varler Console (a PWA with 32 built pages) and the desktop-only tools
(Weather, Map data, MindMap, BRIDGE / Home Assistant references) hold most of the missing everyday pieces.

**Recommendation: make an edition a filter over the same shell, not a new app.** `Catalogue` (kit-core
`Feature.kt`) already carries `group`, `stage` and `needs`. Add an `editions` set to each `FeatureInfo` and a home
layout per edition, and "General" and "Founder" become two views of one APK, one codebase and one update channel.
Give General its own app id only if it is ever handed to someone else (see Q1).

## 1. How to read the lists

| Mark | Status | Meaning |
|---|---|---|
| **L** | LIVE | on the phone, checked by the Founder |
| **B** | BETA | built, waiting for its "Telefonon ellenőrizni" list |
| **C** | Console | built in the Varler Console PWA (`Console/www/js/pages/`); a port, or the PWA inside a confined WebView the way M21 does it |
| **PC** | desktop only | exists in the repo, has no phone surface yet |
| **S** | stub / plan | a manifest, a planned tile or a "Later" item; no logic yet |

Reuse cost: **●** ready as is · **◐** rewire (config, a new data source, a lighter UI) · **○** port or build.

## 2. Inventory: the building blocks we own

### 2.1 Platform: what any personal app needs

| Block | Where | Status | What it gives a personal app |
|---|---|---|---|
| Feature shell + catalogue as data | `kit-core/Feature.kt`, `kit/VrgFeature.kt`, `app/Registry` | L | add a feature = one module + one line; planned tiles show the roadmap |
| Paged home, one-page view, Katalógus | M32, M38 | B | numbered home pages in the owner's order; a guide to every feature |
| Long-press menu (RCO) | M37, `kit/ui/Rco.kt` | B | one context menu across the app |
| Look: Mélyvíz + VRG UI Kit palettes, sizes, fonts | M1, M16, `kit/theme/` | L / B | ten palettes, generated tokens, touch sizes |
| App icon in the owner's palette | M34 | B | identity |
| Settings, start screen, log | M1, `kit-core/LogBook.kt` | L | settings store; a log the owner can read |
| Deep links `vrg://<feature>/…` | `kit-core/Links.kt` | L | every feature reachable from a QR, a note or another app |
| Self-update from GitHub Releases | M9 | L | a new build reaches the phone with no cable |
| Device trust by QR, release lock | M35, `Mobile/trust/devices.json` | B | which phones may run it; no shared passwords |
| Phone key (Keystore P-256) + secret store (Keystore AES) | `kit/relay/PhoneKey`, `kit/github/SecretStore` | L | per-device identity; tokens never in plain storage |
| Sealed data to the phone's key (ECDH + AES-GCM) | M42, `tools/workflow-seal.js` | B | private data can travel through GitHub as ciphertext only |
| GitHub sign-in + shared client (ETag cache, rate limit) | M3, `kit/github/GitHub` | L | a free, versioned backend the owner already has |
| Notes into a branch (outbox, retry, share target) | M6, `kit-core/Notes.kt` | L | the smallest durable write; works offline, sends later |
| Notifications inbox + channels | M10 | B | one list for everything that wants attention |
| HTML apps offline on the phone, one origin each | M21 | B | any of our single-file HTML tools becomes a phone app |
| Confined WebView pattern (allow-list, no file access, FLAG_SECURE) | M18, M43, M45 | B | safe way to host a web app inside the APK |
| iPhone: the online part as a PWA | M36, `Mobile/web/` | B | the same app on iOS without the App Store |
| Agent-made variants by request (GO VARIANT) | M31, `Sketcher/variants/PROTOCOL.md` | B | **the phone asks, an agent builds, the result is one JSON**: the AI-native growth loop |

### 2.2 The PC link

| Block | Where | Status | Use |
|---|---|---|---|
| QR pairing, trusted phone | M2 | L | one scan, then the phone may act on the PC |
| Légegér: gyro mouse, keyboard, touchpad, Bluetooth HID | M0, `airdeck-core` | L | the phone as an input device for any PC |
| Indítópult: START's tools from the phone | M11 | L | run things on the PC |
| Localhost: the PC's servers on the phone | M8 | L | open any local web tool remotely |
| Átadás: files, photos, clipboard both ways | M12 | L | the phone ↔ PC shelf |
| Képernyő: the PC's screen live | M13 | B | look at the PC from the sofa |
| PC ablakok: the work folders, read-only | M23 | B | browse files without the PC in hand |
| Claude: the Claude app + the PC's Remote Control sessions | M22 | B | start and follow Claude Code from the phone |
| Hálózat: tethering, hotspot usage, the phone's own relay | M7, `relay-core` | B | the phone as the network |

### 2.3 Everyday tools (Varler Console, built pages)

Clock and world time, timer / stopwatch / pomodoro, scratchpad notes, to-do list, calendar agenda, sunrise and
sunset, scientific calculator, unit converter, level and inclinometer, compass, sound level meter, media player,
dice, attribute radar, ambient status ring (`widgets-simple.js`, `widgets-device.js`: all **C ●/◐**).

### 2.4 Work (electrician and smart-home installer)

| Feature | Where | Status |
|---|---|---|
| VRG Sketcher: sketch, measurements, notes, scope, questionnaire, camera, site, variants | M24–M31 | B |
| Fotópont: room photos with direction | M25 | B |
| Varler Planner, calculators, Készlet (+ BuildTree, Valena) | M39–M41 via M21 | B |
| Varler Workflow Kit: quote jobs, sealed to the owner's phone | M42 | B |
| VRG Térkép: Hungary in 3D, own places, jobs | M43 | B |
| VRG Időjárás: multi-source forecast, work windows, field alerts | `Weather/` (PC), M44 tile | PC / S |
| Csipogó: crew pager over Bluetooth LE, no internet | M33 | B |
| Field job, measurement log (with the limit table), panel schedule, job materials, site checklist, time tracker, cheat sheets, supplier items, photo inbox | Console pages | C |
| ServiceKit Phone: the phone as the service console of a client PC | `ServiceKitPhone/` | C (APK not built) |
| CoreRef: offline ESPHome / Home Assistant reference | `CoreRef/` | PC |
| Quote view, legal lookup, site survey, network tools, OCR | Console manifests | S |

### 2.5 Following the work and its knowledge

Haladás (branches, commits, CI; **L**), Gömb (Solomon's three signals; **L**), Kódváros online (**B**), Rétegverem
(the Stack in 3D; **B**), Archívum (every page Claude made; **B**), Asztal + Lapok (the Desktop's frame; **B**),
agent trace with "Claude kész / Claude vár rád" pings to the phone (Console `trace/`, M10; **C / B**).

### 2.6 Personal, outside the work

| Feature | Where | Status |
|---|---|---|
| Vault: the encrypted personal data store (Proton Vault) | M45 | B |
| Smart home: energy per phase, presence, Zigbee devices, automations | Console manifests (wait for Home Assistant) | S |
| Dog tracker | Console manifest `dog` | S |
| Personal projects reachable through Localhost / Indítópult once on START: RL-CYD gaming dashboard, MC-Server, FlyBrainLab, GodsEyeView | `H:\Personal\` (outside the repo) | PC, not wired |

## 3. Edition A: General (the default)

*Who it is for:* one person, any trade, no VRG PC and no client data. It has to make sense on its own and install
and work without anything else. *Rule:* nothing in the default needs the relay or a GitHub sign-in. Both are
opt-in packs.

### A1. Always on: the core

| # | Feature | From | Cost | Note |
|---|---|---|---|---|
| 1 | Home: paged, owner-ordered, one-page view | M32, M38 | ● | pages: Ma · Eszközök · Jegyzetek · Beállítások |
| 2 | Katalógus: every feature and what it needs | M38 | ● | filtered to the edition |
| 3 | Look: palettes, size, icon | M1, M16, M34 | ● | |
| 4 | Gyorsjegyzet, **local-first** | M6 | ◐ | keep the outbox; the GitHub branch becomes an optional sync target |
| 5 | Teendők (to-do) + Naptár (agenda) | Console | ◐ | port into one "Ma" (today) page |
| 6 | Időzítő / stopper / pomodoro, Óra | Console | ● | |
| 7 | Értesítések as the one inbox | M10 | ◐ | its sources are the edition's own features, not PR / CI |
| 8 | Sensors: vízmérték, iránytű, zajszint | Console | ● | already offline, no permissions but the microphone |
| 9 | Számológép, mértékegység-átváltó | Console | ● | |
| 10 | Napkelte / napnyugta, időjárás (single source) | Console, `Weather/` | ◐ | the fused forecast is a pack (Founder); default = one open source |
| 11 | Biztonság: device key, secret store, FLAG_SECURE pages | kit | ● | invisible, always there |
| 12 | Export / import of everything as plain files | **new** | ○ | a JSON + media zip; the condition for "nothing is lost when the app is" |

### A2. Opt-in packs

| Pack | Features | Needs |
|---|---|---|
| **Sync** | GitHub sign-in (M3), notes branch (M6), self-update (M9), sealed data (M42 mechanism) | a GitHub account |
| **PC companion** | Pairing (M2), Légegér (M0), Átadás (M12), Localhost (M8), Indítópult (M11), Képernyő (M13), PC ablakok (M23) | the relay on a PC |
| **Field** | Sketcher core (M24) without the electrical fronts, Fotópont (M25), Térkép (M43), Csipogó (M33) | camera / Bluetooth |
| **Web apps** | Alkalmazások (M21): any single-file HTML tool, offline | — |
| **AI** | Claude (M22); **Kérés** (new): a feature request from the phone in the GO VARIANT shape, answered by an agent as a JSON or a WP | Claude Code on a PC or in the cloud |
| **Media** | Médialejátszó, kocka | — |

### A3. What General still lacks (gaps)

1. **Local-first storage** on the phone as the primary copy (today notes and most work data live on GitHub or the PC).
2. **Export / import** (A1 #12).
3. **Onboarding without GitHub**: first start must work with no account.
4. **An edition filter** in `Catalogue` and a home layout per edition.
5. **The request loop for everything**: GO VARIANT generalised from Sketcher variants to "make me a page".

## 4. Edition B: Founder (work and personal)

*Who it is for:* the Founder as an electrician / smart-home installer running a small business, as the developer of
the VRG toolset working through Claude Code, and as a person with a home, a dog and side projects. The personal
interests below are read from traces in the repo (a dog tracker manifest, `H:\Personal\` projects, the Vault).
They are guesses until Q4 is answered.

Home in five pages, in the order of a working day. ★ = on the quick row.

### B1. Ma (today) — the first page

| Feature | From | Status | Cost |
|---|---|---|---|
| ★ Gyorsjegyzet with dictation and tags, local-first + the chat-log branch | M6 | L | ◐ |
| Teendők + Naptár, today's jobs from the Workflow Kit beside them | Console + M42 | C + B | ◐ |
| Időjárás: **work windows** for today's sites (lightning, MEWP gusts, frost for PVC, rain, heat) | `Weather/` + M44 | PC / S | ○ |
| Értesítések: jobs, Claude kész / vár rád, PR / CI, relay | M10 + Console trace | B | ● |
| Napkelte / napnyugta (light left on site) | Console | C | ● |

### B2. Terep (on site)

| Feature | From | Status | Cost |
|---|---|---|---|
| ★ VRG Sketcher with all fronts and variants | M24–M31 | B | ● |
| Fotópont | M25 | B | ● |
| VRG Térkép: jobs, own places, navigation | M43 | B | ● |
| Csipogó: the crew pager | M33 | B | ● |
| Mérési napló (with the limit table), elosztó áramkörjegyzék, helyszíni ellenőrzőlista | Console | C | ◐ |
| Időmérés per job, munka anyaglistája | Console | C | ◐ |
| Kalkulátorok (panel, general, LED) | M40 | B | ● |
| Vízmérték, iránytű, zajszint | Console | C | ● |
| CoreRef offline (ESPHome / Home Assistant) + szakmai puskák | `CoreRef/`, Console | PC / C | ◐ |
| ServiceKit Phone mode for a client's PC | `ServiceKitPhone/` | C | ◐ |

### B3. Iroda (office and quotes)

| Feature | From | Status | Cost |
|---|---|---|---|
| Varler Workflow Kit: where each job stands, totals | M42 | B | ● |
| Varler Planner | M39 | B | ● |
| Készlet + BuildTree + Valena; **barcode scan into Készlet** (M2 scanner + M12) | M41, README "Later" | B / S | ◐ |
| Beszállítói tételek | Console | C | ◐ |
| Árajánlat-gyorsnézet, jogi hivatkozások | Console manifests | S | ○ |

### B4. PC és Claude (the workshop)

| Feature | From | Status | Cost |
|---|---|---|---|
| ★ Claude: Remote Control sessions, start one in a folder | M22 | B | ● |
| **Note → GO prompt** (a note marked as a task becomes a session) | README "Later" | S | ◐ |
| ★ Légegér, Átadás, Indítópult, Localhost, Képernyő, PC ablakok | M0, M8, M11–M13, M23 | L / B | ● |
| Haladás, Gömb, Rétegverem, Kódváros, Archívum | M4, M14, M17, M5, M18 | L / B | ● |
| Agent trace mini (Ügynöknyom) | Console | C | ◐ |
| Hálózat: tethering, hotspot usage | M7 | B | ● |

### B5. Otthon és én (home and me)

| Feature | From | Status | Cost |
|---|---|---|---|
| Vault: personal documents and secrets | M45 | B | ● |
| Okosotthon: energy per phase, presence, Zigbee, automations, from the Founder's own Home Assistant | Console manifests + BRIDGE standards | S | ○ (needs the HA address and a token) |
| Kutyakövető (dog tracker) | Console manifest | S | ○ (needs the tracker: GPS collar, BLE tag or phone-only walk log; Q4) |
| Side projects on the PC: RL-CYD dashboard, MC-Server status / start, FlyBrainLab | Indítópult + Localhost, once they are START entries | PC | ◐ |
| Médialejátszó, pomodoro, világidő | Console | C | ● |

### B6. Out of the Founder edition (kept in the APK, off the home)

Asztal and Lapok (the Desktop frame is heavy for a phone day), Katalógus (the owner knows the app), iPhone web
app (the Founder's phone is Android), the attribute radar and dice.

## 5. Questions before a WP

Asked as numbered options, recommendation first. Answers go into `docs/mobile/DECISIONS.md` as the next D-numbers.

- **Q1 · One app or two?** A: one APK, editions as a catalogue filter (recommended). B: a separate
  `hu.vrg.personal` APK built from the same modules. C: General as a web app only (Console PWA), Founder = VRG Mobile.
- **Q2 · Where the personal data lives first.** A: on the phone (Room / files), GitHub or the Vault as an optional
  sealed sync (recommended: personal data should outlive any service). B: GitHub branch as now. C: the Vault only.
- **Q3 · How the Console pages come over.** A: the Console PWA inside a confined WebView as one feature, pages
  addressed by deep link (fast, recommended for v1). B: port the pages to Kotlin one by one. C: both, WebView first,
  native for the pages used daily.
- **Q4 · The personal side.** Which of these are real needs: the dog tracker (and with what hardware), the smart-home
  pages (is there a Home Assistant at home?), the side projects on the phone, anything else (health, money, family,
  learning)? This list is inferred, not asked.
- **Q5 · The request loop.** Should the phone get a **Kérés** feature: describe a wanted page or feature, it lands
  as a note in the GO VARIANT shape, and a Claude session builds it as a JSON (variants) or a WP?
- **Q6 · Android developer verification (global in 2027).** A: register `hu.vrg.mobile` under the free
  limited-distribution account (no ID, up to 20 devices) once it opens, and back up the release key now
  (recommended: M9's self-update keeps working). B: stay unregistered, install by ADB and the one-time advanced flow.
  C: the $25 full account. Details in the research report, section 5.

## 6. Built so far

- **M46 VRG Füzet** (2026-11-21, BETA): the entry / view / action / rule model as a feature, forked from the Sketcher's
  engine. It covers steps 2 and 5 below in part: the notes, to-dos and open items of a "Ma" page, plus export and
  import. `docs/mobile/WP/M46.md`.

## 7. Suggested order once answered

1. `editions` in `Catalogue` + the per-edition home (small; kit-core test).
2. The "Ma" page: notes + to-do + agenda + notifications.
3. Console pages behind one confined WebView feature (if Q3 = A).
4. Weather M44 with work windows (the fused engine is already built on the PC).
5. Export / import.
6. The personal pages the Founder confirms in Q4.
