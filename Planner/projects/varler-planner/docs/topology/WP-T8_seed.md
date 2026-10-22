# WP-T8: ✨ Javaslat (seed the topology)

Status: todo · Wave B · Depends: T3–T7 · Size: S (~120 lines) · Spec: next free · Decisions: Q-T03, Q-T06, Q-T07

## Goal
The view must never open empty on a plan that already has circuits. The suggestion fills every gap by the rules,
so the user only corrects.

## Read
- `01_RULES.md` §8 (the seed table)
- `08oa-wf-eloplan.js` 101–120 (`elpDialog`: the table pattern to copy for `tpoTable`)
- `08pa` (T3) and `08pc` (T5–T7: the link writers to call, not to duplicate)
- `08n` `jbMeet`
- `09-menus.js` 103 `openModal`

## Build (`src/08pa-tpo-model.js`)
1. **`tpoTable(title, rows, cols, onApply)`.** The shared approval table: an `openModal` with ☑ per row, a "Miért?"
   column (the rule id + a short text) and **Alkalmaz**. T10 reuses it.
2. **`tpoSuggest(level)`** returns per circuit `{ref, links, groups, ownPipe, why:[ruleIds]}`, computed by §8:
   - DED: a feed from the board;
   - socket: the classic chain via `tpoAutoChain`, or a chain from the mid the user already linked;
   - `vil`: the V1 string (TR-H4) through the mids that are `jbMeet` of its groups, then the groups via the T7
     suggestion;
   - `szobakor`: the room's mid, else the board.
   - **Fixed links are inputs, never outputs.** The suggestion completes around them (TR-G6).
3. **The button** `✨ Javaslat` (toolbar) opens `tpoTable`:
   - one row per circuit, e.g. `A1 · lánc · 4 dugalj · leader S1 · TR-S2, TR-S3`;
   - rows whose circuit is already complete and valid are greyed `'kész'`.
   - Alkalmaz writes the ticked rows with `fix:false`, as one undo step.
4. **First open:** if the level has circuits and none has a `topo`, the view offers the suggestion once (a HUD button,
   never automatic).

## Tests
1. The 4-room fixture with E4's circuits applied → `tpoSuggest` gives one row per circuit, and after Alkalmaz
   `tpoCheck` returns only warnings (CK-1, CK-6, CK-7), no errors.
2. A fixed master link KD1 → S3 on A1 is kept, and the chain is built from S3.
3. Re-running after Alkalmaz changes nothing (idempotent: deep-equal).
4. `vil` gets `ownPipe:true` and a string touching exactly the mids that its groups' `jbMeet` returns.
