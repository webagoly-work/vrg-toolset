# BRIDGE — Session Handover Primer

**Read this first. It is written to be the only thing you need before you can work.**

**Doc:** BRIDGE-PRIMER-001 · 2026-10-05 · for a fresh session continuing this project
**Why it exists:** the previous account hit a weekly limit. Same computer, different account.
Nothing needs downloading or rebuilding.

**Where it is.** BRIDGE lives **inside the `vrg-toolset` repository**, at `<repo>/BRIDGE/`, on
`main`.

**Work in `H:\Dev-VRG\VRG-DE\Planner_VRG_U100`.** That is the live working copy.
`H:\Planner_VRG_U100` is a **backup** that is refreshed from time to time — not a second workspace.
They were accidentally mixed up once and reconciling them took real effort; do not repeat it.
Confirm with `git rev-parse --show-toplevel` if in any doubt. A superseded copy of BRIDGE may also
sit at `H:\Dev-VRG\VRG-DE\BRIDGE` carrying a `_MOVED-TO-REPO.md` marker — not authoritative, safe
to ignore or delete.

Branches: `main` carries BRIDGE · `bridge-docs` was the original import · `planner-circuit-endpoints`
holds the live Planner work · `planner-device-id-repair` is a **stale pointer** sitting behind it.

---

## 1. Your first three minutes

**Read exactly these, in this order, and then start working:**

1. `BRIDGE-OUTLINE-001_General-Outline.md` — the whole system and the P33 instance. **~15 min read.**
2. `05_standards/README.md` — the index, the authority chain, the cross-references that matter.
3. `_build/BRIDGE_infobase.md` **§2 only** — the open-items register by ID.

**Do not read the 01–04 source folders.** They are the historical corpus. It has already been
analysed and distilled into the standards; re-reading it burns a large amount of context and tells
you nothing the standards do not.

**Do not read all eight standards up front.** Open one when the task touches it.

---

## 2. What this project is

A complete design for **BRIDGE**, a smart-home architecture, documented to buildable depth. The user
is an electrician and developer in Hungary who builds Hungarian-UI single-file HTML tools for
electrical planning. BRIDGE is the home-automation architecture he is developing; **P33** is the
first real instance — a two-storey flat.

> **P33 is a client property.** Its documents — blueprints, the electrical plan, the room survey —
> are **excluded from version control** and live only at `BRIDGE/07_P33/` on this PC. The design
> knowledge is generalised into the standards, and `BRIDGE-OUTLINE-001` §4 carries the instance
> de-identified: room geometry without the address. **Keep it that way** — the repo's own rule is
> that client documents stay on this PC, and it exists because quotes and plans carry names and
> addresses.

**The one doctrine everything hangs off:** *manual-first, implemented in hardware.* Every smart
switch routes its load through a **bistable memory element**, fed by both the human's switch and the
wireless side. Every manual action lands; losing the intelligence degrades to a clean manual
circuit. A surprising number of other decisions are downstream of this — including why a slow polled
control bus is acceptable, and why DALI was rejected.

**Four elements:** BASE (NET/COMP/MEDIA) → CHANNEL → ROOMBOX → ARM → ENDPOINT.
**Ten conduit layers, of which only four travel the CHANNEL.** The rest are made at the RoomBox or
run their own route. This is the most commonly misunderstood thing in the design.

---

## 3. State of play

**Nine documents, all current:**

| | |
|---|---|
| `BRIDGE-OUTLINE-001` | the general outline + P33 instance |
| `05_standards/STD-001` **r2** | physical standardisation · **+ Annex A1** passive thermal |
| `STD-002` **r2** | light and scene |
| `STD-003` **r2** | presence and identity |
| `STD-004` **r2** | naming, addressing, BRIDGE_LINK |
| `STD-005` **r2** | network and RF |
| `STD-006` **r2** | arbitration, failure, security |
| `STD-007` **r2** | media and audio |
| `STD-008` **r1** | notification lights |

**188 questions have been asked and answered** across three rounds — 141 design, 47 rooms. The
answers and their consequences are applied into the standards, each change tagged with its question
ID. **Treat the standards as current and authoritative.**

---

## 4. What not to do

This matters more than what to do, because the expensive failure mode here is redoing settled work.

- **Do not re-ask a settled question.** Every decision carries an ID — `A01`–`A08`, `B01`–`B28`,
  `C01`–`C30`, `D01`–`D30`, `E01`–`E11`, `F01`–`F10`, `G01`–`G11`, `H01`–`H12` for design; and the
  P33 round uses `G` `L` `A` `N` `S` `P`. Records: `_build/BRIDGE-A-002_decisions.md` and
  `07_P33/P33-D1.json`. If you want to know why something is the way it is,
  `_build/BRIDGE-E-002_open-items-briefing.md` explains 19 of them at length.
- **Do not re-derive the architecture from the source corpus.** It was done once, carefully, and
  produced findings that are now written down. Three of them were corrections to earlier
  recommendations and are logged as such.
- **Do not propose DALI, per-room battery packs, PoE-powered room switches, layer-in-name ARM
  references, or a chimney above a RoomBox.** Each was considered and rejected for a specific reason
  recorded in the documents. Proposing them again reads as not having read the work.
- **Do not claim verification you did not do.** The user notices, and several documents say plainly
  which figures are reasoned rather than measured.

---

## 5. How the user works

- **Phase big requests and check in midway.** Do not disappear for twenty tool calls. Deliver
  increments and say what is still outstanding.
- **Flag disagreement once, then proceed.** If a decision looks wrong, say so in a sentence or two
  with the reason, then build what was asked under a stated assumption. Do not relitigate.
- **Correct your own errors out loud.** Several documents contain "this reverses my earlier
  recommendation, and here is why." That is the expected behaviour, not a failure.
- **State what is unverified.** Reasoned ≠ measured, and the documents distinguish them.
- **He works on mobile often.** Published Artifacts beat local files when he is away from the
  machine. Note that published pages cannot download files — copy-to-clipboard only.
- **Language:** English for the document set (decided in A03 — *full parallel Hungarian translation
  was chosen*, which is outstanding work). Hungarian for physical things: *Elosztószekrény*,
  *villanyóra*, *spájz*, *szerelvénydoboz*, *előszoba*. He writes to you in English.

**Persona.** He asked for this work to be done as **"Bernard"** — an architect's assistant:
analytical, precise, doctorate-level on home-automation hardware and software (ESPHome, Raspberry/
CM5, ESP modules) and on light-automation, gaffer lighting and colour theory. Measured and a little
formal; penetrating questions; no theatrics. Keep that register.

---

## 6. The interactive tuner

`https://claude.ai/artifact/LRu8Q9GJFkxjH2iyFdzrRx` — a published page with a **pack selector**
carrying two question packs. He answers on his phone and pastes back ~1.2 KB of
`QID=key ~ note` lines. Source on disk: `_tuner/bridge-tuner.html`, `_tuner/BRIDGE-Q-001.json`,
`07_P33/P33-D1.json`.

**To run another round:** write a new pack JSON in the same shape, add it to the `PACKS` array in
the artifact's source, republish to the same URL. One small file, not a new tool. *Note: the
pack-switching code has never been functionally exercised — the browser here cannot reach the
published page.*

---

## 7. Open items, in the order they matter

| | Open | Blocks |
|---|---|---|
| **1** | **Upper floor** — two bedrooms + small hall: areas, lamp counts, and RBX04's class. G07 guessed "a smaller end terminal"; three habitable rooms probably wants **RB-M terminal** | the CHANNEL schedule, RBX04 |
| **2** | **R07 SZOBA's shared wall** — served from RBX01 or RBX02 | the ARM schedule |
| **3** | **G06 wall construction** — answered `?` with an explicit request for **simple visuals of the choices.** He asked for this; it is owed | chase depth, cross-vent, the 110 mm envelope |
| **4** | **C23 / C23B** — which integrated lighting types. Waiting on photographs in `06_reference-images/`, where the index says what to collect | the fixture schedule |
| **5** | **G04 / G05 BASE arrangement** — split or one unit, "modular, depends on available space" | the LAYER TIE |
| **6** | Minor: is there an electric **hob** (S06 omitted it) · **H10** Snapcast placement, *to be measured not argued* · **D9** security provider and whether it can supply `alarm_type` |  |

**The next build document is `P33-BUILD-001`** — the hardware composition. It needs items 1 and 2.

---

## 8. Findings worth knowing before you touch anything

The ones that will otherwise be re-discovered expensively.

- **A passive chimney above a RoomBox cannot work.** The box tops out at 2.3–2.5 m against a 2.7 m
  ceiling — 0.2 Pa of driving pressure. And routing the *intake* downward does not help: **driving
  head comes from the height of the hot column, not total duct length.** Free area is the only lever.
  STD-001 r1's vent figures were ~5× too small.
- **One audio path cannot serve both music and television.** Snapcast's 800 ms buffer is invisible
  for music and ~20× the lip-sync threshold for a picture. Two paths: distributed, and local.
- **A 5.1 amp bay does not fit any RoomBox class.** Multichannel moved to a dedicated AV position.
- **A DALI driver has no bistable**, so manual-first would move into firmware. That — not cost —
  is why DALI is out, and the relay is kept regardless, which forecloses DALI's main benefit anyway.
- **Portal instrumentation beats room sensing.** Instrumenting doorways turns occupancy from a noisy
  per-room estimate into a **constrained graph**, which gives the "graph veto" that cures mmWave
  ghosting. But the chosen P-1 default supplies direction without count, which weakens it —
  **if ghosting appears in commissioning, D01 is the first thing to revisit.**
- **P33's R03 (ÉTKEZŐ) is the articulation point of the house** — half-open to the kitchen, half a
  corridor linking entrance, stairs, living and pantry. It needs two graph zones, a hall's grace
  period rather than a dining room's, and P-3 portal instrumentation; and **the stairway portal is
  the second count anchor** alongside the entry door.

---

## 9. Memory, and the secondary work

**Memory** lives at `C:\Users\webag\.claude\projects\H--\memory\`, indexed by `MEMORY.md`. It is
filesystem-based under the Windows user, so it should carry across accounts on this machine. **If
`MEMORY.md` is empty or missing, this primer replaces it** — and worth writing fresh entries as you
go rather than trying to reconstruct the old ones.

**Secondary work, deliberately kept out of the BRIDGE set** and staged separately in
`_inbox/_staging-secondary/`:

| | |
|---|---|
| **Site Pager** | carried ESP32-S3-Zero + nRF905 pager and relay module, v1→v1.4. *Adjacent to BRIDGE, reference only* — the decision is recorded. A git bundle and zip exist |
| **BRIDGE FX-CORE 01** | a spec page, newest of the three. Not yet integrated or assessed |
| **Macropad Panel Study** | a panel study page |

These share an indicator-language problem with STD-008: the **notification light**, the **Site Pager**
and the **follow pendant** (STD-003 §7.1) all want four RGBW indicators and a vocabulary.
**STD-008 §2 defines that vocabulary — unify against it before building any of the three.**
Three dialects would be the expensive mistake.
