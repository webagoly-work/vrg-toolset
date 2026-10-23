# WP-H7 — Editor, saving to GitHub (two users), claims

**Goal (user):** "It needs to be updateable by both users separately."

## Depends / decisions
H6. **HUB-Q11** (A = both save straight to main with a conflict check; B = colleague via branch + PR),
**HUB-Q18** (A = claims on).

## Read
`01_ARCHITECTURE.md` §5 · `03_UI.md` §6 *Szerkesztő* · GitHub `PUT /repos/{o}/{r}/contents/{path}`
(`message`, `content` base64 of UTF-8, `sha`, `branch`).

## Build
1. Edits are **operations**, not whole files: `{op:'set', id, field, value}`, `{op:'add', parent, node}`,
   `{op:'hide', id}`, `{op:'claim', id, claim|null}`. `kpApply(topo, ops)` is pure.
   Pending ops live in `kpStore` (`vrgKapu.pendingOps`) until saved, so a closed tab loses nothing.
2. Szerkesztő modal from RCO "Szerkesztés…" / "Új elem ide…": fields t, d, dEn, long, longEn,
   status, links (`repo` / `url` / `local`), department (programs). Live preview on the board with a
   "nem mentett" badge on changed nodes.
3. "Mentés GitHubra": load remote (sha) → `kpApply(remote, pending)` → bump `rev`, set `updated`,
   `updatedBy` → `kpValidate` (must be ok) → PUT with that sha. Message:
   `Kapu: <login> — <n> változás (<ids, max 5>)`. On **409/422 sha mismatch**: reload remote,
   re-apply, show a diff list ("A másik felhasználó közben mentett: …"), ask again. An op whose
   target id no longer exists is reported, not silently dropped.
   HUB-Q11 = B: instead create branch `kapu/<login>-<date>`, commit there, and open
   `https://github.com/{o}/{r}/compare/main...<branch>?expand=1` for the PR.
4. "Exportálás JSON" / "Importálás JSON" (validates first).
5. Claims (HUB-Q18 A): RCO "Foglalás…" → name (= login), until (date picker, default +3 days),
   note → op `claim`; saved like any edit. Badge "⚑ <login>-ig <MM-DD>" on the card; expired claims
   render grey and are removed by the next save. "Ki min dolgozik?" strip lists active claims.
6. Members never see `access.json` fields; the editor cannot touch it.

## Tests (`spec-70-edit.js`)
- `kpApply` set/add/hide/claim on the seed: after `hide planner`, `kpVisible('now')` = 35 programs.
- conflict: remote changed `mindmap.d`, local op changes `planner.d` → merged result has both;
  remote deleted `valena`, local op sets `valena.d` → reported as "elveszett célpont: valena".
- commit message for 7 ops on 7 ids lists 5 ids + "…".
- expired claim (until yesterday) is dropped by `kpApply` + save prep.
- Browser (only with the user present and their own token): edit Planner's `d`, save → a commit
  appears on GitHub with the message format above; refresh shows the new text.

## Out of scope
Editing access.json. Rich text beyond the markdown subset.
