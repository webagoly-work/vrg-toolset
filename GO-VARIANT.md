# GO VARIANT — make a Variant Sketcher for one kind of job

*You were started with the codephrase **GO VARIANT**, perhaps with a `variant-request-*.json` from the phone (it is on
the PC's Átadás board, `H:\VRG\Full\inbox\board\<date>\`) or a few sentences about a job.*

1. Work in the main checkout, branch `main` (`git rev-parse --show-toplevel`), as every line of work (CLAUDE.md).
2. Follow **`Sketcher/variants/PROTOCOL.md`** to the letter: read → (ask for a premise if thin) → plan → ask the crucial
   questions and for photos → write `Sketcher/variants/<id>.json` → `node Sketcher/tools/variant-check.js` +
   `node Sketcher/test/run.js` + `node Sketcher/tools/build.js` → report original → variant → commit on `main`.
3. The design behind it: `docs/sketcher/README.md`. The phone side: `docs/mobile/WP/M31.md`.
4. Since M49 / M50 a variant can also tune the drawing tools: the optional `draw` block (PROTOCOL.md's table: six keys,
   the last `lineClose`; `docs/mobile/WP/M49.md`, `M50.md`). A request from the phone carries counts and scope only,
   never the client's name, address, contact or a personal photo (checked end to end in `docs/mobile/WP/M53.md`).

A variant is data only, and generic: **no client name, address or photo of someone's home goes into it** (it is
committed to Git).
