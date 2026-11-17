# VRG Térkép J layer — refinement pass

The list worked through after the basic check of the jobs-to-map link (`docs/map/JOBS-MAP.md`).
Each item is verified in the browser preview against the invented fixture jobs (`terkep-fixture`, :8803);
colours are read from computed styles / the layer paint, not from screenshots.

| # | Item | What it means here | State |
|---|---|---|---|
| R1 | **Pins and clusters in the VRG Terep look** | Teardrop pins drawn once on a canvas (2× pixel ratio) per status, ink outline, white core; a draft gets a dashed yellow rim. Status colours chosen against the Terep palette (yellow/orange roads, light green parks, blue water): *folyamatban* burnt orange `#d4570f`, *befejezett* deep green `#1f6f43`, *meghiúsult* slate `#6b6470` (failed work recedes). Clusters: ink disc, the rim orange when it holds running work, green otherwise; count in white. Jobs at the same point (BK1/BK2, DM0/DM1) become one pin "BK1 · BK2" with both cards. | done |
| R2 | **Status legend** | The legend is the control: each status chip shows its count and toggles that status. Draft, ring and "no place" are explained. Collapsible. | done |
| R3 | **Filters: status, year, district** | Status chips (R2); year chips from the jobs' dates; an area select (Budapest district or settlement, from the new `area` field that `build-jobs.js` writes — coarse, not an address). Filters apply to pins, rings, clusters, heat and the step keys. | done |
| R4 | **Date slider: the jobs over time** | *Idővonal* (key **I**): a slider over the whole span and ▶ play. A job appears when it starts; jobs running at the slider's date are full colour, earlier ones fade. | done |
| R5 | **Job search by code** | Typing `bk`, `BK2`, `p3` in the search box lists matching jobs (kind *munka*) above the addresses; choosing one flies there and opens its card. | done |
| R6 | **Richer cards** | Status chip, draft chip, the period as a bar on the whole span, total, precision in words, area, source, related jobs as buttons, and two actions: *Közelebb* (the 3D fly-in) and *Link* (copies `?job=CODE`). | done |
| R7 | **Smooth tilted 3D fly-in** | `?job=`, a search hit or *Közelebb*: a flight that ends tilted (62°) and turned, then a slow quarter orbit around the site; any touch or drag stops it; `prefers-reduced-motion` jumps instead. | done |
| R8 | **Density view** | *Sűrűség* (key **D**): a heat layer of the filtered jobs, in the status palette's warm ramp, fading out above zoom 13 where the pins take over. | done |
| R9 | **Keyboard and touch** | **J** layer, **D** density, **I** timeline, **,** / **.** previous / next job (filtered, by date), **Esc** closes the card. Touch: a larger invisible hit area around each pin, the legend and the timeline sized for fingers. | done |
| R10 | **Phone layout (through the relay)** | Below 640 px: the search panel full width, the tools a compact row under it, the legend a bottom sheet, the card a bottom sheet instead of a popup, the "ÜGYFÉLADAT" badge a full-width strip at the top. Every request the page makes is root-relative, so the M8 relay's referer redirect keeps it under `/p/8802/`. | done |
| R11 | **Icons and labels, light and dark** | The UI (panel, buttons, legend, cards, sheet) follows `prefers-color-scheme`. The pins and labels keep their light-basemap palette in both, because the VRG Terep basemap itself is light: a dark pin palette on a light map would lose contrast. Labels get a 2 px paper halo. | done |

Not in this pass: a dark VRG Terep basemap (a new `build-style.js` variant), and real-relay testing
from a phone (the page's requests are checked to be root-relative instead).
