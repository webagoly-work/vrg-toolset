# Planner UI audit — panels, tools, streamlining (2026-10-14)

Snapshot: `planner-stack` @ `9c1ac45`. The tables live in **[UI-AUDIT.xlsx](UI-AUDIT.xlsx)**, which has 8 sheets: Olvass el, Panelek, Eszközök, Mátrix, Párok, Duplikációk, Ütközések, Javaslatok. This page is the short version.

## 1. What is on screen today

| Surface | Count | Notes |
|---|---|---|
| Header | 14 buttons | Save / Load / New duplicate the Projekt panel; 4 export buttons |
| Sidebars | 20 panels | Any panel can sit left, right or off, set by 2 × 20 picker buttons. 🎛 Auto-panel re-deals them on every mode change |
| Toolbar row | the Tools panel when docked "fent" | |
| Stage overlays | 14 | Rail, Inspector, wfBar, modeHint, HUD, status bar, 2D, 📐, ◀ ▶, controller legend, mobile bar … |
| Floating panels and dialogs | 6 | Szabályok (fixed over the left sidebar), Szabványok (fixed over the right sidebar and the inspector), wheel, palette, Exportálás, Áramkör-lista |
| Tools | 36 | 14 modes, 13 sub-tools that ride on Select, plus generators, dialogs and editors |
| Palette actions | 238 in 30 groups | |

### Panel categories

- **Project / file:** Projekt, Épület
- **Tool choice:** Tools
- **Tool options:** Path, Cable, Device, Build, Objects, Vonalak, Routing
- **Model structure:** Layers, Szint, Szintek
- **Electrical data:** Körök, plus the Áramkör-lista dialog
- **View:** View, Feliratok
- **Output:** Doksi, KábelΣ, Eszközök, BOM
- **Stage surfaces:**
  - navigation: Rail, wfBar
  - selection: Inspector
  - rules / heights: Szabályok, Szabványok (both floating)

Verdicts per panel are in the Panelek sheet:
- **Keep:** Layers, Körök, Inspector, Áramkör-lista.
- **Merge:** Szint + Szintek; KábelΣ + Eszközök + BOM into Kimutatás; Vonalak into Szabványok; Rail into the wfBar.
- **Move:** Projekt to a header menu; Path / Objects / Routing to tool options; Doksi and Feliratok.
- **Split:** View, Épület.
- **Legacy drawer:** Cable, Device, Build.

## 2. Measured problems

1. **Sub-tools are not exclusive.** This is why the new buttons "work half the time".
   - Every sub-tool switches off its own hand-picked list of other tools.
   - In jsdom, 78 of 156 tool pairs leave two tools live.
   - In **18 cases** the tool picked last does not get the click. A leftover RBX, Végpont, Portál or Klaszterdoboz tool sits earlier in `STK_TOOLS` and eats it.
   - Clicking ▖ Select does not end J, G or RBX placement.
   - The full list is in the Ütközések sheet.
2. **The status bar lies.** During any of the 13 sub-tools it says "Kijelölés", and the room pen shows the raw key "room". The WF buttons are `.tool` buttons that never light up, except Ajtó / Ablak.
3. **The auto-panel doesn't know the new tools.**
   - Room pen, Measure, Note and Format have no layout, so the sidebars keep whatever was there before.
   - All 13 sub-tools get the Select layout (Projekt, View, BOM), which is irrelevant to them. The panels they actually need float over the sidebars instead.
4. **Two navigators.** The stage rail (6 stages, or the stack steps) and the wfBar (4 phases) are on screen together. At 1600 × 900 the wfBar runs 128 px under the inspector, and the rail button is used by **no** tool.
5. **Two creation methods side by side:** rooms-first (pen → Falak létrehozása) and walls-first (Wall → Floor / Padló a falak közé), plus a third, the room dialog. All are in the same Tools panel.
6. **Duplicates** (the Duplikációk sheet has 15 rows):
   - 6 save paths;
   - 4 height UIs with separate numbers;
   - 7 ways to hide panels;
   - 3 ways each to make rooms, floors, doors and devices.
7. **The drawing area is cramped.** At 1600 px wide the drawing area is 758 px after the sidebars, the rail and the inspector.
8. **Mixed language and clashing icons.**
   - Some labels are English: Tools, Layers, Select, Move, Path, Cable, View, Build.
   - 📏 means both Mérés and Szabványok; ▦ means both Padló and Padló létrehozása.

## 3. Tool tiers (judgement, not measured usage — override freely)

- **S:** Kijelölés · Helyiség-toll · Falak létrehozása · Végpont · Kapcsolások (+ javaslat)
- **A:**
  - Ajtó / Ablak · Szabványok · Szabályok · Mennyezeti / Padló út · Szobadoboz / Kötődoboz
  - Végpontok kijelölése (K) · Áramkör-lista · Mozgatás · Pálya · Padló létrehozása · Fal-nézet szerkesztő
- **B:**
  - Fal · Vezethető fal · Jelölés J / G · RBX / hardver · Portál · Mérés · Jegyzet
  - Objektum · Formátum · Csatorna / Ezüst sín / ARM · Feltöltés
- **C (superseded but working):** Kábel · Készülék · Build · Padló (manual) · Helyiség-dialog · Klaszterdoboz
- **D:** Tető · Ház / Garázs presets · Újraszámol / Útvonalak törlése

## 4. Sets (tool + panel pairs, by function)

| # | Set | Tools | Paired panel |
|---|---|---|---|
| 1 | Alapozás | Helyiség-toll, Falak / Padló létrehozása, Fal, Mozgatás, Mérés | Szerkezet: pen options + Szintek |
| 2 | Nyílászárók | Ajtó, Ablak, Lépcső, Portál | a one-line options strip, no panel |
| 3 | Szabályok | type wheel, Szabályok (incl. Vezethető fal), J / G | Szabályok, docked |
| 4 | Magasságok | Szabványok, ＋ placement, guide lines | Magasságok = Szabványok + guide lines |
| 5 | Végpontok | Végpont, role layers | Végpontok picker + Rétegek |
| 6 | Kapcsolás + dobozok | Kapcsolások, Mennyezeti / Padló út, Szobadoboz, Kötődoboz, Elosztó | Villamosság: legs, boxes, checks |
| 7 | Áramkörök | K pick, Áramkör-lista | Áramkörök → dialog |
| 8 | Pályák | Pálya, Csatorna, Ezüst sín, ARM, Feltöltés | Pálya options + Feltöltés |
| 9 | Berendezés | Objektum, Jegyzet, Formátum | library flyout, notes |
| 10 | Nézet | 2D / 3D, style, camera | quick-view widget + Megjelenés dialog |
| 11 | Kimenet | lists, reports, PNG / Print / Export, BOM | Kimutatás tabs + Kimenet ▾ |
| 12 | Projekt | save, load, new, backups, samples | header Projekt ▾ |

## 5. Suggestions (T1–T8, in build order)

1. **T1 · One tool controller.**
   - Every mode and sub-tool registers once; starting one stops the current one; Select and Esc stop any.
   - Buttons, mode hint and status bar all read the same record.
   - *Fixes the half-working buttons.* Size M.
2. **T2 · One navigator.**
   - The wfBar phases become the left rail: 1 Alapozás · 2 Nyílászárók · 3 Szabályok · 4 Villamosság · 5 Pályák · 6 Kimenet.
   - Stack steps move into the Layers panel. Size M.
3. **T3 · Fixed layout, contextual content.**
   - Left: the tool strip for the phase, plus ONE context panel (the paired panel of the active tool).
   - Right: Inspector on top, with tabs Rétegek / Kimutatás below.
   - Panels never move. Retire the picker, Auto-panel and Tools: fent. Size L.
4. **T4 · Legacy drawer.** Cable, Device, Build, Floor, Roof, Routing, the room dialog and the presets go into "Régi eszközök". Nothing is deleted. Size S.
5. **T5 · Split View.** A quick-view widget in the stage corner; the rest goes to a Megjelenés dialog; the behaviour toggles go to Beállítások. Size M.
6. **T6 · One height source.** Guide lines and the cable draw height read from STD_H. Size M.
7. **T7 · Header diet.** Projekt ▾ · Undo / Redo · Kimenet ▾ · ⌘K · Bevitel ▾, which takes the header from 14 buttons to 5. Size S.
8. **T8 · Names + icons.** All labels Hungarian; unique icons. Size S.

Golden renders are not touched by T1–T8: they render the stage, not the shell. The shell and rail specs move with T2 and T3.

## 6. Answers (2026-10-15)

- 1 **B**: build T1–T4 (tool controller, one navigator, fixed layout, legacy drawer). T5–T8 later.
- 2 **A**: the legacy drawer. Hidden, still in ⌘K and old projects, nothing deleted.
- 3 **A**: fixed panels with contextual content. The picker, Auto-panel and "Tools: fent" are retired.
- 4 **A**: the tidy first, then E4.
- Added in the same message: a **Simplified UI** mode (Egyszerű felület), built by a parallel session from
  `docs/simple-ui/`. T1 must export `toolCurrent / toolStop / toolStart / toolOnChange`, and T3 must keep new chrome
  inside `header` / `.side` / `.stage-wrap` or mark it `data-chrome` (simple-ui contract §2).
