# Kódváros — Claude Design batch pack

Made by `node CodeCity/tools/design-pack.js` (KV-27, 2026-10-27): every look of the city,
1200×750, headless Chrome with software WebGL (SwiftShader) — colours are right, glow and anti-aliasing are a little
softer than on a real GPU. Regenerate after a look changes; the page is `CodeCity/dist/vrg-codecity.html`.

| Look | Shot | Link hash |
|---|---|---|
| Alap — the night city: lit windows = recent work (default, CITY-D6) | [alap.png](alap.png) | `#lens=alap` |
| Hő — heat: recent changes, ironbow ramp | [ho.png](ho.png) | `#lens=ho` |
| Kor — age: last touch, ruins after two years | [kor.png](kor.png) | `#lens=kor` |
| Ügynök — which Claude session touched what | [ugynok.png](ugynok.png) | `#lens=ugynok` |
| Tulaj — owner | [tulaj.png](tulaj.png) | `#lens=tulaj` |
| Nyelv — language | [nyelv.png](nyelv.png) | `#lens=nyelv` |
| Utak — every import road (U) | [utak.png](utak.png) | `#lens=alap&roads=1` |
| Halk fény — low glow (L, KV-27) | [halk.png](halk.png) | `#lens=alap&glow=low` |
| Quality tier low — pixel ratio 0.75 (KV-27) | [minoseg-low.png](minoseg-low.png) | `#lens=alap&quality=low` |
| Tapéta — the wallpaper: the whole Land, no panels (KV-24) | [tapeta.png](tapeta.png) | `#mode=wallpaper&fps=2` |

Not in the pack (need the live segéd or a desktop): the overlay (START.cmd K → F, `#mode=overlay`), the Stadion and
constructs with real programs, the metro, the ETW beams. Shoot them from the served page:
`node CodeCity/tools/shot.js http://localhost:8797/#… out.png`.

## Rules to keep (report §5.5, audited in docs/city/wp/p13-rules.md)

R1 grey-normal · R2 colour never alone · R3 one animation, one meaning · R4 signage only for active buildings ·
R5 places never move · R6 3D for overview, flat panels for reading · R7 every 3D path has a keyboard path ·
R8 active lenses/filters visible · R9 status on the object + one corner · R10 tweens ≥ 400 ms · R11 low glow, render on
demand · R12 card field order. Trademark limits (report §4): no "Tron", Grid/Recognizer/Encom/derezz terms, light-cycle
or identity-disc shapes.

## Dev notes (the user's)

_To be written by the user for the Design batch (docs/city/README.md §7: ask for them first, do not guess)._
