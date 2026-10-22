# Topology View: the hard rules (basic version, traditional erősáram)

*One numbered list so specs, checks and the "Miért?" column can cite a rule by id. The prefixes:*
- **PR**: path graph;
- **TR**: topology;
- **SR**: sharing;
- **CK**: checks.

*⚑ marks a value that needs the user's trade confirmation (checkpoint T3). A rule with a `Q-Txx` builds that question's
recommended option unless README §9 says otherwise.*

---

## §1 Elements and their roles

| Role | Planner object | Symbol (`fig/`) | Can be |
|---|---|---|---|
| **Root** `B` | the level's `board`: the Elosztó, or the Alosztó (E6) on an upper level | dark bar | the root of every circuit on its level |
| **Mid** `M` | a junction box: `jb` KD (100), szobadoboz (`jb:'szoba'`, 150 / 200), the portal box (L4, derived by E3), RBX | orange square | a pass-through, a **split** point, a **master** (betáp pont), a **hub** |
| **Endpoint** `E` | a device whose `epCodeOf` is `SOC` · `DED` · `LMP` · `SWI` | circle · diamond · ⊗ · square | a member of **exactly one** circuit |
| *(skipped)* | `SHU` redőny, BRIDGE codes, hardware | — | not in the basic version (E5 skips SHU too) |

- A mid is **never** a circuit endpoint (05j `cktCanJoin`). Cables pass through it or are split in it; they do not end in it.
- A **switch** is an endpoint of the lighting circuit of the lamps it controls (E5 rule: "a lamp joins its switch's circuit").

## §2 The three graphs (definitions)

- **GP, the pálya-gráf.** Anchors and the wall sections between them. Derived (PR).
- **T, the topology.** Per circuit `c`, a set of directed **links** `{a, b, k}` forming a tree rooted at `B`. Stored in
  `c.topo` (TR).
- **S, the sharing.** Every link of every circuit routed on GP; per GP edge, the set of circuits on it. Derived (SR).

A **link** is a logical connection ("these two are wired to each other"). A **path** is the wall-section sequence on GP
that realises it. In the view a link is one line. On the blueprint it is the path.

---

## §3 PR: the path graph

| Id | Rule |
|---|---|
| PR-1 | GP is the engine's wall-face network (`BL.network.build`) **contracted onto anchors**. An anchor is the board, every mid, and every endpoint's **drop point**: where its vertical riser meets the horizontal band on its face. Ceiling lamps anchor at the end of their Mennyezeti út (E2); floor devices at their Padló út end. |
| PR-2 | An edge joins two anchors **when a face path between them passes no other anchor**. Its weight is the length along the faces. The edge also carries the rooms, the walls, the crossing (if any) and the soft flag. *"A line represents the wall section between two points."* |
| PR-3 | **A wall is crossed only at a service point** (portal, szobadoboz, RBX, BASE, board). This is inherited structurally: the face network has no edge through a wall anywhere else (E5 F1 / Q5). |
| PR-4 | **Routable = Vezethető fal only** (E5-Q7 A). An unmarked face may be used at cost ×4. The edge is `soft:true` and is always reported (CK-6), never silent. |
| PR-5 | Mennyezeti út between two routable walls = a ceiling crossing edge (E5-Q9 A). Padló út = a floor edge. Both come from the E2 marks. |
| PR-6 | **Connectable** = there is a GP path. An anchor with no GP path to its level's root is **unreachable** (CK-2). That is the "geometric proof" the user wants before any circuit is set. |
| PR-7 | GP is per level. An Alosztó level's root links to the level below by its feeder only (E6), drawn as one feed link. |
| PR-8 | GP is a pure function of the input: the same `blInput(level).sig` gives the same GP. It is cached on that hash and never stored in the document. |

## §4 TR-G: topology, general

| Id | Rule |
|---|---|
| TR-G1 | Every circuit's links form **one tree rooted at its board**: connected, no cycle, every non-root node has exactly one upstream link. |
| TR-G2 | Every endpoint on the level is in **exactly one** circuit (05j). The tree of `c` must reach every member of `c`, and nothing that belongs to another circuit. |
| TR-G3 | Mids may be shared by many circuits. A mid that is a **leaf** of a circuit's tree is an error (a cable cannot end in a box). |
| TR-G4 | Link kinds and the only legal endpoint pairs: |

| `k` | from → to | Meaning |
|---|---|---|
| `feed` | B → M · B → E(DED) · M → M | betáp: the cable that brings the circuit to a box, or a dedicated home run |
| `master` | M → E (leader) · B → E (leader) | the first device of a chain or switching group, fed from that point |
| `chain` | E(SOC) → E(SOC) | the next socket of the string |
| `sw` | E(SWI) → E(SWI) · M(hub) → E(SWI) | switch to switch (chain), or hub to switch (star) |
| `lamp` | E(SWI) → E(LMP) · M(hub) → E(LMP) · E(LMP) → E(LMP) | the switched leg toward the lamps, and lamp to lamp |

| Id | Rule |
|---|---|
| TR-G5 | A link must be **realisable on GP** (PR-6). If it is not, the link stays, drawn red, and CK-3 fires. The router never invents another link. |
| TR-G6 | `fix:true` on a link means the user set it. ✨ Javaslat (T8) never removes or changes a fixed link; it only fills the gaps around it. |
| TR-G7 | `via:[midId…]` on a link forces its path through those mids, in order. SR-3 "kötelező" mids add themselves to `via` when the path passes them. |

## §5 Circuit patterns (`fig/03`)

`tpoPattern(c)` is **derived** from the circuit's preset kind (`CPR_CAT.kind`) and its links. It is never stored.

### TR-D: Dedikált (P1)

| Id | Rule |
|---|---|
| TR-D1 | Exactly one endpoint (05j `dedicated`), reached by **one `feed` link from B**. |
| TR-D2 | The cable is **continuous**: it may pass through a KD or portal box, but is never split there (Q-T04 A). In the share table it is a cable like any other. In the box list it adds no termination. |

### TR-S: Dugaljkör (P2, P4)

| Id | Rule |
|---|---|
| TR-S1 | Shape: `B →(feed)→ M …` optional, then `→(master)→ leader →(chain)→ … →(chain)→ tail`. |
| TR-S2 | **Default = the classic chain**: `B →(master)→ leader` directly, no mid (E06 answer). A mid master for a socket circuit is allowed **when the user links it** (Q-T03 A). Then the mid is that room's mini-Elosztó (`fig/03` P2 b). |
| TR-S3 | **Order** (`fig/04`): the leader is the member nearest to its master (or to B) on GP. Each next member is the nearest *not yet chained* member, by **path length along the routable faces** (arc length, Q-T16 A), not straight-line distance. The tail is the last. A hand reorder sets `fix`. |
| TR-S4 | **Branching** only at a mid: a socket has at most one `chain` link out (Q-T11 A). Two branches = two masters from one mid (`fig/03` P4). |
| TR-S5 | A chain hop is drawn on the blueprint as **riser up → along the band beside the gerinc → riser down**: the user's "arcs". It is socket box to socket box, with no leállás box in between (Q-T02 A). A leállás box is kept only where several devices drop together (MERGE 250) or where the circuit branches. |

### TR-L: Világítás and switching (P3; `fig/05`)

| Id | Rule |
|---|---|
| TR-L1 | Shape: `B →(feed)→ M(master / betáp)`, then per **switching group**: `master →(master)→ leader switch →(sw)→ … → tail switch →(lamp)→ lamp →(lamp)→ lamp`, **or** the star: `master →(feed)→ hub`, `hub →(sw)→ every switch`, `hub →(lamp)→ first lamp →(lamp)→ …`. |
| TR-L2 | A **group** is E1's lamp leg (`grp`) with the switches whose `ctl` names it. Its `logic` is `'chain' \| 'star'` and, for a star, its `hub` (a mid). The group record lives in `c.topo.groups`. |
| TR-L3 | The master of a group is, in order: the user's link → `jbMeet` (E3: the room's szobadoboz, else the switch's portal box) → B. |
| TR-L4 | **Star is suggested** when ≥ 2 switches of one group share the portal box of the room's door (the natural crossing point), and chain otherwise (Q-T06 A). The user can always toggle. |
| TR-L5 | The lamps of one group are chained nearest-first from the tail switch (chain) or from the hub (star). Mennyezeti út lines are followed when drawn (E2, E5 F12). |

### TR-W: Switch logic, wires, cables (⚑ checkpoint T3)

| Id | Rule |
|---|---|
| TR-W1 | Switch types follow the group, as E1 derives them: 1 switch, 1 leg = **101**; 1 switch, 2 legs = **105** csillár; 2 switches = **106 + 106**; n ≥ 3 = **106 + (n−2) × 107 + 106**. In a chain the two ends are váltó (106) and the middle ones kereszt (107). `typeFix` wins. |
| TR-W2 | **Phase reconnect** (the user's rule): the switched phase `Lk` meets N + PE again and leaves as a 3-core cable toward the lamps. In a star that happens in the hub. In a chain it happens in the tail switch's box, so N + PE travel through the switch boxes (Q-T05 A ⚑: a deep box and a connector). |
| TR-W3 | Cores per link ⚑ (PE always counted; T = traveller; `Lk` = switched phase): |

| Link | Chain | Star |
|---|---|---|
| master → leader switch / master → hub | L · N · PE → **3×1,5** | L · N · PE → **3×1,5** |
| switch ↔ switch (106 ↔ 106 / 107) | T1 · T2 · N · PE → **4×1,5** | — |
| hub → 106 (first) | — | L · T1 · T2 · PE → **4×1,5** |
| hub → 107 | — | T1 · T2 · T1′ · T2′ · PE → **5×1,5** |
| hub → 106 (last) | — | T1′ · T2′ · Lk · PE → **4×1,5** |
| hub → 101 egypólusú | — | L · `Lk` · PE → **3×1,5** |
| tail switch → lamp / hub → lamp | `Lk` · N · PE → **3×1,5** | `Lk` · N · PE → **3×1,5** |
| lamp → lamp | `Lk` · N · PE → **3×1,5** | same |

| Id | Rule |
|---|---|
| TR-W4 | Cable = the smallest NYM-J n × 1,5 with n ≥ cores (3 / 4 / 5). More than 5 cores → one cable per switch (rules.js `SWITCH_LEG`, E5 §1 row 15). |

### TR-H: Ház-füzér (V1 house string; `fig/03` P3)

| Id | Rule |
|---|---|
| TR-H1 | Shape: `B →(feed)→ M1 →(feed)→ M2 → … → Mn`. String links join **mids only**. A mid may also branch the string (it is a box). |
| TR-H2 | Every mid the string touches **becomes a betáp point**: the default master (TR-L3) for the switching groups of the rooms it serves. |
| TR-H3 | The string keeps **its own conduit** (`c.ownPipe`, Q-T07 A). SR-4 then never packs another circuit into its pipe, though it may share the chase. |
| TR-H4 | The suggested string order is the trunk order: a DFS of the shortest-path tree from B over the mids it must touch. Other circuits pass *by* these boxes unless SR-3 says otherwise. |

---

## §6 SR: sharing, departures, conduits (`fig/06`)

| Id | Rule |
|---|---|
| SR-1 | Every link is routed as the shortest GP path between its ends, through its `via` mids (TR-G7). Ties break by anchor id, so the result is deterministic. The routes of one circuit form its **wire tree** on GP. |
| SR-2 | A **run** is a maximal stretch of GP edges carrying the same set of circuits. **A circuit may leave or join a run only inside a box**: the board, a mid, a leállás box or the device's own box. A run boundary at a node with no box raises CK-7 *"kilépés doboz nélkül"* with a suggested KD (`gen:'tpo'`, Q-T10 A). |
| SR-3 | KD roles, set by the user per box (`d.tpoRole`): |

| Role | Meaning |
|---|---|
| none | **átmenő** (pass-through): a run that does not change there passes *by* the box, not into it (the E5 rule "a passing pipe goes BY a box") |
| `pref` | **preferált**: a departure that would happen within **600 mm** ⚑ (Q-T08 A) along the shared run is moved to this box. The paths are bent to meet there, at a cost ≤ that distance |
| `must` | **kötelező**: every path that passes the box's face stretch **enters** it (added to `via`), so the pipes are cut there; a departure within the same room face moves to it (Q-T09 A) |

| Id | Rule |
|---|---|
| SR-4 | **Packing** per run, the E5 rule (plan.js §9 `pack`): a pipe takes only as many circuits as its weakest cable still carries its breaker at, **In ≤ Iz · k(n)** (`IZ`, `groupK`, ⚑ IEC values). A 1,5 mm² cable shares its pipe with at most one other circuit (`maxCirc15` 2). At most `maxCablesPerPipe` (3) cables per pipe. The strongest cables are packed first. Applied to **every** shared run, distribution included (Q-T15 A). A circuit with `ownPipe` is never packed with another. |
| SR-5 | **Sizing** per pipe, `BL.rules.sizeConduit`: 1 cable needs ID ≥ 1,4 × OD; more cables need fill ≤ 40 %, or ≤ 33 % above 10 m. Sizes M16 … M63. |
| SR-6 | **Bends**: more than 3 corners on one pipe → a pull box at the corner (E5-Q4 B). There are no plain corner boxes in the basic version. |
| SR-7 | A run's result: `{edges, len, circuits, cables, pipes:[{circ, cables, cond, fill, k, ok}]}`. The **count** of pipes per run, side by side, is the chase width input for later layers. |
| SR-8 | **Heights are not decided here.** The band heights (trunk = ceiling − 250, distribution = trunk − 150) and the device heights come from E5-Q3 / R4. The topology decides who connects to whom; the engine decides at what height. |

---

## §7 CK: checks (`tpoCheck`, also pushed to `STK_CHECKS`)

| Id | Sev | Message (HU, final) | Rule |
|---|---|---|---|
| CK-1 | warn | `'<n> végpont kör nélkül'` (+ the list) | TR-G2 |
| CK-2 | error | `'<ref>: nem érhető el az Elosztóból vezethető falon'` | PR-6 |
| CK-3 | error | `'<kör> <a>→<b>: nincs fizikai út'` | TR-G5 |
| CK-4 | error | `'<kör>: nem fa (kör a kapcsolatokban / két betáp)'` | TR-G1 |
| CK-5 | error | `'<kör>: a(z) <doboz> ág vége — kábel nem végződhet dobozban'` | TR-G3 |
| CK-6 | warn | `'<kör>: jelöletlen falat használ (<fal>) — 4× költség'` | PR-4 |
| CK-7 | warn | `'<kör> kilépés doboz nélkül (<x>,<y>) — javasolt KD'` | SR-2 |
| CK-8 | error | `'<kör> dedikált, de <n> végpont / bontás <doboz>-ban'` | TR-D1–2 |
| CK-9 | error | `'<kör>: dugaljláncban elágazás <dugalj>-nál'` | TR-S4 |
| CK-10 | warn | `'<csoport>: <n> kapcsoló, a típusok nem illenek (<típusok>)'` | TR-W1 |
| CK-11 | error | `'<kör>: <a>→<b> link-fajta nem megengedett'` | TR-G4 |
| CK-12 | warn | `'<szakasz>: <kör> csöve túlterhelt (In <x> A > Iz·k <y> A)'` | SR-4 |
| CK-13 | info | `'<kör>: a kötelező <doboz> nincs az útján'` | SR-3 |

A check row click selects the element in the view and on the blueprint.

## §8 What the suggestion does (T8), in one table

| Circuit kind | Seed |
|---|---|
| DED | `B → E` feed |
| socket, no mid in its room linked by the user | classic chain (TR-S2, TR-S3) |
| socket, a mid master already linked | the chain from that mid |
| lighting `vil` | the V1 string through the mids of the rooms it serves (TR-H4); per group `jbMeet` master; star / chain by TR-L4 |
| `szobakor` (NV4: sockets + lighting in one circuit) | the socket chain and the room's group, both from the room's mid if one exists, else from B |

Every seeded link has `fix:false`. The suggestion ends in `wfTable`, with one row per circuit: *"A1 · lánc 4 dugalj ·
leader S1 · Miért: TR-S3"*.

## §9 Not rules (deliberately left open in the basic version)

- three-phase balance;
- RCD groups;
- selectivity;
- the 0–2 wet-room zones (E5 F11);
- BRIDGE layers;
- a box fill check (conductor count per box ⚑, later);
- cable fire ratings.
