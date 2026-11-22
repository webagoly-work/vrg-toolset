# Prompt for the local H: session: file the Sketcher Kamera+ dev line

*Paste everything between the two lines into a Claude Code session started in `H:\VRG\Full\Planner_VRG_U100`.*

---

A cloud session researched offline room capture and measuring for the Sketcher camera. It wrote
`docs/research/2026-11-20_room-capture-and-measurement.md` and the line brief `docs/sketcher/CAMERA-LINE.md`. It could
not reach `H:\VRG\Full\notes\devlog\`, so the dev line itself is not filed yet.

Do this, step by step, and stop to ask me before any commit or push:

1. Confirm where you are: `git rev-parse --show-toplevel` must be `H:/VRG/Full/Planner_VRG_U100` and
   `git branch --show-current` must be `main`. Then `git fetch origin` and `git pull --ff-only`. If the two docs above
   are not there yet, the cloud branch `claude/quirky-mccarthy-con8dp` has not been merged: tell me and stop.

2. Read `docs/sketcher/CAMERA-LINE.md` §5 and `H:\VRG\Full\notes\devlog\lines.js`. Find the lane that holds the Sketcher
   / VRG Mobile lines and the line that M24–M31 (Vázlat, Fotópont, Kamera) belong to. If no such line exists, tell me
   which lines come closest and ask which one `skcam` forks from.

3. Add the `skcam` entry to `LINES` as §5 gives it, with `lane` and `from` filled in, and keep the file's own style.
   If the file has its own convention for ids or status words, follow it and tell me what you changed.
   Write `H:\VRG\Full\notes\devlog\lines\skcam.md` as the line's doc: a short pointer to
   `docs/sketcher/CAMERA-LINE.md` and the research note, plus the next step.

4. Re-parse `lines.js` (`node -e "require('H:/VRG/Full/notes/devlog/lines.js')"`, or the way `notes/devlog/build.js`
   loads it) and run `notes/devlog/build.js` if it exists. Then rebuild the stack
   (`H:\VRG\Full\tools\node\node.exe Stack\build.js`) and check that the line can be found:
   `...\node.exe Stack\stack.js q "Sketcher Kamera+"`.

5. Report in five lines: the lane and the fork you chose, the files you changed, and whether the build and the search
   passed. Do not commit or push unless I ask.

---
