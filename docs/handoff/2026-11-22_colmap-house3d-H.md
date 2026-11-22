# Prompt for the local H: session: install COLMAP for Ház 3D (skcam K5)

*Paste everything between the two lines into a Claude Code session started in `H:\VRG\Full\Planner_VRG_U100`.*

---

The Sketcher's **Ház 3D** (WP M63, START P → 3) runs COLMAP on a house's photos. A cloud session built and tested it
on Linux with COLMAP 3.9.1. This PC needs COLMAP under `H:\VRG\Full\tools\colmap`. Do this, step by step, and stop to
ask me before any commit or push:

1. Confirm where you are: `git rev-parse --show-toplevel` must be `H:/VRG/Full/Planner_VRG_U100` and the branch
   `main`. `git pull --ff-only`. `Sketcher\tools\house3d.js` must exist; if not, the K5 PR is not merged yet: stop.

2. Tell me whether this PC has an NVIDIA graphics card (`nvidia-smi`, or Device Manager). That is my open question Q4,
   and it decides the download.

3. From the official releases page only (https://github.com/colmap/colmap/releases), pick the newest release that has
   Windows binaries. Take `…-windows-cuda.zip` with an NVIDIA card, otherwise `…-windows-no-cuda.zip`. Show me the
   exact file name, its size and its SHA-256 (`certutil -hashfile <zip> SHA256`), and compare the hash with the one on
   the release page if it gives one. Keep the ZIP in `H:\VRG\Backup\installers\` and add an `installerRules` line for
   `tools\colmap` in `launcher/vrg-menu.json`'s `backup` block, as the other tools have.

4. Extract it so that `H:\VRG\Full\tools\colmap\COLMAP.bat` exists. Check that
   `H:\VRG\Full\tools\colmap\COLMAP.bat help` prints the version, and note whether it says "with CUDA".

5. Run the end-to-end test: `H:\VRG\Full\tools\node\node.exe Sketcher\test\house3d-e2e.test.js`. It renders 40 photos
   of a known house, runs the whole pipeline (a few minutes), and must say ALL PASS. If COLMAP 4.x rejects an option,
   show me the error: `house3d.js` retries the other spelling once, and the fix may need a line there.

6. Run the checks the cloud session could not run, because they need H:. Report each as passed or failed, with the
   output of any failure:
   - `node tools\check-start.js` (the new START P → 3 entry)
   - `node tools\check-catalog.js` (the new `sketcher.house3d` unit)
   - `node tools\build-hub.js` (the Kapu bakes in the tool list), then `node tools\check-hub.js`

7. Create `H:\VRG\Full\inbox\haz3d\` if it is missing, and tell me it is ready for the first real house's photos.

Do not commit or push unless I ask.

---
