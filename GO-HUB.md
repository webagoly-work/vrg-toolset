# GO HUB — VRG Kapu (the access page)

*You were started with the codephrase **GO HUB**. This file is the whole briefing; it does not depend
on any memory note, so it works from any Claude account on this PC.*

## 1. Where

- The main checkout `H:\VRG\Full\Planner_VRG_U100`, branch **`main`** (one checkout since GO MAIN,
  2026-10-24). Confirm with `git rev-parse --show-toplevel` and `git branch --show-current`.
- Kapu lives in `Hub/` (sources `Hub/src/`, the signed allowed list `Hub/data/access.json`, the page
  `Hub/dist/vrg-kapu.html`, the Kapu segéd `Hub/companion/server.js`). Tools: `tools/build-hub.js`,
  `tools/check-hub.js`, `tools/hub-sign.js`, `tools/hub-admin/`.
- Never commit unasked, never push, never switch branch.

## 2. What Kapu is now

Since the 2026-10-26 rework Kapu is only the access page: GitHub sign-in, the signed allowed list,
then `Planner/START.cmd` (started from the page through the Kapu segéd) and START's tool list with
**Megnyitás** / **Mappa** for each. It leads to the shared dashboard, which is still being planned.

The board, editor, refresh, Munkanapló, personal links, tour and glossary (old WP-H1–H3, H6–H9, H11)
were taken out and parked for Kódváros in `CodeCity/from-kapu/` (its README lists them). **Do not
rebuild them in `Hub/`.** The plan pack `docs/hub/` (contract, WP files, status table) describes that
old, full Kapu: read it for history and for the decisions in `docs/hub/DECISIONS.md`, not as a to-do.

## 3. Read first

1. `Hub/README.md` — what the page does, build, test, full mode, the allowed list and its admin page.
2. `docs/hub/04_SETUP-CHECKLIST.md` — the steps for opening the work to the colleague (§4 below).
3. The `launcher/vrg-menu.json` entries Kapu depends on: START `H` (VRG Kapu), servers `O` → `4`
   (Kapu segéd, port 8795), `0` (static dev, 8796), `M` (admin, 8798).

## 4. Open

Waiting for the user (Claude prepares and checks, the user does the clicks):

1. Setup checklist step 3: commit and push what is to be shared.
2. Steps 4–5: invite the colleague as a collaborator (role Write); two-factor sign-in on both accounts.
3. Step 6: the OneDrive `VRG-Megosztott` share ("Adott személyek" only) and its real `00_START` path,
   then `node tools/build-hub.js --onedrive <…\VRG-Megosztott\00_START>`.
4. The clean-profile check, with the user typing their own token.

Done: the pre-share audit (WP-HA), anonymising (step 3a), the signed list (step 8, two people),
`GO STRICT` (`check-hub --strict` → Rendben). The 12 empty OneDrive folder links of the old plan
belonged to the parked board (`CodeCity/from-kapu/data/topology.json`); the current page has none.

## 5. Check

```bash
node tools/build-hub.js
node Hub/test/run.js
node tools/check-hub.js --strict
node tools/check-start.js
```

Rebuild Kapu after any change to START's registry (it bakes the tool list in). All four must be green
before a commit.

## 6. Ask

Questions to the user as numbered items with lettered options (A recommended first), so they can
answer in one line; give the `docs/hub/DECISIONS.md` id when there is one. If the question is visual,
add a simple SVG picture with no overlapping labels.

User working style: phase big work, stop at checkpoints, never commit unasked, Hungarian UI text,
English code. Never ask for, type or store a password or token — each user enters their own token in
their own browser.
