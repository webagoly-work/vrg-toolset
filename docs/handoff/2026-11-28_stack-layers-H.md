# Prompt for the local H: session: finish the VRG Stack layers line (PR #29)

*Paste everything between the two lines into a Claude Code session started in `H:\VRG\Full\Planner_VRG_U100`.*

---

Background, so you do not have to rediscover it:

- PR #29 (`claude/ecstatic-davinci-tsss1k`) carries the VRG Stack from STRINGS-PLAN S3 to S19:
  - eleven new layers (T N P S J M D V O W, plus the C import sub-layer), with a page for each;
  - the live build (S5), the write gateway (S6) and the page contract (S7);
  - the byte-particle Stack Viewer and Érintésnyom;
  - one shared layer table, `Stack/schema/layers.js` (STK-P213);
  - a CI check for layer letters, `tools/check-layer-letters.js` in `.github/workflows/stack.yml` (STK-P214).

  CI was green and the PR mergeable on 2026-11-28.
- It was all built in the cloud on **fixtures**. No new layer has ever run on this PC's real jobs, boards,
  recordings, Visual Base or access list. Several checks need H: and were never run.
- The open list is `docs/research/reports/VRG Stack - open errors and loose ends.md` (§2 is what this session is
  for). The review is `docs/research/reports/VRG Stack - the layered work graph, review and outlook.md`.
- Privacy rules that hold for everything below:
  - M (jobs): job codes only.
  - W (people): roles only, never a name, email or login.
  - S (asks): the words stay on this PC in `Stack/out/`, never in a commit, the phone bundle or a published page.
  - Nothing that names a client or the client's town goes into a tracked file (the privacy second pass, merge
    `918f335`).

Do this step by step. **Stop and ask me before any commit, push, publish to the phone, or edit of a source the
Stack reads.** Report each step as passed, failed (with the output) or skipped (with why).

1. **Where you are.** `git rev-parse --show-toplevel` must be `H:/VRG/Full/Planner_VRG_U100`. If not, stop.
   Then `git fetch origin` and `git status -sb`.

2. **Is PR #29 merged?** Run
   `git merge-base --is-ancestor origin/claude/ecstatic-davinci-tsss1k origin/main && echo merged || echo open`.
   - **merged:** be on `main`, then `git pull --ff-only`.
   - **open:** stop and ask me whether to merge it on GitHub first, or to work on the branch here
     (`git switch claude/ecstatic-davinci-tsss1k` and `git pull --ff-only`). Do not merge it yourself.

3. **The checks the cloud could not run.**
   - `node tools/check-start.js` and `node tools/check-catalog.js`: both exit 0. A missing file means a START
     or catalog entry from PR #29 points at the wrong place; show me which.
   - `node tools/check-layer-letters.js`: it must print `ok`.
   - `node --test Stack/test/*.test.js`: 169 or more pass, 0 fail.

4. **The first real build.**
   - Run `node Stack/stack.js probe --all`, which records every test suite into `Stack/data/probes.jsonl`. Then
     run `node Stack/stack.js build`.
   - Read `Stack/out/HEALTH.md` and show me every red or amber row.
   - For each new layer (W V M N S T P D O J), give me the node count and whether its adapter failed. A failed
     layer is carried forward or empty; give me the error, the source it read, and your guess at the cause.

5. **Signal noise.** Open `Stack/out/DRIFT.md` §9–20 and count the J signals per kind.
   - The rule from the cloud work: a signal should have five or fewer real hits on this data, or a written
     reason why more is right.
   - For each kind over that, show me three examples and propose how to narrow it. The earlier narrowings
     (`unreachable` 46 → 2, `unverified` 30 → 5) are in `Stack/DECISIONS.md`; use the same style.
   - Change nothing yet. I decide per signal.

6. **Look at the pages on real data.** Start the Stack server (START → O → V, or `node Stack/serve.js`, port
   8806). Open these and tell me what is wrong, blank or slow:
   - the Viewer (`viewer.html`), the Konnektóm (`connectome.html`), the board (`board.html`);
   - the ten new pages: `jelzesek`, `szereplok`, `ajtok`, `kerdesek`, `munkak`, `eszkozok`, `latvany`,
     `kulso`, `probak`, `erintesnyom`.

   Select a node on one page and check that the other open pages light its string. Check the privacy rules
   above on `munkak.html` and `szereplok.html`.

7. **The Kapu.**
   - `node tools/build-hub.js`, then `node tools/check-hub.js`.
   - Show me `git diff --stat Hub/dist/vrg-kapu.html`. If only the `KP_BUILD` stamp changed, restore the file
     with `git checkout -- Hub/dist/vrg-kapu.html`.
   - If the tool list gained the new Stack pages, show me the `kpTools` difference and ask before committing.

8. **The VRG Asztal inventory.** `node Dashboard/tools/inventory.js`, then `node Dashboard/tools/classify.js`.
   Show me the diff of `docs/desktop/INVENTORY.md` and `CLASSIFICATION.md`, which should gain the ten new pages.

9. **The phone (only when I say go).**
   - Dry run first: `node Mobile/stack/publish-stack.js`. It should bundle twelve pages. The Viewer becomes
     `retegek.html` when `Stack/out/layertext` exists.
   - After my yes, publish with START → R → T (or `--push`).
   - Then build and install the app with `Mobile\mobile.cmd`, and tell me which ◢ dial pages to open on the
     phone. I will report back what opens offline.
   - Mobile decision D-191 belongs to this PR's ◢ dial. If a GO MOBILE session took D-191 meanwhile, tell me.

10. **The review for the Data Vault.** The two reports above belong in the Data Vault's research line
    (repository `webagoly-work/data-vault`). Ask me where its checkout is on this PC, then show me where they
    would go, and copy them only after my yes. The bilingual page is in the Archive as `vrg-stack-review`.

11. **Close.** Use the standing routine: `git status`, anything untracked, anything unpushed, and one
    paragraph on what changed in the Stack's numbers (`Stack/out/STATUS.md`). Do not commit or push until I
    say yes. If I say yes, commit by path, never `git add -A`.

---
