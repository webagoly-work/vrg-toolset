# WP-U6 — Device hover card (Lebegő infó)

Status: todo · Wave U · Depends: U1 · Size: S (~90 lines) · Spec: 63

## Goal
*"In addition to Réteg-kiemelés, make a toggle option so that hovering the cursor over devices pops up
the lebegő box, showing name and type of device, what circuit, which stack layer, and additional info
saved with said device."*

## Read
`10-lamps.js` lines 120–140 (`lampHoverShow` / `lampHoverHide` / `lampAt` — the `#thumbPop` box is
the pattern to reuse) · `08-interaction.js` lines 146–151 (where hover runs) · `shell.html` line ≈ 250
(the Réteg-kiemelés checkbox) · `05z-icons.js` ≈ line 246 (`layers.spotlight` action — register the
new toggle beside it) · `05j-circuits.js` (`cktOfDevice`, `cktLabel`, `mcbText`), `05s-endpoints.js`
(`epCodeOf`, `epEntry`, `epCircuitOf`), `05p-hardware.js` (`hwIs`, `hwServes`, `hwUnits`, `HW_RB`).

## Build
1. **`hovFacts(d)`** → `[{k,v}]`, the single source (the inspector may reuse it later):
   | k (HU) | v |
   |---|---|
   | (title) | `d.ref` + name — `DEV[d.type]` or the EP entry's `n` |
   | Típus | EP code + variant name (`epEntry(code,role).vars.find(v=>v.k===d.var).n`), else `DEV[d.type]`; RBX: class + size (`HW_RB`), "· 1 szobás" once S2 exists; BASE: units |
   | Áramkör | `cktLabel(cktOfDevice(d))` + `mcbText(c.mcb)`; else the implicit stack circuit (`epCircuitOf`: "dedikált", "<szoba> dugalj", "világítás · RBX…"); else "—" |
   | Réteg | the layer's name, and for a stack layer the role name with a colour chip (`STK_COL`) |
   | Helyiség | `roomOfDevice(d)` number + name |
   | Magasság | `d.h` mm + zone (alacsony 200–500 · közepes 800–1400 · magas 1900–2500 · mennyezet) |
   | Egyéb | `d.note`, lamp def name + "↗ bolti link", RBX: served rooms; BASE: rule worst state; links: n pálya-kötés |
   Rows with no value are left out. Max 8 rows.
2. **`hovShow(d,cx,cy)` / `hovHide()`** — reuse `#thumbPop` (one floating box, never two). If the
   device is a lamp with a thumbnail and `L.hover`, the photo goes on top of the facts. Offset +16 px,
   kept inside the viewport (flip left / up near the edges).
3. **Toggle** `state.devHover` (default false): checkbox `Lebegő infó (eszközök)` right after
   Réteg-kiemelés in `shell.html`; action `layers.hoverInfo` (`Lebegő infó be/ki`, group Réteg); sync
   on load in `11-controls.js` ≈ line 225.
4. **Hover wiring** (08 ≈ line 147): when `state.devHover`, in select **and** grab modes, use
   `devHitIdx(e)` (already `hitOk`-filtered by U1) → `hovShow` / `hovHide`; otherwise today's lamp-only
   behaviour. 120 ms dwell before showing (a `setTimeout` cleared on move) so sweeping the cursor does
   not flicker. Hide on pointerdown (already: `lampHoverHide()` first line of pointerdown), on wheel,
   on Esc and on mode change.
5. Do not confuse with the Áramkörök panel's existing "Lebegő infó a rajzon" (`circHoverInfo`, which
   labels route sections) — different feature, leave it alone; the label of the new one says
   "(eszközök)" to tell them apart.

## Tests — `tests/spec-63-hover-card.js`
1. `hovFacts` on a socket in circuit A3 `1C 16A` on a stack Dugalj layer in R03 → rows Típus, Áramkör
   `A3 … · 1C 16A`, Réteg, Helyiség `R03 …`, Magasság `300 mm · alacsony`.
2. RBX with `rb:'RB-H'` → Típus contains `RB-H` and `600 × 600`.
3. `state.devHover=false` → pointermove over a socket shows nothing; true → `#thumbPop` visible after
   the dwell (fake timers or call the flush directly).
4. Hidden layer → no card (U1).
