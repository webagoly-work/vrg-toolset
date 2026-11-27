# Prompt for the local H: session: Budapest building heights for the VRG Térkép's B layer

*Paste everything between the two lines into a Claude Code session started in `H:\VRG\Full\Planner_VRG_U100`.*

---

The VRG Térkép has a new **B** layer for measured building heights (`docs/map/RELIEF.md`). A cloud session built and
tested it on invented footprints, but it could not reach the Budapest open-data portal. Do this, step by step, and
stop to ask me before any commit or push:

1. Confirm where you are: `git rev-parse --show-toplevel` must be `H:/VRG/Full/Planner_VRG_U100`, on branch `main`.
   Run `git pull --ff-only`. `Map\tools\build-bp-heights.js` must exist; if it doesn't, the PR is not merged yet, so
   stop.

2. Find the Budapest Open Data Atlas building-height layer (*Épületmagasság*; the research report says about 350 000
   footprints with the height in a field `DN`). Look at opendata.budapest.hu and the Fővárosi Önkormányzat geoportal.
   Tell me:
   - its exact download address and format;
   - its coordinate system;
   - **its licence**, quoted from the portal.

   Do not download it until I have read the licence and said yes.

3. Once I agree, download it and convert it to GeoJSON if needed. Save it as
   `Map\data\src\bp-epuletmagassag.geojson`, then build the heights file:
   `node Map\tools\build-bp-heights.js Map\data\src\bp-epuletmagassag.geojson --licence "<the licence name>"`
   Show me what it prints: the count, the field it used, and whether it recognised EOV.

4. Check one building by eye. Start the map (START → M), go to the Parliament (Kossuth Lajos tér) and turn **B** on.
   Click the main building and tell me the height it shows; the dome is about 96 m. Then turn **S** on and look at
   the shadows at 15:00 on 21 December.

5. Run `node Map\test\run.js`. It must PASS; the page tests need `chrome-headless-shell` here.

Do not commit the data (`Map\data` is gitignored) and do not commit or push anything unless I ask.

---
