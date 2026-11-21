# VRG Térkép — turn-by-turn guidance and the optional traffic check (N3)

*WP M57, built 2026-11-21: N3 of the navigation line (feed N1 → own routing N2 → guidance and traffic N3).
D-130: no traffic by default; TomTom as an opt-in on a tap, with the user's own key.*

## Guidance

- In the Térkép-feed, hold a place: once its route is drawn (N2), the card offers **▶ Indulás**.
- While guiding:
  - **The banner** (top) shows the next maneuver: its arrow, how far it is and the instruction
    ("Forduljon jobbra – Bolt utca"), and what comes after it ("majd ⚑ Megérkezett: Közeli Aldi").
  - **The bar** (bottom) shows the arrival time, the distance and time left, 🔊/🔇,
    **◎ Követés** (only after you moved the map by hand) and **■ Befejezés**.
  - The other panels are hidden.
  - **The camera** follows you, turned along the route and tilted. Dragging the map stops following
    until ◎ Követés.
  - **Voice:** the first words ("Induljon el kelet felé – Fő utca. 150 méter múlva forduljon jobbra –
    Bolt utca"). Then each maneuver at 700 / 250 / 50 m by car (120 / 30 m on foot), the nearest cue only,
    never twice. Finally "Megérkezett: …" within 25 m.
  - Leaving the route by 45 m plans a new one (N2), and the guidance continues on it ("Új útvonal").
- Voice on the phone: Android's own text-to-speech, Hungarian when the phone has the voice. The page asks
  through `vrg-map:say`, because the WebView's speechSynthesis is not reliable on Android. On the PC: the
  browser's speechSynthesis in Hungarian. On the phone the screen stays on while guiding (`vrg-map:keepon`).

**The maneuvers** (`Map/lib/guide.js`, from the route's legs):
- A junction where the mode had no other way to go is never announced: the road only bends, even if its
  name changes.
- At a junction with a choice, a turn is announced from 35°, or from 12° when the street name changes.
  The wording comes from the angle: tartson enyhén / forduljon / forduljon élesen jobbra · balra,
  forduljon vissza, haladjon tovább egyenesen.
- A roundabout is one step: "A körforgalomban a 2. kijáraton hajtson ki – Déli út". The exits counted are
  the ones the mode could take. On foot: "…kijáratnál menjen tovább".
- Entering a slip road: "Tartson jobbra a lehajtóra".
- Street names come after a dash, so there are no Hungarian suffixes to get wrong.
- The road file carries the street names, roundabouts and links since format 2 (`tools/build-roads.js`;
  format 1 is still read, without names).

## Traffic (optional, D-130 B)

- ⚙ in the feed → **TomTom kulcs**: paste your own key from developer.tomtom.com. It is kept in this
  browser's storage, so on the phone it stays on the phone.
- With a key, a held **car** route offers **🚦 Forgalom**. One tap sends one request to `api.tomtom.com`
  with the position, the destination (coordinates) and the key. The card then shows
  "Forgalommal ~14 perc (+4 perc dugó) · saját becslés ~11 perc".
- Nothing is sent on its own, for walking, or for the list of places. ⚙ counts today's requests. The
  Freemium plan allows 2 500 a day, commercial use allowed.
- `Map/lib/traffic.js` builds the v1 `calculateRoute` request (`traffic=true`) and reads `travelTimeInSeconds` /
  `trafficDelayInSeconds`. TomTom's docs disagree on whether v1 is in the free plan, so the **first real request
  is the check**: on 403 the card says the key or the plan does not cover it, and the Orbis v3 endpoint is
  the fallback to add then.
- On the phone, `api.tomtom.com` is the one new host the map page may reach (`MapRoute.mayGoOut`, GET only).

## Limits

- No lane guidance, no speed-camera or speed-limit warnings, and no turn restrictions (N2's limits apply).
- The traffic check changes only the shown time, not the route: our router has no traffic. Re-routing
  around a jam would need TomTom's route geometry (a later step if wanted).
- GPS on a phone jumps in city canyons. The prompts follow the route-matched position (`along`), not the
  raw fix.

## Tests

- `Map/test/guide.test.js`: an invented town with a crossroads, a forced bend with a new name (silent), a
  roundabout (exits 1 / 2 / 3, walking wording), the spoken forms and `next`.
- `Map/test/traffic.test.js`: the request (no key, no request), the answer, the messages.
- `Map/test/feed-page.test.js`, headless:
  - ▶ Indulás and the banner's steps;
  - the first words, once;
  - no prompt inside a cue already said, the 50 m prompt, "Megérkezett";
  - ■ Befejezés;
  - the 🚦 check against a stand-in TomTom.
