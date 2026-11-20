# Prompt for the local H: session: VRG Kapu file check and restore

*Paste everything between the two lines into a Claude Code session started in `H:\VRG\Full\Planner_VRG_U100`.*

---

Two background facts:

- A cloud session rebuilt the VRG Kapu on Linux. That wrote Windows paths with doubled backslashes into
  `Hub/dist/vrg-kapu.html`, which breaks the Kapu's tool links.
- That broken file was **never committed or pushed**: it stayed in the cloud checkout. The VRG Időjárás
  work that came with it is on `main` (merge `214d823`).

Do this, step by step, and stop to ask me before any commit or push:

1. Confirm where you are: `git rev-parse --show-toplevel` must be `H:/VRG/Full/Planner_VRG_U100`, and
   `git branch --show-current` must be `main`. If either is wrong, stop and tell me.

2. Run `git status -sb`. Then `git fetch origin` and `git pull --ff-only`. If the pull is refused, stop
   and tell me why.

3. Check the Kapu page:
   - `git status --short Hub/dist/vrg-kapu.html`
   - `git diff Hub/dist/vrg-kapu.html | findstr /C:"kpTools" /C:"KP_BUILD"`

   If the file is modified and its `kpTools` line has paths like `"../vrg-toolset\\Planner\\..."` or
   `"dir":".."`, restore it with `git checkout -- Hub/dist/vrg-kapu.html`. If it is not modified, there
   is nothing to restore; say so.

4. Rebuild the Kapu on this PC, where the paths are right:
   - `node tools/build-hub.js`
   - then `node tools/check-hub.js`

   Show me `git diff --stat Hub/dist/vrg-kapu.html`. If only the `KP_BUILD` stamp changed, restore the
   file again with `git checkout -- Hub/dist/vrg-kapu.html`: a stamp-only change is not worth a commit.
   If the tool list changed, show me the `kpTools` difference and ask whether to commit it.

5. Also run the checks the cloud session could not run, because they need H:. Report each as passed or
   failed, with the output of any failure:
   - `node tools/check-start.js`
   - `node tools/check-catalog.js`
   - `node Dashboard/tools/inventory.js`, then `node Dashboard/tools/classify.js`. These refresh
     `docs/desktop/INVENTORY.md` and `CLASSIFICATION.md`, which now gain the VRG Időjárás entries;
     show me the diff.
   - `node Weather/test/run.js` (44 tests, invented data, no network)

6. Finish with the standing routine: `git status`, anything untracked, and anything unpushed. Do not
   commit or push until I say yes.

---
