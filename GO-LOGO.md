# GO LOGO — the two-state Varler logo, and the new VRG Mobile home page

*You were started with the codephrase **GO LOGO**. This file is the whole briefing. Written 2026-11-02 at the end of
the design session that made the animated logo.*

## What the user asked for (2026-11-02)

- The animated logo has **two states**: logo v1 (the bulb) and the original divergence ring. A click or tap toggles
  it, and it **changes form** between them. It does not cross-fade.
- In **VRG Mobile** this becomes the **home page**:
  - swipe sideways from it to reach the other feature pages;
  - the current home (the tile grid) moves **under** it, reached by swiping up.

A separate design session is putting the wordmark back onto the original and the animated logo, so **text is not part of
this work**. Leave room for a lockup later (see Q4); do not draw text.

## 0. First

1. Confirm: `git rev-parse --show-toplevel` = `H:/VRG/Full/Planner_VRG_U100`, `git branch --show-current` = `main`,
   then `git status -sb`. The rules of `GO-MAIN.md` §5 hold: never commit or push unasked, `git add` by path.
2. Read `shared/varler-logo/README.md` (the engine, its options, the shared geometry). Open
   `shared/varler-logo/preview.html` (serve the folder) and move the morph slider: that is the raw material.
3. For the Mobile phases also read `GO-MOBILE.md` §1–2 and `docs/mobile/README.md` (architecture rules). Mobile phases
   follow GO MOBILE's routine: WP file, catalogue stage BETA, a phone checklist, stop at the end of the WP.
4. Ask the open questions below in one reply, as numbered A/B/C options with A recommended. Record the answers at
   the bottom of this file. Do not build before the answers.

## What is already there

- `shared/varler-logo/`:
  - `divergence.js` is the one file a page loads; it is built from `engine.js` + `marks.js` + `logo.json` by `build.js`.
  - `VarlerDivergence.mount(canvas, { form: 'logo' | 'ring', morph: 0..1, mark: 'F', lockup: 'mark', theme })` mounts it.
  - Logo v1 = form `logo`, mark `F`.
  - `morph` 0 = ring and 1 = logo, and every value in between is valid. Sample `i` is the same point of the ring in
    both forms: the band bends, the events move to their places, the mark fades in and the view slides.
  - **Nothing animates `morph` yet.** That is L1.
- The design canvas <https://claude.ai/artifact/6jugeKG8uuf5PLFREtiqQ6>, page "Logo v1", has the two boards. The ring
  board has a `morph` tweak.
- VRG Mobile (`Mobile/android`) is Kotlin + Compose.
  - `ShellActivity.HomePages()` is a `HorizontalPager`: page 0 is `HomeScreen` (the tile grid), page 1 is Gömb (M14).
  - Gömb is drawn natively in Compose (`feature-sphere/Disc.kt`), with its drag-inside-the-disc rule.
  - The app has no WebView yet.

## Phases (stop at each ⏸ and show the user)

**L1 · The toggle, on the web side (shared code).**
- Add `api.toggle()` and `api.setForm(form, { duration })` to `engine.js`. Each tweens `morph` with an eased curve,
  0.9–1.4 s, tuned by eye. Leave the old API as it is.
- Choreography to try: the band unbends first, then the mark grows in late (`mark alpha = smoothstep(0.55, 1, m)`); the
  strata keep running through the change; one burst at the moment of arrival.
- Reduced motion: jump, no tween. A toggle during a tween reverses from where it is.
- Rebuild, add a click-to-toggle mode to `preview.html` and to the canvas's ring board (a new blob upload, then repoint
  that board).
- ⏸ The user judges the transition on the canvas and in the preview.

**L2 · How Mobile draws it (Q1).**
- If WebView (Q1 = A): copy `shared/varler-logo/divergence.js` into the app's assets at build time; a Gradle task copies
  it, so there is never a hand-made second copy. Add a small `LogoView` in `kit` with a transparent WebView, no network,
  JS on, and a `toggle()` bridge.
  - Taps go to JS, swipes stay with the pager.
  - Pause when the page is off-screen or the app is in the background.
- If native port (Q1 = B): port `engine.js` to a Compose `Canvas` the way M14 ported the sphere. Add a JVM test that
  checks the LUT and the sample geometry against values from `divergence.js`.
- ⏸ It runs on the phone: frame rate and battery use, checked on the user's device over adb.

**L3 · The new home (WP M15, `home`; Hungarian name per Q2).**
- Write `docs/mobile/WP/M15.md` first, add its catalogue entry and the roadmap row, then build.
- The layout per Q2/Q3:
  - a vertical pager whose top page is the logo home and whose page below is today's `HomeScreen` (the tile grid,
    unchanged);
  - the logo home sits inside the existing `HorizontalPager` as page 0, with Gömb and the other feature pages beside it.
- Back from the grid returns to the logo; back from the logo leaves the app as today.
- The `UpdateMark` (⟳ új) and the settings glyph must stay reachable from the logo page (a quiet corner, or a hint on
  the swipe-up edge).
- First run: one discreet hint for "swipe up for the tools", shown once.
- ⏸ Phone check list in M15.md, catalogue stage BETA, the "what I could not verify here" note.

## Open questions (ask at the start)

- **Q1 · Drawing on the phone.**
  - A) WebView running the shared `divergence.js`. It is one engine for the web and the phone, so a change reaches both
    with no second copy. The cost is about 40 MB of WebView memory and the JS bridge.
  - B) Native Compose port, like Gömb. Lighter and fully native, but the code is held twice and the two drift apart.
  - C) A rendered video or Lottie loop of each state plus the transition. Cheapest at run time, but no longer generative.
- **Q2 · What tapping the logo does on the phone.**
  - A) It toggles the form only.
  - B) It toggles, and a long press opens Beállítások.
  - C) It toggles, and the ring state also shows a status line (relay and GitHub state) inside the eclipse.
- **Q3 · Which state the app opens in.**
  - A) The ring, which turns into the logo once the app is ready, as a loading moment.
  - B) Always the logo.
  - C) The last state it was in.
- **Q4 · Room for the wordmark.**
  - A) Keep the lower third free for the lockup that the design thread is making, and add it when it lands.
  - B) The logo is centred and the text never goes on the home page.

## Answers

*(record here: Q1 = , Q2 = , Q3 = , Q4 = ; date)*
