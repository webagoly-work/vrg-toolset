# P13 · Live-first polish

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** Design-rule audit (R1–R12), low-glow mode, adaptive quality tiers, the Claude Design batch pack, base fine-tuning from the user's dev notes (brought to that batch, KV-01 Q1).
- **Done-check:** Every rule has a check in selftest/shot.js; the Design batch pack exists.
- **Files:** CodeCity/tools/*, docs/city/README.md §7
- **Decisions:** D26
- **Prompts:** see PROMPTS-WORKSPACE.md
- **Status:** KV-27 built 2026-10-27 (audit, low glow, quality tiers, Design pack); open: CITY-D26 (skin name), the user's dev notes, the R8 chip row

## KV-27: rules audit, low glow, quality tiers, Design pack (2026-10-27)

**Audit against report §5.5** — every rule has a check in `node CodeCity/tools/selftest.js` (R11 also a shot check on
`docs/city/design-pack/`):

| Rule | State | Evidence / the check | Gap left |
|---|---|---|---|
| R1 grey-normal | partly, by design | default lens Alap (CITY-D6); a change pulse fades by time (~2 s) | the night look lights windows by recency (not only abnormal states) and the constructs are always coloured (cyan front / violet) — CITY-D6 chose this |
| R2 colour never alone | yes | every lens has a worded legend; constructs carry name labels | — |
| R3 one animation, one meaning | yes | the Alap legend names the window light ("friss munka világít") | the legend does not list the live pulse, beams and ships yet |
| R4 signage only for active | yes | a construct and its sign exist only while its program has a window | building labels for flagged files only: not built |
| R5 places never move | yes | ring slots kept while alive, freed slots reused; layout from data (land.json slots) | — |
| R6 3D overview, flat reading, hand-off | yes | panels for files/dirs; the portal hand-off (KV-26) | — |
| R7 keyboard path for every 3D path | mostly | Ctrl+K palette, 1–6 lenses, U roads, L low glow, Home | the portal hand-off has no keyboard route yet (click only) |
| R8 lenses/filters as removable chips | partly | the active lens is lit in the always-visible lens bar; the filter stays in the search box | **no chip row**: a filter is removed by clearing the box, the lens by picking another |
| R9 status on the object + one corner | yes | ● élő badge in the bar, the legend corner, status on buildings/constructs | — |
| R10 tweens ≥ 400 ms | yes | every flight 400–1200 ms or an explicit instant snap (tour end, wallpaper) | — |
| R11 low glow, ≤ N animations, ~0 % idle | mostly | **low glow (new)**: L / "Halk" / `#glow=low` — window gain and body glow ×0.35, live pulse ½ (shot: 1.0 % bright pixels vs 1.5 %); render on demand; idle measured (KV-24/25) | no global cap on simultaneous animations |
| R12 card field order | **fixed** | the file panel now reads name · owner · state · time (it listed owner sixth) | no undo field on a file card (nothing to undo there) |

**Trademark limits (report §4):** the page, the shell and START.cmd's menu lines have no "Tron", derezz, Recognizer,
Encom, I/O Tower, Grid, braindance, ctOS, light-cycle or identity-disc text (selftest scan; comments are not shown to the
user). The skin name is CITY-D26, still open — the city has no skin name yet.

**Adaptive quality tiers (new, 37-look.js):** `#quality=high|mid|low` or auto: pixel ratio min(dpr,2) / 1 / 0.75; auto
steps down one tier when the median frame gap of 30 moving frames is over 45 ms, never up by itself; `body[data-quality]`.

**Design pack:** `node CodeCity/tools/design-pack.js` → `docs/city/design-pack/` — ten looks at 1200×750 (six lenses,
roads, low glow, quality low, the wallpaper) and a README with the rules and an empty **Dev notes** section for the
user (README §7: ask, do not guess).
