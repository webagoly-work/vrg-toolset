# Simplified UI — MENU TREE

*Every leaf is an **action id** from the registry (05c `ACTIONS`). Ids marked **NEW** don't exist yet; S3 registers them
in `11u-sm-tree.js`, calling the public function named in the table. Labels are the action's own `label` unless an
override `n:` is given (short labels read better in a 248 px column). Max 4 children per node. A node with more is
**paged** automatically (3 + TOVÁBB, §3 of the design), so the tree may list more than 4 where noted.*

## §1 Root (SUI-Q S03 ★A)

```
01 ÉPÜLET ›          02 VILLAMOSSÁG ›          03 ESZKÖZÖK ›          04 RENDSZER ›          05 ✕ BEZÁR
```

The root is stable. It never changes with the selection; the selection keeps its right-click menus (S05 ★A).

## §2 The tree

| Path | Item (`n:` override) | Action id | Kind |
|---|---|---|---|
| **01 ÉPÜLET** | | | |
| ÉPÜLET › 01 HELYISÉGEK | Helyiség-toll | `mode.room` | tool |
| | Falak létrehozása | `wf.walls` | action |
| | Padló létrehozása | `wf.floors` | action |
| | Helyiségtípus | **NEW** `wf.roomType`: `setMode('room')` + the same hud text as the WF bar's 🏷 button (08k-wf-bar.js:22) | tool |
| ÉPÜLET › 02 NYÍLÁSZÁRÓK | Ajtó | `wf.door` | tool |
| | Ablak | `wf.window` | tool |
| | Lépcső | **NEW** `wf.stairs`: `setMode('build'); state.buildType='stairs'` (the `#buildType` select value too) | tool |
| | Portál | `pt.place` | tool |
| ÉPÜLET › 03 SZABÁLYOK | Szabálykészlet › | generator `rules` (§3) | submenu |
| | Vezethető fal | `wf.routeWalls` | tool |
| | Szabványok | `wf.standards` (opens the Szabványok sheet in S7) | action |
| | Jelölés › | `mark.wall` (tool) · `mark.plane` (tool) · `mark.list` · `room.renumber` | submenu |
| ÉPÜLET › 04 SZINTEK | Feljebb | `level.up` | stay |
| | Lejjebb | `level.down` | stay |
| | Álmennyezet | `drop.settings` | action |
| | Fal mozgatása / mérés › | `mode.wall` (n: Fal rajzolása, tool) · `mode.grab` (tool) · `mode.measure` (tool) | submenu |
| **02 VILLAMOSSÁG** | | | |
| VILLAMOSSÁG › 01 VÉGPONTOK | Dugaljak | **NEW** `wf.layer.SOC`: `wfLayer('sys:SOC')` | stay |
| | Lámpák + kapcsolók | **NEW** `wf.layer.LIGHT`: `wfLayer('sys:LIGHT')` | stay |
| | Dedikált | **NEW** `wf.layer.DED`: `wfLayer('sys:DED')` | stay |
| | Minden végpont › | generator `endpoints` (§3) | submenu |
| VILLAMOSSÁG › 02 KAPCSOLÁS | Kapcsolások | `wf.switches` | tool |
| | Javaslat | `wf.switchSuggest` | action |
| | Mennyezeti út | `wf.ceilLine` | tool |
| | Padló út | `wf.floorLine` | tool |
| VILLAMOSSÁG › 03 DOBOZOK ÉS KÖRÖK | Szobadoboz | `wf.boxSzoba` | tool |
| | Kötődoboz | `wf.boxKot` | tool |
| | Elosztó | `wf.board` | tool |
| | Áramkörök › | `circuit.pick` (tool) · `circuit.presets` (n: Áramkör-lista) · `circuit.new` · `circuit.export` | submenu |
| VILLAMOSSÁG › 04 PÁLYÁK | Pálya | `mode.path` | tool |
| | Csatorna | `chn.route` | tool |
| | Feltöltés › | `fill.room` · `fill.all` · `fill.channel` · `fill.report` · `elo.schedule` (5 → paged) | submenu |
| | Sín és ARM › | `rail.route` (tool) · `arm.route` (tool) · `hw.rbx` (tool) · `hw.serve` (tool) | submenu |
| **03 ESZKÖZÖK** | | | |
| ESZKÖZÖK | Visszavonás | `edit.undo` | stay |
| | Újra | `edit.redo` | stay |
| | Kijelölt törlése | `edit.delete` | action |
| | Rajzeszközök › | `mode.select` (n: Kijelölés) · `mode.note` (n: Jegyzet) · `mode.object` (n: Objektum) · `mode.format` (n: Formátum) | submenu |
| **04 RENDSZER** | | | |
| RENDSZER › 01 NÉZET | 2D ↔ 3D | `view.toggle3d` | stay |
| | Stílus › | `view.style.plan` · `view.style.blueprint` · `view.style.whiteout` · `view.style.preview` · `view.style.tiszta` (stay, paged) | submenu |
| | Kamera › | `view.cam.iso` · `view.cam.dim` · `view.cam.axo` · `view.cam.mil` · `view.cam.elev` · `view.cam.lock` · `view.reset` (stay, paged) | submenu |
| | Rétegek › | generator `layers` (§3) | submenu |
| RENDSZER › 02 PROJEKT | Mentés | `proj.save` | action |
| | Projektek › | generator `projects` (§3) | submenu |
| | Új projekt | `proj.new` | action |
| | Exportálás JSON-ba | `proj.export` | action |
| RENDSZER › 03 KIMENET | Anyagkimutatás | `doc.totals` | action |
| | Nyomtatás / PDF | `doc.print` | action |
| | Kép (PNG) | `doc.png` | action |
| | Axonometria lap | `view.export.menu` | action |
| RENDSZER › 04 BEÁLLÍTÁSOK | Normál felület | **NEW** `ui.normal`: `smSet(false)` | action |
| | Beállítások | `app.settings` | action |
| | Ellenőrzés | `check.list` | action |
| | Egyéb parancsok › | generator `other` (§3) | submenu |

**Tool kind:** the leaf runs a tool, so the menu closes and the dial shows the tool. In S3, `tool:true` is set for
exactly the rows marked *tool* above. A spec checks the list.

## §3 Generators (children built when the node opens, never cached across opens)

| Key | Children | Leaf runs |
|---|---|---|
| `rules` | `RB_PRESETS` without `kind:'off'` (20), grouped by `sec`: Fal (10) → 3 pages (3 · 3 · 4); Nyílászáró (2); Egyéb területek (8) → 3 pages (3 · 3 · 2). The level shows the sections first: `FAL › · NYÍLÁSZÁRÓ › · EGYÉB TERÜLETEK ›` | `rbPick(k)`; tool (it starts the rules tool). Register the presets as actions `wf.rule.<k>` (NEW, 20 of them) so search finds them |
| `endpoints` | `ep.place.*` grouped by role, the role's name as the node. The groups come from the endpoint catalogue's role (`epEntry(code).role`), not from the label text | the action; tool |
| `layers` | `layers` (05l), top-level only, in panel order. The leaf makes the layer active (`state.activeLayer=id; renderLayers(); draw()`). Its line 2 reads `● aktív` / `rejtett` | **NEW** `layer.activate.<id>` is NOT registered (ids change per project): the generator runs the function directly — the one allowed exception to contract §2.4 |
| `projects` | `loadProjIndex()` entries, newest first (by `ts`) | `loadProject(id)` after `confirm('Megnyitod: <name>? A jelenlegi terv mentve marad.')`; same exception as `layers` |
| `other` | every action **not reachable** from the curated tree or the other generators, grouped by `group` (each group a node, paged) | the action |

## §4 Search (S4) covers

All curated leaves, all generated leaves of `rules` and `endpoints`, and every action in `ACTIONS` (so legacy tools in the
T4 drawer are found too).
- Results are scored with `paletteScore(q, label + ' ' + (alias||'') + ' ' + group)`, best first.
- Disabled results stay in the list, dimmed, ranked after the enabled ones with the same score.
- Each result shows its tree path on line 2 (`ÉPÜLET / NYÍLÁSZÁRÓK`), or the action's group when it is only in `other`.

## §5 Coverage rule (spec in S3)

1. Every id in the §2 table exists in `ACTIONS` after S3 has registered the NEW ones. A missing id fails with its name.
2. `smReach()`, the set of action ids reachable from the root, including `other`, equals the set of all action ids.
   (`other` makes this true by construction; the spec guards against a generator crashing.)
3. The `other` node holds **≤ 150** actions. A hand count at planning time was about 135 of 238: layers, notes, QR,
   stack, marks, radio, phone and so on. Write the real number into README §4. It is a safety net, not a second home;
   a later round may promote groups out of it.
4. No node, generated or curated, renders more than 5 items.
