# T2 + T3 — one navigator, fixed layout (BUILT 2026-10-15)

Mock-up: [mock/layout-mock.html](mock/layout-mock.html) · [mock/layout-mock.png](mock/layout-mock.png)

## Status

- **T1 done** (2026-10-15), in `src/05cb-toolctl.js` with `tests/spec-95`. There is now one registry of sub-tools, and
  `toolsOff()` runs in every tool start and in `setMode`, so at most one tool is live.
  - Measured: 0 / 182 tool pairs left two tools live, 0 clicks stolen, and ▖ Select ends every tool.
  - Status bar and button lighting come from `toolCurrent()`.
  - The simple-UI interface (`toolCurrent / toolStop / toolStart / toolOnChange`) is live.
- **T4 done:** the Régi eszközök drawer in the Tools panel holds Cable, Device, Build, Floor, Roof, ➕ Helyiség méretre,
  Ház, Garázs, Újraszámol and Útvonalak törlése.
  - The Routing panel is gone.
  - A legacy mode picked by its key opens the drawer.
- Suite: 89 suites, 3138+ checks, golden 70/70.

## The layout (T2 + T3 together — the navigator and the frame are one change)

| Zone | Contents | Replaces |
|---|---|---|
| Left top | **6 phases** (2 × 3 buttons) with check badges: 1 Alapozás · 2 Nyílászárók · 3 Szabályok · 4 Villamosság · 5 Pályák · 6 Kimenet | stage rail (6 stages / stack steps), wfBar (4 phases) |
| Left middle | **Tools of the phase**: always Kijelölés · Mozgatás · ↩ · ↪ · 📌 first, then the phase's tools (2 columns), then ▸ Régi eszközök | Tools panel, wfBar tool buttons |
| Left bottom | **One context panel**: the running tool's panel, otherwise the phase's own panel | Path, Cable, Objects, Vonalak, Szint, Szintek panels, the floating #rbPanel / #stdPanel |
| Right top | **Inspector**: the selection, or the phase checks when nothing is selected | the inspector overlay on the canvas |
| Right bottom | **Tabs**: Rétegek · Kimutatás (KábelΣ + Eszközök + BOM) · Nézet (the View panel, until T5) · Projekt (until T7) | Layers, cable / device totals, BOM, View, Projektek |
| Canvas | the drawing, the tool hint (top-left), 2D / 📐 (top-right), status bar (tool chip, level chip ▾, height, warnings) | — |

**Retired:**
- the 2 × 19 picker buttons, 🎛 Auto-panel and ⧉ Tools: fent;
- `TOOL_LAYOUT`;
- the floating positions of #rbPanel and #stdPanel;
- the wfBar.

The ⛶ Tab wide mode stays and hides both columns.

### Phase → tools → default context panel

| Phase | Tools | Default panel (nothing running) |
|---|---|---|
| 1 Alapozás | Helyiség-toll, Falak létrehozása, Padló létrehozása, Fal, Objektum, Mérés | Szintek: active level, heights, álmennyezet, pen options |
| 2 Nyílászárók | Ajtó, Ablak, Lépcső, Portál, Portálok a jelölt ajtókhoz | the opening types (the ←/→ list) |
| 3 Szabályok | Helyiségtípus, Vezethető fal, Szabályok, Szabványok, Jelölés J / G | Szabályok palette (docked) |
| 4 Villamosság | Dugaljak / Lámpák / Dedikált (layer), Végpont…, Kapcsolások, Javaslat, Mennyezeti út, Padló út, Szobadoboz, Kötődoboz, Elosztó, K | Áramkörök (circList + Áramkör-lista…) |
| 5 Pályák | Pálya, Csatorna, Ezüst sín, ARM, Feltöltés… | Pálya options + height guide lines |
| 6 Kimenet | Számozás, Kábellista, Vezetéklista, Elosztó tábla, Kapcsoló riport, Ellenőrzés, PNG / Nyomtatás / Exportálás | Kimutatás summary |

**Tool → panel:**

| Tool | Panel |
|---|---|
| Path | Pálya options + guides |
| Object | object library |
| Note | note settings |
| Szabványok | the table |
| Szabályok | the palette |
| Kapcsolások | its legs list |
| Szobadoboz | its jobs list |
| everything else | the phase panel |

## Built (2026-10-15)

- **Answers:**
  - L1 is "optional": the 2 × 3 grid is the default and ☰ (or the action Fázisok: rács ↔ lista) turns it into a list;
  - L2 A, L3 A, L4 A.
- `src/05db-layout.js` holds the six phases (PH_LIST), the generated tool buttons, PANEL_HOME, the context panel
  (CTX_OF_TOOL, ctxKeyNow), the right tabs and `layoutSync` (called from statusBar; cheap when unchanged).
- **Removed:**
  - 05d: the stage rail rendering and the U5 grips;
  - 12-boot: the picker, Auto-panel, Tools: fent and TOOL_LAYOUT;
  - 08k: the floating bar; WF_PHASES = PH_LIST;
  - the WF_PHASES injections in 08l / 08m / 08n.
- Mennyezeti út and Padló út are phase-3 (Szabályok) tools, as the user asked.
- New actions: wf.roomType, wf.stairs, wf.layer.SOC / LIGHT / DED, view.phaseLayout, phase.next / phase.prev.
- Rewritten specs: 18, 19, 25, 35, 62, 70, 90, 91, 92, 93, 95. Result: 89 suites, 3139 checks, golden 70/70.
- **Open:**
  - Kapcsolások / Szobadoboz have no panel of their own yet; they show the phase panel (Áramkörök);
  - with a BRIDGE stack active, the inspector follows the active role layer, not the phase.

## Decisions (answered)

1. **L1, the phase buttons:**
   - A) a 2 × 3 grid at the top of the left column, as in the mock;
   - B) one vertical list down the left edge.
2. **L2, the inspector:**
   - A) the right column, never covering the canvas, as in the mock;
   - B) an overlay on the canvas, as today.
3. **L3, the header:**
   - A) T3 only removes Tools: fent and Auto-panel; the Projekt ▾ / Kimenet ▾ menus in the mock wait for T7;
   - B) do the T7 header diet now, with T3.
4. **L4, the right tabs:** A) Rétegek · Kimutatás · Nézet · Projekt; B) different (say which).
