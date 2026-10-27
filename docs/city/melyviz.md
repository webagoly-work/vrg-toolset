# Mélyvíz — the Kódváros skin (CITY-D26)

**Mélyvíz** ("deep water") is the VRG dev-side interface style, set 2026-10-27 from the user's reference board
(bezelled sci-fi tablets, monochrome ops walls, ink-eclipse frames, a slate crime-scene reconstruction, copper
field tablets, line-only grids) merged into one style with a click-to-wave water ground. Kódváros is the first place
it is applied. It sits beside **VRG Title Card** (the client-facing style) and shares its ice and sand/copper, its
hairlines and its "no drop shadows" rule, so dev and client work read as one studio.

The style lab (interactive: every axis as a slider, seven presets, a live console, tokens to copy):
https://claude.ai/artifact/9p2XW6rSijksZdDz8KgsSt (private to the owner).

## Axes and the Kódváros setting

Every reference became an axis between two named ends. Kódváros sits here:

| Axis | Ends | Kódváros | Why |
|---|---|---|---|
| Ground | Void · Slate · Paper | 20 (deep slate-void) | night city; the water must stay darker than the lit windows |
| Temperature | Ice · Neutral · Copper | 18 (ice) | ice is the instrument; warm light is kept for the code's activity |
| Chroma | Grey · Saturated | 50 | R1 grey-normal: colour only where it means something |
| Emission | Matte · Emissive | 20 | R11 low glow: 3 px, 0 with L / `#glow=low` |
| Density | Monolith · Swarm | 70 | a working tool: many readouts, mono micro labels |
| Edge cut | Square · Chamfered | 40 | 6 px cut on two opposite corners of every glass panel |
| Rake | Upright · Raked | 0 | Hungarian text on buttons stays upright and legible |
| Matter | Vector · Ink | 20 | crisp hairlines; no ink corona in the city |
| Glass | Opaque · Clear | 60 | panels blur the water and the city behind them (solid on the low quality tier) |
| Chassis | Bare · Hardware | 0 | an app, not a device mock-up (the overlay/pendant may use more) |
| Water | Still · Storm | 0 (still) | R3 + R11: the water moves only when you click it |
| Voice | Mono · Condensed · Wide | Condensed | Bahnschrift condensed for titles; the readouts stay mono |

## Rules (added to R1–R12)

- **M1 Two temperatures, two meanings.** Ice (`--accent` #93d3e6) = the instrument and you: selection, focus, the
  beacon, the playhead, query brackets, "you are here". Warm light = the code's activity: lit windows (recent work),
  cranes, heat, a running job. Never swap them.
- **M2 The ground is water.** `src/38-sea.js` draws a ripple field behind the transparent city canvas, refracting a
  faint drafting grid. A plain left click on empty water (no drag, no building or plate, no modifier) sends a wave
  from that point. Nothing else moves it.
- **M3 Water renders on demand.** The simulation runs ~5 s after the last click, draws one final frame and stops; an
  idle city still draws nothing (R11). The wallpaper gets one still frame; the overlay has no water (the desktop is the
  ground). Reduced motion: one step.
- **M4 The water follows the lens.** Horizon = the lens's fog colour; highlights are ice for Alap, Tulaj, Nyelv and the
  lens's own window light for Hő, Kor, Ügynök.
- **M5 Glass, hairlines, cut corners.** Panels are smoked glass (`--panel` + `backdrop-filter`), 1 px lines, square
  controls, two cut corners drawn as diagonals; no rounded corners (dots excepted), no drop shadows.
- **M6 Type.** Readouts, paths and numbers in mono (Cascadia Mono / Consolas); titles in the condensed voice
  (Bahnschrift, built into Windows 10+, so the page stays offline); small labels uppercase and tracked.
- **M7 The planet from orbit only.** The GitWorld ocean fades out as the camera comes down to the Land (0 below R/2,
  1 above 1.5 R), so the water ground shows under the city; from orbit the planet is solid as before.

## Tokens (city.css `:root`)

`--bg #0a141c` · `--panel rgba(20,30,38,.74)` · `--panel-solid #121c24` · `--line rgba(232,240,246,.15)` ·
`--line-strong rgba(232,240,246,.34)` · `--text #e8f0f6` · `--dim #a6afb7` · `--faint #646d74` · `--accent #93d3e6` ·
`--accent-2 #e8a873` · `--ok #8bcca1` · `--warn #e3be7b` · `--crit #e4877d` · `--horizon #11202b` · `--cut 6px` ·
`--blur 12px` · `--glow 3px`. Scene: HORIZON 0x11202b, plates HSL 0.57 / 0.3 / 0.06, Alap body 0x56606b, hemisphere
light 0x9ec4d6 over 0x0a1218, moon 0xd2e4ee, beacon and selection ice 0x93d3e6.

## Files touched (2026-10-27)

`CodeCity/src/city.css` (tokens, the skin block at the end), `shell.html` (`#sea`), `38-sea.js` (new), `03-scene.js`,
`07-lens.js`, `32-world.js`, `13-card.js` (the card paints the water too), `06-timeline.js`, `10-query.js`,
`19-select.js`, `21-term.js`, `25-file.js`, `29-land.js` (ice for the instrument's marks). Test hook:
`#seatest=1` steps one wave at once for headless shots.

## Beyond Kódváros

Since 2026-10-27 Mélyvíz is the style of every dev-side app: one shared file `shared/melyviz.css` (`--mv-*` tokens),
copied by `tools/melyviz-sync.js`. Plan, decisions R-1…R-4 and the per-app recipe: `docs/city/melyviz-rollout.md`.

## Open

- The user's dev notes (README §7) are still to come; they may move the setting on any axis.
- Not shot headless: the overlay, the Stadion and constructs, the metro, the ETW beams — check them live.
- Activity colours in 15-follow, 26-jobs, 30-power, 34-stadium, 35-etw stay amber by design (M1).
