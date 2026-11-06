# Varler Papír: a new document style + the "Finom" plan render

*2026-11-06. Inspired by two posts from @meginteriormentor: "Concept 1/2/Developer" space-planning sheets
(https://www.instagram.com/meginteriormentor/p/Deb5-CGDz-O/) and the "Contract Kit" pages
(https://www.instagram.com/meginteriormentor/p/DSX1N9ZCm-j/). The images are not ours and are not kept. Everything below
is our own design, written from what the posts made clear.*

Samples (open in a browser, print = PDF):
- `shared/varler-doc/varler-doc.css`: the style, as tokens and components
- `shared/varler-doc/minta-tervezet.html`: a Költségvetési Tervezet in the new style (2 A4 pages, made-up data, same
  structure as DM1 v2). Print it from Chrome (A4, margins: none) for the PDF.
- `docs/research/doc-style/finom-lap.html` + `refine-plan.js` + `finom-plan.svg`: the A3 plan sheet, with the real
  CLA/P33 Planner export re-inked. Preview: `docs/research/doc-style/finom-lap.png`

## 1. What the posts show

- **Concept sheets.** The walls are a warm taupe solid with no black. The floor has a hairline herringbone pattern, the
  furniture is thin warm-grey linework, and the dimensions are light grey with dot ends. The title is a high-contrast
  serif in wide-spaced caps, with a long hairline running in from the paper edge. The text is a small geometric sans.
  About 40% of each page is empty. The "Developer" sheet next to them (black walls, black fills) shows exactly what we
  are moving away from.
- **Contract kit.** Header bands are pale warm grey. Section titles are serif, the body is sans, and tables have thin
  grey rules with tinted header cells. The author's own pitch: a client document should not look like a bank form
  ("black, boring, hard to read"). The same structure can still feel considered.

## 2. Our two styles today

| | Költségvetési Tervezet PDF (DM1 v2) | Hivatalos plan (Planner blueprint / alaprajz) |
|---|---|---|
| Ink | Black table headers, a **solid black FIZETENDŐ bar**, a 4 pt black rule under the header | `#111` pens, `#9a9a9a` grey poche, a **solid black north triangle**, a heavy black frame and title block |
| Type | Times-like bold caps title + Arial | Arial / Segoe UI 700 room names |
| Feel | Correct and complete, but reads like an invoice from a bank | Technically right (ISO pens, M 1:50), but cold and grey |
| Print cost | The black bars and header rows on every page are the largest ink areas in the document | Grey poche walls + a black frame on A3 |

The content structure is good and **stays the same**: header, meta block, Gyorsösszefoglaló, numbered sections,
tables, Összesítés, footer. Only the look changes.

## 3. Design decisions (our own, not a template)

| # | Decision | Why |
|---|---|---|
| D1 | **Warm ink, never black**: text `#2f2c28`, secondary `#6b645b`, labels `#9b9389`, hairlines `#d9d3ca` | The softness of the reference comes from warm greys more than from layout. It also saves ink. |
| D2 | **Ink budget rule**: no area fill darker than `--wash #f5f2ed`, except plan walls (taupe `#cdc3b5`) and small symbols | Fixes the print-cost problem by rule, not by taste. |
| D3 | **One accent, "vezeték" red `#b5452f`**, used for only two things: *new/changed* on plans (CE-Q1 = B) and *the payable total* in documents | Red already means "new" in the trade. Giving it one role in both products ties them together. |
| D4 | **Signature: the incoming line.** A hairline runs from the paper edge to the title and ends on a small open **terminal dot**, like a conductor landing on a terminal | Our own mark. The reference has a line; we add the terminal, which is the electrician's detail. The same dot ends the scale bar. |
| D5 | **Type: Sitka (titles, the subtitle italic, the total) + Bahnschrift (everything else)** | Both ship with Windows, so the offline single-file apps embed nothing. Bahnschrift is DIN, the engineering-drawing face, so it is technically honest. Sitka (Matthew Carter) is the warm serif contrast. Not Inter, not Playfair. |
| D6 | **Figures rule:** Sitka has only old-style figures (R01 reads "Ro1"), so **codes, dates, room numbers and page numbers are always Bahnschrift**; Sitka keeps words and the big total | Found while checking the plan sheet. |
| D7 | **Hanging section numerals**: a large taupe serif numeral in the left margin next to a spaced-caps heading | Navigation without boxes or bars. The wider left margin (24 mm) pays for it, and it also suits binding/punching. |
| D8 | **Tables**: no vertical rules, a pale washed header with spaced small caps, hairline rows, right-aligned tabular money, group rows bold with indented items marked by a short dash | The "contract kit" lesson, with the black header removed. |
| D9 | **Payable total**: a **double hairline** (the ledger convention) above, large Sitka figures in the accent, the band (±10%) below in small text | Replaces the black FIZETENDŐ bar. It still stands out as the most important line on the page. |
| D10 | **Meta block**: label (6.6 pt spaced caps) over value, hairline-separated, no boxes | Same fields, half the visual noise. |
| D11 | **Pages**: one `.lap` = one sheet; the generator paginates, the browser never does (`@page{margin:0}`) | The first print test showed the browser's own page breaks overlapping the footers. |
| D12 | **Plan "Finom" render**: taupe walls with a slightly darker edge, warm-ink pens, systems keep their hue at ~55% chroma, hairline dimensions, an outlined north arrow, a sheet without a frame, and a title strip as label/value pairs over one rule | The Concept-sheet tone, kept as a drawing (pens stay ISO). The systems remain distinguishable. |

## 4. The Finom render in the Planner (not built: the study is string-level)

`refine-plan.js` proves the look on a real export. In the Planner it would be a third style next to `normal` and
`blueprint`: **`finom`**, which shares the blueprint geometry and pens (`BP_PEN`, `AP_PEN`) and only swaps:
`AP_POCHE` → taupe + edge, `#111` → `--ink`, the system colours through a mute function, fonts, the north arrow, and
the sheet frame (`06c` `viewSheetSvg`). The hivatalos/blueprint style stays as it is: the goldens do not move. That
makes it an option, not a replacement.

## 5. Where Varler Papír goes

1. The Workflow Kit offer generator (`offer-A`, `att-*`, `sheets`): swap its CSS for `varler-doc.css` and its black
   bars for `.fiz` / `.sz`. The structure and data are unchanged.
2. Planner sheet export (`06c-view-core.js` `viewSheetSvg`): the title strip and legend in the same tokens.
3. Later: the job plan sheets (`dm1_blueprint.js`-style) as a third consumer.

## 6. Open look questions (⏸ for the user)

- The total in **Sitka old-style figures** (elegant) or **Bahnschrift** (lining, stricter)? The samples use Sitka.
- Plan walls: **solid taupe** (as now) or **taupe with a hairline edge only**? Solid prints more, but reads better.
- The floor pattern (the reference's herringbone): skip it. We draw electrical plans, not interiors.

## 6a. Built in the Planner (2026-11-06, CE-Q5 = B, one round, uncommitted)

`src/06f-finom.js` + small hooks (04 draw → `fnmInk`, 06e `apDevWrap` → `ceChgWrap`, 06e `apAnnotSvg` → `ceLetterItems`,
06c `viewSheetSvg` / `viewPaperArea` → the Finom sheet, 06d passes `finom` + `stats`), the Alaprajz row's two new
checkboxes (*csoportbetűk*, on; *finom*, off), palette actions `view.finom` and `view.apLetters`. Test:
`tests/spec-110-finom-ce.js` (29 checks). Golden renders 70/70 byte-identical. Real exports:
`docs/research/doc-style/gyakorlo-A3-50-{hivatalos,finom}.svg`.

- **Finom** = Alaprajz + `state.apFinom`: the scene is re-inked, and the paper sheet is frameless with the same drawing area as the
  hivatalos one (whatever fits there fits here). The legend flows into the free space: a side column, a band under the
  drawing, then the title band's right part.
- **CE-5** on every printed Alaprajz of a renovation (an endpoint on a Meglévő layer): new = red, existing = black,
  bontandó = ink cross, cserélendő = ink square. The working views keep their system colours.
- **CE-1**: A, B, C… per floor, in reading order of each switched leg; a switch lists every letter it switches.
- **CE-7**: the legend lists each drawn symbol kind with its name, HU switch code (101/105/106/107/108) and standard height.

Open look questions (FNM-Q, also in the chat):
- **FNM-Q1**: ceiling lamps sit above the 1200 mm cut, so they and their letters are hidden on the Alaprajz. A: print lamps
  (and their letters) on the electrical plan regardless of the cut · B: keep the cut rule, the user raises the cut · C: a
  separate lighting sheet.
- **FNM-Q2**: the small endpoint codes (ETH, TVA…) keep their system colour on a change plan. A: follow the point (red /
  black) · B: always ink · C: as now.
- **FNM-Q3**: the total's figures. A: Sitka (old-style) · B: Bahnschrift.
- **FNM-Q4**: plan walls. A: solid taupe · B: hairline outline only.

## 7. CE-Q5 rethought (the first round)

The answers (Q1 B, Q2 B, Q3 A, Q4 A+B, Q6 B) plus this style request change what "first" means:

- **A, style base first, then the content in it** *(recommended)*: R1 = Varler Papír applied to the Workflow Kit
  documents + the `finom` Planner style. R2 = CE-1 (letters A, B… per floor), the CE-5 red = new default and CE-7
  (the legend with descriptions), drawn straight in the Finom style. R3 = CE-2 (dimensions + H=, sheet option),
  then CE-3/CE-4.
- **B, one round**: Finom style + CE-1 + CE-5 + CE-7 together. Faster to see, but a bigger review in one go.
- **C, documents only now**: Varler Papír in the Workflow Kit; the Planner keeps its look until the CE round.
