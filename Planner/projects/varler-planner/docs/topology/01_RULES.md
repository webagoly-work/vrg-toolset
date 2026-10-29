# Topology View: the hard rules (basic version, traditional erősáram), r2

*One numbered list, so specs, checks and the "Miért?" column can cite a rule by id.*

*The prefixes:*
- **PR**: path graph;
- **TR**: topology;
- **SR**: sharing;
- **CK**: checks.

*The **Status** column says who keeps each rule today:*
- **built**: enforced by code on `main`, named;
- **TV**: this pack adds it (the WP is named);
- **G<n>**: the engine cannot follow it yet (`02_ENGINE_GAPS.md`). The view lets the user set it, and CK-14 says so.

*⚑ marks a value that needs the user's trade confirmation (checkpoint TV3). A rule with a `Q-TVxx` builds that
question's recommended option unless README §9 says otherwise.*

---

## §1 Elements and their roles

| Role | Planner object | Symbol (`fig/`) | Can be |
|---|---|---|---|
| **Root** `B` | the level's `board`: the Elosztó, or the Alosztó (E6) on an upper level | dark bar | the root of every `up` chain on its level |
| **Mid** `M` | a junction: szobadoboz (`jb:'szoba'`, 150 / 200), kötődoboz (`jb:'kot'`, 100), ceiling (`jb:'ceiling'`, ⌀80), RBX, BASE; and the **door L4** (`up.id` = a door, derived, not a device) | orange square | a pass-through, a split point, a **master** (betáp pont), a **hub** |
| **Endpoint** `E` | a device whose `epCodeOf` is `SOC` · `DED` · `LMP` · `SWI` | circle · diamond · ⊗ · square | a member of **exactly one** circuit |
| *(skipped)* | `SHU` redőny, BRIDGE codes, hardware | — | not in the basic version (MP-18, audit Q3) |

- A mid is **never** a circuit endpoint (05j `cktCanJoin`).
- A switch is a member of the lighting circuit of the lamps it controls.
- **A wall is crossed only at a service point:** the board, a door L4, a szobadoboz, RBX or BASE (`spDevs`, plan.js:19).
  A plain kötődoboz is **not** a crossing, and stays that way under G1.

## §2 The three graphs

| | Graph | Source | Status |
|---|---|---|---|
| GP | **pálya-gráf**: anchors and the wall sections between them | `BL.network.build` contracted onto the anchors | TV1 |
| T | **betáp-fa**: one upstream per node, `d.up = {id, room?, via?, fix?}` | 08od (GO WIRE T1); `d.lead` (T3); `lamp.meet` (E3); `sw.ctl` / `grp` / `swHead` (E1) | **built** |
| S | **csőközösség**: per stretch, the circuits and the pipes | the engine's run `BL_LAST.R` | **built** (engine); shown by TV9 / TV10 |

- A **link** is one `up` edge, child → parent. In the view a link is one line; on the blueprint it is the wall path the
  engine found for it.
- **The link kind is derived** (`tvKind`, README §2). It is never stored.

---

## §3 PR: the path graph

| Id | Rule | Status |
|---|---|---|
| PR-1 | GP is the engine's wall-face network **contracted onto anchors**. An anchor is the board, every mid, and every endpoint's **drop point**. Ceiling lamps anchor at the end of their Mennyezeti út; floor devices at their Padló út. | TV1 |
| PR-2 | An edge joins two anchors when a face path between them **passes no other anchor**. It carries the geometric length (`geo`, T0-1), the rooms, the walls, the crossing service point if any, and the surface class (marked / előnyben / minus / unmarked). | TV1 |
| PR-3 | A wall is crossed only at a service point: there is no edge through a wall anywhere else. | **built** (network.js) |
| PR-4 | Marks: ban = no edge; minus ×2; előnyben ×0,5 (it opens an unmarked face, Q-T0-3 A); unmarked ×4, fallback only. A GP edge that uses an unmarked face is `soft` and always reported (CK-6). | **built** (T0-3; network.js :84–91). Leftovers MP-4 (circle / ceiling / later padlófűtés bans), MP-5 (a wall inside a room) |
| PR-5 | A Mennyezeti út between two routable walls = a ceiling crossing edge; a Padló út = a floor edge. | **built** (E5-Q9, 08ob) |
| PR-6 | **Connectable** = there is a GP path to the level's root. Otherwise the anchor is **unreachable** (CK-2): the user's "geometric proof", shown before any circuit exists. | TV1; the engine's `R.unreached` is the same verdict after a run |
| PR-7 | GP is per level. An Alosztó's root links down through its feeder only (E6). | **built** (E6); TV1 draws it |
| PR-8 | GP is a pure function of `blInput(level).sig`, cached on it, never stored. | TV1 |

## §4 TR-G: topology, general

| Id | Rule | Status |
|---|---|---|
| TR-G1 | Exactly one upstream per node; no loop; same level; the board is the root. | **built**: `upSet` refuses with a Hungarian reason; `upCheck` flags a loop loaded from a file |
| TR-G2 | Every endpoint on the level is in exactly one circuit. An `up` chain stays inside its circuit until a mid or the board. | **built**: 05j; `upCheck` "lánc másik körbe"; the engine warns per member (plan.js §7) |
| TR-G3 | A mid with no child in the tree is a **dead end**. A cable does not end in a box. | TV3 (CK-5) |
| TR-G4 | The legal child → parent pairs are the table in README §2. Any other pair is CK-11. | TV3 |
| TR-G5 | A link the walls cannot carry stays as drawn, in red. The engine never invents another one. | **built**: `fromTree` `treeBad` errors, then the nearest-rule fallback (plan.js :120–133); TV shows both |
| TR-G6 | `up.fix` (rögzített) is never changed by a suggestion. | **built**: `upFill` skips `fix` |
| TR-G7 | `up.via` names a drawn path (ARM / channel) preferred for that link, at ×0,25, never through a ban. Forcing a link **through a box** is done by making the box its parent (G1) or by `tpoRole:'must'` (G4), not by `via`. | **built** (T6); G1, G4 |

## §5 Circuit patterns (`fig/03`)

`tvPattern(c)` is **derived** from `CPR_CAT[c.preset].kind`, the members' codes and the links. It is never stored.

### TR-D: Dedikált (P1)

| Id | Rule | Status |
|---|---|---|
| TR-D1 | Exactly one endpoint; its `up` is the board. | **built** (T1 auto-fill; the engine's home run) |
| TR-D2 | The cable is continuous. It may pass by or through a box but is never spliced there. | **built** implicitly (the engine has no splice); TV3 CK-8 flags a DED whose `up` is not the board |

### TR-S: Dugaljkör (P2, P4)

| Id | Rule | Status |
|---|---|---|
| TR-S1 | Shape: (a mid →) **leader** → socket → … → **tail**. The leader is `upRole` 'leader'. | **built** |
| TR-S2 | Default = the classic chain: the leader hangs on the door's L4 or on the board, **never on a szobadoboz** (08n, GO WIRE Q5). A **user-linked** KD / szobadoboz master for sockets is allowed (Q-TV03 A). | **built** for the default (`ldChains` :37–42). The user link: TV5 stores it; the engine needs **G1** (KD) and an `ldChains` exception for a fixed leader → szobadoboz link |
| TR-S3 | Order: the leader is the clicked 📍 `d.lead`, or the drop nearest its feed. Each next socket is the nearest unvisited one **along the routable walls**. A hand reorder sets `fix`. | **built** (`ldChains`, the `rgChain` rule) |
| TR-S4 | Branching: a branch is two nodes with the same `up`. Built: allowed at any node. Basic-version rule (Q-TV11 A): **allowed, and noted** when the branching node is a socket (CK-9, info). | **built** (`bflClick`); TV3 (CK-9) |
| TR-S5 | A chain hop is riser up → along beside the gerinc → riser down, socket box to socket box, with **no leállás box** (the user's "arcs", Q-TV02 A). | **G6** |

### TR-L: Világítás and switching (P3; `fig/05`)

| Id | Rule | Status |
|---|---|---|
| TR-L1 | A switching group is chained (`SWI.up` = the previous switch, `LMP.up` = the tail switch) or a star (every switch and the first lamp have `up` = one hub). The logic is **read from `up`**; there is no extra field (Q-TV17 A). | TV7 writes it. The engine today: switch boxes fed from their service point, travellers switch → switch, lamp leg from the head or the meet box (plan.js :255–300). A true star = **G3** |
| TR-L2 | A group = E1's lamp leg (`grp`) with the switches whose `ctl` names it; the leader switch = `swHead`. | **built** (08l) |
| TR-L3 | The meeting box of a group: the user's `lamp.meet` → `jbMeet` (the room's szobadoboz, else the switch's portal box) → the head switch box. | **built** (E3, the engine reads `meet`, T2) |
| TR-L4 | Star is **suggested** when ≥ 2 switches of a group stand at one door's slots, and chain otherwise (Q-TV06 A). | TV7 / TV8 |
| TR-L5 | Ceiling lamps follow the `up` order (chain or star); a drawn Mennyezeti út replaces the leg. | **built** (T2, 08ob `blShapeLines`) |

### TR-W: Switch logic, wires, cables (⚑ checkpoint TV3)

| Id | Rule | Status |
|---|---|---|
| TR-W1 | Types: 1 switch, 1 leg = **101**; 1 switch, 2 legs = **105**; 2 switches = **106 + 106**; n ≥ 3 = **106 + (n−2) × 107 + 106**. `typeFix` wins. | **built** (`lswType`, `lswRetypeAll`) |
| TR-W2 | Phase reconnect: `Lk` meets N + PE again and leaves as 3-core toward the lamps. In a star this happens in the hub; in a chain, in the tail switch box, so N + PE pass through the switch boxes (Q-TV05 A ⚑). | chain: as the engine routes today; star: **G3** |
| TR-W3 | Cores per link ⚑: the table below. | chain rows = today's engine (plan.js :261–269, travellers 4×1,5); star rows = **G3**; the csillár riser to ceiling lamps = 4-core, **G3** (MP-12) |
| TR-W4 | Cable = the smallest NYM-J n × 1,5 with n ≥ cores; more than 5 → one cable per switch. | **built** (`byCores`, plan.js :266) |

| Link | Chain | Star |
|---|---|---|
| master → leader switch / master → hub | L · N · PE → **3×1,5** | L · N · PE → **3×1,5** |
| switch ↔ switch (106 ↔ 106 / 107) | T1 · T2 · N · PE → **4×1,5** | — |
| hub → 106 (first) | — | L · T1 · T2 · PE → **4×1,5** |
| hub → 107 | — | T1 · T2 · T1′ · T2′ · PE → **5×1,5** |
| hub → 106 (last) | — | T1′ · T2′ · `Lk` · PE → **4×1,5** |
| hub → 101 egypólusú | — | L · `Lk` · PE → **3×1,5** |
| tail switch → lamp / hub → lamp | `Lk` · N · PE → **3×1,5** | `Lk` · N · PE → **3×1,5** |
| 105 csillár → first ceiling lamp | `Lk1` · `Lk2` · N · PE → **4×1,5** (MP-12) | same |
| lamp → lamp | `Lk` · N · PE → **3×1,5** | same |

### TR-H: Ház-füzér (V1 house string; `fig/03` P3)

| Id | Rule | Status |
|---|---|---|
| TR-H1 | Shape: board → M1 → M2 → … → Mn, each `Mi.up` = the previous mid. String links join mids only; a mid may branch the string. | TV5 draws it (`upSet` accepts junction → junction). The engine routes each hub's home run from the board: **G2** |
| TR-H2 | Every mid the string touches becomes a **betáp point**: the default meeting box for the groups of the rooms it serves. | TV8 suggests `lamp.meet` = that mid; the engine honours `meet` (**built**, T2) |
| TR-H3 | The string keeps **its own conduit** (`c.ownPipe`, Q-TV07 A). | TV5 stores it; the engine: **G2** |
| TR-H4 | The suggested string order is the trunk order: a DFS of the board's shortest-path tree over the mids the string must touch. | TV8 |

---

## §6 SR: sharing, departures, conduits (`fig/06`)

| Id | Rule | Status |
|---|---|---|
| SR-1 | Each link gets one shortest path in the wall graph, in a stable order (circuit, depth, id). A light congestion term spreads the home runs. Lengths are geometric. | **built** (T2; `cfg.congest` 0,05 in the Planner) |
| SR-2 | A **run** is a stretch carrying the same set of circuits. A circuit may leave or join a run **only inside a box**. A boundary with no box is a departure without a box (CK-7) and gets a suggested KD. | **G4** (today a mid-wall split gets no box and no message) |
| SR-3 | KD roles (`d.tpoRole`): see the table below. | TV5 stores it; the engine: **G4** |
| SR-4 | Packing per pipe: In ≤ Iz · k(n); a 1,5 mm² cable with at most one other circuit; ≤ 3 cables; the strongest first. `ownPipe` alone. | **built** for the trunk (`pack`, plan.js :363); distribution = **G5** (Q-TV15); `ownPipe` = **G2** |
| SR-5 | Sizing: 1 cable needs ID ≥ 1,4 × OD; more cables need fill ≤ 40 %, or ≤ 33 % over 10 m. | **built** (`sizeConduit`) |
| SR-6 | More than 3 corners on a pipe → a pull box. There are no plain corner boxes (E5-Q4 B). | **built** |
| SR-7 | A stretch's result: circuits, cables, pipes (count × size, fill, k, ok). The pipe count side by side is the chase width. | **built** in `R.spans` / the report; TV10 shows it per GP edge |
| SR-8 | Heights are the engine's (ceiling − 250 / − 150, R4). The topology decides who connects to whom, not at what height. | **built** |

| Role | Meaning |
|---|---|
| none | **átmenő** (pass-through): the run passes **by** the box |
| `pref` | **preferált**: a departure within **600 mm** ⚑ along the shared run moves into this box (Q-TV08 A) |
| `must` | **kötelező**: every path passing its face stretch enters it, so the pipes are cut there; a departure on the same room face moves into it (Q-TV09 A) |

---

## §7 CK: checks (`tvCheck`; it reuses `upCheck` and the engine's warnings, and adds the TV rows; all go to `STK_CHECKS`)

| Id | Sev | Message (HU, final unless ⚑) | Rule | Source |
|---|---|---|---|---|
| CK-1 | warn | `'<n> végpont kör nélkül'` (+ the list); the ones that already reach the board: `'⚡ Elosztóra vár: <n>'` | TR-G2 | **built** (`elpUnassigned`, `trayWaiting`) |
| CK-2 | error | `'<ref>: nem érhető el az Elosztóból vezethető falon'` | PR-6 | TV1 before a run; `R.unreached` after |
| CK-3 | error | the engine's own `treeBad` text (`'… a betápja (<id>) nem érhető el vezethető falon …'`) | TR-G5 | **built** |
| CK-4 | error | `upCheck`'s loop text (`'Hurok: …'`) | TR-G1 | **built** |
| CK-5 | warn | `'<doboz>: zsákutca — nincs rajta táplált elem'` | TR-G3 | TV3 |
| CK-6 | warn | the engine's soft-wall warning (room + wall, mutasd) | PR-4 | **built** (T0-5) |
| CK-7 | warn | `'<kör> kilépés doboz nélkül (<helyiség>) — javasolt KD'` | SR-2 | **G4** |
| CK-8 | error | `'<kör> dedikált, de <n> végpont'` · `'<ref>: dedikált végpont nem az Elosztóról kap betápot'` | TR-D1–2 | TV3 |
| CK-9 | info | `'<kör>: elágazás <dugalj> dugaljnál'` | TR-S4 | TV3 (sev by Q-TV11) |
| CK-10 | warn | `'<csoport>: <n> kapcsoló, a típusok nem illenek (<típusok>)'` | TR-W1 | TV3 (reads `lswType`) |
| CK-11 | error | `'<ref> → <forrás>: ilyen betáp-kapcsolat nem megengedett'` | TR-G4 | TV3 |
| CK-12 | warn | the engine's Iz / ΔU warnings | SR-4 | **built** (`cableChecks`) |
| CK-13 | info | `'<doboz>: kötelező / preferált — a motor még nem követi (G4)'`; from G4 on: `'<kör>: a kötelező <doboz> nincs az útján'` | SR-3 | TV3 → G4 |
| CK-14 | info | `'<ref>: a motor még nem követi (G<n>) — <mai szabály>'` | G1–G6 | TV3 |

A check row click selects the element in the view and on the blueprint (`blShow` for the engine's own rows).

## §8 What ✨ Javaslat does in the view (TV8)

The view does not add suggestion logic. It gathers the existing suggestions into one table:

| Piece | Source |
|---|---|
| the javasolt `up` for every node | `upSuggest` / `upFill` (T1): DED → board, chains, lamps → meet / head switch |
| socket chains from the leader | `ldChains` via `UP_SUGGEST` (T3) |
| masters (szobadoboz) per room | `ldMasters` (T3), ticked rows → `ldPlaceMasters` |
| circuits for the waiting endpoints | `trayRows` → `trayApply` (T4) |
| star or chain per group | TR-L4, written by TV7's writer |
| the V1 string order and betáp points | TR-H4 / TR-H2 (G2 for the engine) |

Every row keeps the "Miért?" (the rule id). Alkalmaz = one undo step. Rögzített links are never in the table.

## §9 Not rules (deliberately left open in the basic version)

- three-phase balance;
- RCD groups;
- selectivity;
- the 0–2 wet-room zones (E5 F11);
- BRIDGE layers (T7 per-layer precedence stays deferred);
- the box conductor count (MP-13 counts pipes; terminals later ⚑);
- cable fire ratings.
