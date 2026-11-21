# Design brief — HALCYON desktop + mobile (version B)

*You are a fresh design session. This brief and the system description that follows it (part 2 of this pack, also
delivered on its own as `SYSTEM-B.md`) are **everything you will get**. There is no repository, no database, no
screenshots and no one to answer questions while you work. Read both completely before you start.*

## 0. Your job in one paragraph

Halcyon is an existing in-house software family for a small technical field-service business: a desktop workbench on a
Windows PC and a companion app on Android phones, with a field **Survey instrument** at its centre. The functions exist
and are described in part 2. **Your job is the experience layer:** research how comparable products and the best
field-work, multi-device and touch UIs solve these problems, then create a **design system** and **frontend designs**
for the desktop and the mobile app — visual language, layouts, components, a motion system and a multi-layered control
design that a single owner-operator can use on a site with one gloved hand in full sun, and at a desk with a keyboard.

## 1. What you receive, and how to use it

- **Part 2, the system description**, describes every feature: its job, inputs, outputs, states and the moment of use;
  the architecture, the data flow between phone, PC and cloud, offline behaviour, privacy rules, the "every feature
  switchable" rule, multi-device use, a non-English primary locale and the house interaction rules. Treat it as the
  **functional truth**: you may redesign *how* anything looks and is reached, never drop a feature or change what it does.
- Work **independently**. Do not wait for answers. When something is unclear, choose the most reasonable reading, write
  it down as an **assumption** (numbered, A1, A2, …) and carry on. Collect open questions at the very end (see §6).
- **Do not guess hidden specifics.** If part 2 does not say a thing (exact numbers, real names, a client's data, the
  look of a screen it does not describe), do not invent it as fact. Mark invented content as *sample* or *assumption*.
- Part 2 gives on-screen labels by their English meaning only. The real UI is in a **non-English primary locale** with
  long compound words and diacritics: set your labels in English as placeholders, test every one at **+40 % length**,
  and design so that translated labels will fit.

## 2. Stage 1 — medium-depth research (do this first)

Spend a bounded, medium effort: enough to ground every major decision in evidence, not a literature review. Use the web
if your host allows it; if it does not, say so plainly and work from your own knowledge, marking those points
*unverified*. **Cite sources** (title, publisher or author, URL, date read) for every claim you rely on.

Cover at least these topics; for each, write what you found, what it means for Halcyon, and the decision it supports:

1. **Comparable products** (6–10): field-service and site-survey apps, floor-plan / measuring apps, photo-documentation
   apps, inspection-checklist apps, construction field apps, job-management suites for trades, and desktop workbench
   shells. Examples to start from (verify each, add better ones): magicplan, CompanyCam, Fieldwire, SafetyCulture,
   Jobber, ServiceTitan, Procore, Canvas / room-scanning apps, Fulcrum, and VS Code / Windows / macOS shells for the
   desktop's workbench model. What do they do well for capture under pressure, and where do they fail?
2. **Field-work UX patterns:** capture in any order, interruption-proof drafts, quick chips over typing, checklists that
   grow with the job, derived "what is missing" lists, photo purposes and shot lists, before / after comparison.
3. **Multi-device UX:** phone ↔ PC handover, pairing by QR, two phones on one job, packages instead of live sync,
   device approval, "where does this data live now?" indicators.
4. **Gesture and long-press control layers:** radial / pie menus (marking menus, hold-and-swipe), long-press context
   menus, discoverability and learnability, error rates, accessibility alternatives for each gesture.
5. **Motion design for state changes:** how motion explains existing ⇄ planned, guessed ⇄ measured, a suggestion
   appearing, a question becoming relevant, a capture saved, sync / handover progress; duration and easing standards;
   reduced-motion behaviour.
6. **Accessibility outdoors:** sunlight legibility and contrast, glove-friendly target sizes, one-handed reach zones,
   haptics and sound as confirmation, colour-blind-safe colour coding (Halcyon relies on symbol + colour, so colour must
   never be the only carrier), screen-reader support.
7. **Offline and sync status design:** offline-first indicators, queued work, "· offline + date" freshness, failure
   states that keep the user's text, conflict-free package flows.
8. **Long-word locales:** designing for languages with long compounds, many suffixes and diacritics — truncation,
   wrapping, icon + label strategies, typefaces with full Latin Extended-A coverage.

**Deliverable of stage 1:** a research report (Markdown or a page), 2,500–5,000 words, with a source list and a closing
table *finding → design decision*.

## 3. Stage 2 — the design system

Build one system that serves both surfaces (desktop and phone) and both moods (field and office). Part 2 §4.7 describes
the visual languages in use today (a dark "Deep Water" tool look with ice = you and copper = the system working; a warm
"Paper" style for client documents; an 8-bit terminal launcher). You may evolve them or propose a new language, but
justify the choice from your research, and keep the **Paper** document style as the print family.

The design system must contain:

1. **Tokens**
   - Colour: base palettes (at least a dark field theme, a light / sunlight theme, a high-contrast theme), **semantic
     colours** (ok, warn, critical, info) and **state colours** that cover part 2 §7: existing vs planned, measured /
     derived / ≈ guessed, ⚑ open, ● new, offline, live / beta / planned, delivery green / amber / red, personal-data,
     the seven status-ring states. Keep the seven **Survey front colours** (teal, amber, green, orange, blue, violet, red)
     or replace them with a justified set of seven; show contrast ratios for every text / background pair you use.
   - Type: families with full Latin Extended-A coverage, a scale for desktop and phone, mono for numbers and codes.
   - Spacing, radius, elevation (or the reason there is none), stroke widths, z-layers, target sizes (normal / glove).
2. **Iconography as a symbol + colour language.** The owner wants **symbols and colour codes instead of text buttons**.
   Define the grammar: base glyph set (start from the glyphs used in part 2: ◫ ✎ ☰ ? ◉ ⌖ ⚑, the point types, the photo
   purposes, the chips), how colour, fill, ring, badge and count modify a glyph, how a glyph pairs with a label when
   space allows, and how every glyph stays readable without colour.
3. **Components**, each with all states (default, hover/focus, pressed, disabled with the reason, loading, error, empty):
   front bar with badges, tool rail and its options row, radial wheel, long-press menu, quick-capture buttons, chips and
   ghost cards, question card, shot-list item, purpose strip, viewfinder overlays (purpose badge, level, grid, ghost),
   status ring, toggles with "all on / off", stage badges, the desktop dock, top strip, corner dials, sheets grid,
   command palette, the pager's big keys, cards and tiles of the paged home, notification rows, the "being watched"
   notice, privacy pills.
4. **Motion system:** principles; duration and easing tokens; a choreography for each state change named in stage 1
   item 5; feedback for captures (sound, haptic, visual); the radial wheel's open / slide / commit / cancel; page and
   front transitions; reduced-motion equivalents for every animation.
5. **Layered control design** — the core of this brief. Specify the layers and how a user learns them:
   - **Layer 1, primary taps:** every frequent action reachable with one tap of a visible symbol.
   - **Layer 2, hold-and-swipe radial wheels:** where they appear, sector order rules, ring paging, the centre release,
     how a novice discovers them, and a tap-only fallback.
   - **Layer 3, long-press context menus** ("RCO", everywhere an item has more than one action): anchoring, title,
     destructive lines, haptics, the screen-reader action.
   - **Layer 4, quick capture present everywhere:** ✎ note and ◉ photo on every Survey front, "+ again" after a shot,
     the capture that returns the user to exactly where they were.
   - **Layer 5, settings with per-feature switches** and **"all on / off"** per group, following the rule in part 2
     §4.3 (features arrive on, a switched-off feature leaves no trace, dependencies cascade).
   - The desktop equivalents: keyboard shortcuts, command palette, right-click, double Tab between the two primary
     views, the corner dials.
   - Conflict rules: where a long press already means drag or SOS, what replaces the menu.
6. **Layouts:** phone portrait and landscape grids, thumb zones, the paged home with its persistent top bar and dock;
   the desktop's Dashboard and Desktop views, dock, top strip, dials, sheets; breakpoints; how one Survey screen adapts
   from phone to the desktop page.
7. **Writing rules for the primary locale:** label length budgets, truncation and wrap rules, how decisions are asked
   (numbered options, the recommended one first).

## 4. Stage 3 — frontend designs

Design the key screens and flows for **mobile and desktop**. At minimum:

- **Mobile:** the paged home (page 1 and one dense page) with top bar and dock; the Survey frame on each of its seven
  fronts; the sketch with a radial wheel open; a photo point being assigned a direction; the quick note with chips and a
  ghost suggestion; the questionnaire; the in-app camera viewfinder with purpose strip, level and ghost overlay; the site
  map with the placed sketch and its report; the review and export screen; the settings page with feature switches; the
  crew pager; device approval (both phones); the handover board.
- **Desktop:** the Dashboard view and the Desktop view (dock, top strip, both dials, a sheet with three windows); the
  Survey desktop page (overview + one front); the Planner receiving a survey with ≈ guessed walls; the command palette;
  the printed survey report page in the Paper style.
- **Flows** (as annotated sequences): a chaotic survey (a size before its room, a note about another room, a photo, an
  interruption, back); survey → package → PC → Planner → takeoff → budget draft; two phones on one job meeting on the
  PC; requesting a job-type variant; switching a feature off and seeing it disappear everywhere.
- **States for every key screen:** **empty** (first use, nothing captured), **partial** (half a survey, loose ends),
  **chaotic** (many records in random order, several open items, a contradiction, offline, a failed handover), plus
  loading and error. Show how the design stays calm and legible in the chaotic state.
- **Animation specs** for at least: the radial wheel, a ghost suggestion accepted / dismissed, a question appearing in
  the shadow questionnaire, existing ⇄ planned on a point, a guessed wall becoming measured, a capture saved, the
  handover progress, the status ring's states. Give durations, easing, what moves, and the reduced-motion version.
- **Prototypes** if your tools allow (an interactive HTML page is enough): at least the radial wheel + long-press menu on
  the sketch, and the front bar with quick capture.

## 5. Deliverable format

- If your host offers **"Design System"** and **"Design"** artifact types, use them: the design system as a Design
  System artifact, the frontend designs as Design artifacts (one per surface or per flow), the research as a document.
- Otherwise deliver **self-contained HTML pages** (tokens as CSS custom properties, components and screens drawn in
  HTML/SVG, light and dark) and **Markdown** for the research and the specs.
- Number every deliverable, link them from one index, and keep the vocabulary of part 2 (the same feature names, the
  same labels).

## 6. Quality criteria, and what not to do

**Done well means:**
- every feature of part 2 has a place, and you can point to it (include a coverage table: feature → screen / component);
- every state in part 2 §7 has a visual treatment that works without colour;
- every gesture has a visible or accessible alternative;
- the field screens pass sunlight and glove checks (contrast ≥ 7:1 for primary field text, targets ≥ 48 dp, ≥ 64 dp in
  glove mode, primary actions in the thumb zone);
- the motion system has a reduced-motion twin for everything;
- every label still fits at +40 % of its English length;
- research findings visibly drive decisions.

**Do not:**
- use real data: no real people, companies, clients, addresses, phone numbers or e-mails — **synthetic samples only**,
  obviously invented (e.g. "Client A", "Sample House");
- invent hidden specifics and present them as fact, or add features part 2 does not describe (propose them separately,
  marked *proposal*);
- remove a feature to simplify a screen; hide something a user switched on;
- rename features into a new vocabulary; keep part 2's terms;
- rely on colour alone, on text buttons where a symbol serves, or on a gesture with no alternative;
- end without the open-questions list: numbered, each with options, the **recommended option first**, and a one-line
  plain-language summary; English, with room for the owner to answer in their own language.

---

*Part 2 follows: the Halcyon system description.*
