# WP-TV12: Engine gaps G1–G8, handed to GO ROUTE

Status: todo, **owned by GO ROUTE** · Depends: GO ROUTE §2 answers · Size: per G-item (S–L) · Spec: next free, one per G-item

## Goal
*"This should be the basis of the autowiring."*

GO WIRE T2 made the engine fit the `up` tree. What the Topology View lets the user say beyond that is listed in
`02_ENGINE_GAPS.md` as G1–G8.

This WP is a placeholder that points there. **Each G-item the user picks becomes its own WP**, under GO ROUTE's build
order (`GO-ROUTE.md` §5): `G<n>_*.md` in this folder, using `02_ENGINE_GAPS.md` §G<n> as its Build / Tests.

## Rules for every G-item
- **Engine code only** in `tools/baseline` (pure Node, no `fs`, no DOM), then `node build.js` bundles it. The Planner
  glue goes in `08ob` (`blInput`) only where the item needs input.
- **CLI ↔ bundle parity:** spec-98 stays green. On a cloud session it is skipped for lack of client data, so the
  practice flat is the net there.
- **The quantity golden first:** if the practice-flat engine-quantity golden (money-path audit §7.8) does not exist
  yet, the first G-item adds it. Each later item lists the metres it moves on it.
- **The money-path audit's findings come first** where they touch the same code:
  - MP-12 is inside G3;
  - MP-13 sits beside G4's box rules;
  - MP-4 / MP-5 are routing correctness that a new feature must not make worse (GO ROUTE §1).
- **The view (TV9–TV11) needs no change** when a G-item lands. A G-item that would change the `R` shape (`legs`, `pts`,
  `boxes`, `spans`) updates `tpoOverlay` in the same commit.
- **CK-14** loses its line for that G-item in the same commit.

## Suggested first pick (for GO ROUTE §2)
**G7, then G1, then G4.**
- G7 is tiny and makes every later router change watchable in TV11.
- G1 is the smallest thing that lets the user's kötődoboz model route.
- G4 makes "depart only in a box" true, which is the user's central conduit-sharing rule.
- G2, G5, G3, G6 follow; G8 is the router core GO ROUTE decides on.
