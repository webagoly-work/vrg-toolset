# V8b · Konyha: notes for the main session

Batch file `05zc-objart-konyha.js` · 14 names on 14 new families · `node check.js konyha` → **1044 passed, 0 failed**
(2026-10-14). Contact sheet: `out/05zc-objart-konyha.html` (1194 × 4717 px at 1 : 25).

Top-level names added (all `oaKo` / `OA_KO`): `OA_KO`, `oaKoDrop`, `oaKoPlinthS`. 05zb untouched. No approved family
is reused for a new name: none of the 14 is the same thing as `pult`, `felso` or `huto`.

## Families

| family | name | resize | fixed mm | counted (part tag) |
|---|---|---|---|---|
| `sarok` | Konyhapult (sarok) | param | worktop 40, overhang 30 on the front **and** right face, plinth 100, door 18, handle 160 | leaves per open face = ceil(face / 600) (`door`, F and R); shelves = round(carcass / 380) − 1 (`shelf`, L) |
| `fiokos` | Fiókos alsó 60 | param | worktop 40, plinth 100, top drawer 144, gaps 2 | units ceil(w / 600) × (1 + round((h − 284) / 300)) drawers (`drawer`) |
| `beepito` | Magas szekrény (beépítő) | param | plinth 100, handle zone 20, door 18, niche 600 from 860 (≤ 0.4 h) | columns ceil(w / 600); left column: drawers round(760 / 380) (`drawer`), empty niche (`niche`), doors above round((h − niche top) / 750) (`door`); other columns: a lower + the upper door(s) |
| `kamra` | Kamrapolc | param | uprights 30, shelves 25, bottom shelf 100 | bays ceil((w − 30) / 1000); levels round((h − 100) / 380) + 1 (`shelf`, F per bay, L per level) |
| `sziget` | Konyhasziget | param | worktop 40 / overhang 30, plinth 100, waterfall 40 (left), end shelf 300 (right), cabinets 620 deep (bar overhang behind) | units ceil(between / 600), a drawer + door each (`drawer`, `door`); end shelves round(724 / 300) − 1 (`shelf`, R); joints (`joint`, T) |
| `mosogato` | Mosogató | param | worktop 40, plinth 100, false front 144, bowl 180 deep, tap hole r 18 | doors ceil(w / 600) (`door`); false fronts per unit (`panel`); bowls ceil((w − 100) / 700), ≤ 450 wide (`bowl`, T) |
| `tuzhely` | Tűzhely 60 | param | handle zone 40, pan supports 30, panel 120, drawer 140, knob r 18 | burner columns round(w / 300) × 2 rows (`burner`, T), a knob per burner (`knob`, F) |
| `indukcio` | Indukciós főzőlap (sziget) | param | glass 6, body inset 30, control strip 70 | zones round(w / 350) × 2 (`zone`, T) |
| `suto` | Sütő beépített | **stretch** | handle zone 40, fascia 20, control strip 100, 2 knobs r 20, display 140, handle 45 under the strip | nothing (`door` 1, `knob` 2 tagged for the record) |
| `mikro` | Mikró beépített | **stretch** | handle zone 30, fascia 20, control column ≤ 140, handle ≤ 200 | nothing (`door` 1, `knob` 1) |
| `amhuto` | Amerikai hűtő | param | handle zone 40, door 70, kick 60, handle ≤ 900, dispenser 220 × 330 | doors = w ≥ 750 ? 2 (side-by-side, freezer 0.45 w left + dispenser) : 1 (`door`, `dispenser`) |
| `mosogatogep` | Mosogatógép 60 | param | lid 20, kick 100 (20 below h 700), panel 100, door 50 | racks = round((h − 200) / 220), 1…3 (`rack`, L, hidden) |
| `para` | Páraelszívó | param | rim 70, chimney ≤ 260 × 260 at the back, slope ≤ 250 | grease filters ceil(w / 300) (`filter`, T, hidden) |
| `kave` | Kávégép (pult) | **stretch** | drip tray 30 proud × 50, display 50, spout head 100, spouts 16 | nothing (`spout` 2) |

Resized sizes on the sheet (each changes a count, except the three stretch families):
sarok 1000 × 1000 × 900 · fiókos 1200 × 600 × 900 · beépítő 1200 × 600 × 2200 · kamra 1600 × 400 × 2000 ·
sziget 2400 × 1000 × 900 · mosogató 1200 × 600 × 900 · tűzhely 900 × 600 × 900 · indukció 380 × 520 × 60 (domino) ·
sütő 600 × 560 × 450 (compact) · mikró 600 × 400 × 450 · amerikai 700 × 700 × 1900 (single door) ·
mosogatógép 550 × 500 × 450 (table-top) · pára 900 × 500 × 800 · kávé 240 × 430 × 360.

Swing marks (D-V8-2 2b A) on every hinged door. Side-hinged doors follow 2c A. The three drop-down doors (oven,
cooker, dishwasher) point the mark at their bottom hinge (`oaKoDrop`).

For the main session, about the checker: `check.js`'s R = L mirror test pairs up the two bounding-box corners
`circ` stores, and that pairing breaks under mirroring. So a `circ` in the `S` view of a `sym` family always fails,
even though it renders correctly. The hood's fan is drawn as a fully rounded `rect` for that reason. spec-78 #7 has
the same shape, so the same rule probably holds in the Planner too.

## Questions (A = what is built)

1. **Konyhapult (sarok): what the corner cell is.** The catalogue box is 600 × 600 with F L R T.
   **A** an L-door corner unit: fronts on the front and the **right** face (inside corner front-right), closed
   left side. The front leaf hinges on the carcass (left), and the side leaf hinges on the front leaf, which is the
   left edge of the R drawing. Worktop overhang and plinth set-back on both open faces.
   **B** a blind corner: one door on the front, a blind panel where the next run butts, a plain R.
   **C** a diagonal corner unit (45° door). This needs a deeper box than 600 × 600.
   Note that A is handed (the open side is on the right). A left-handed corner is today the same object
   rotated, so its R and L swap.
2. **Magas szekrény (beépítő): the appliance niche.** **A** drawn empty (the niche reveal only), because
   `Sütő beépített` / `Mikró beépített` are separate objects placed into it. **B** draw an oven front in the niche
   (reads better on its own, but doubles up when the user also places the oven). **C** two niches (oven 600 +
   micro 380) when h ≥ 2200.
3. **Mosogató: the tap.** It would stand ~300 above the worktop, outside the 900 box (hard rule 5), so **A** only
   the tap hole is drawn. **B** draw the tap and let the catalogue h grow to ~1200 (changes OBJLIB, so it is the
   user's call). **C** draw it in T only (it then disagrees with F / L).
4. **Konyhasziget: the two ends.** **A** waterfall end on the left (L), open end shelves on the right (R), and a
   bar overhang behind cabinets 620 deep. **B** both ends plain (then it could be `sym`, but the user listed L and R).
   **C** seating overhang at the right end instead of behind.
5. **Amerikai hűtő: the layout.** **A** side-by-side (freezer left with the dispenser), falling back to one door
   under w 750. **B** French door (two doors over a freezer drawer), counted the same way.
6. **Tűzhely 60: gas or electric.** **A** gas look: pan supports above the body, burners with caps, one knob per
   burner. **B** ceramic top (flush glass with zones, as `indukcio`), with no pan supports.
7. **Stretch families (sütő, mikró, kávégép).** **A** stretch with the fixed details listed (D-V8-1 A: nothing to
   count). Ovens come as 600 / 450 high and 600 / 900 wide. **B** count the knobs from w (2 at 600, 3 at 900).
