# WP-TV3: Roles and checks (`tvKind`, `tvPattern`, `tvGroups`, `tvCheck`)

Status: todo · Wave B · Depends: TV1 · Size: S (~120 lines) · Spec: next free · Decisions: Q-TV03, Q-TV05, Q-TV11, Q-TV17 · **⏸ before build: the ⚑ rows**

## Goal
*"With this information, circuits should be set covering every device point, and this should be the basis of the
autowiring."*

This WP turns the rules the tree does not enforce yet into derived roles and checks. It writes no data.

## Read
- `01_RULES.md` §2, §4–§7. This WP implements: `tvKind` (README §2), TR-G3, TR-G4, TR-D2, TR-S4, TR-W1 and CK-5,
  CK-8 … CK-11, CK-13, CK-14.
- `08od` `upRole`, `upChain`, `upCheck` :117–128 (its rows are reused, not rewritten)
- `08l` `lswLegsOf`, `lswChain`, `lswType`
- `08o-cpr.js` `CPR_CAT` (`kind`)
- `05m-stack.js` :115, :272–284 (`STK_CHECKS`)
- `02_ENGINE_GAPS.md` table (for CK-14)

## Build (`src/08ta-tpo-model.js`)
1. **`tvKind(child)`** returns `'feed' | 'master' | 'chain' | 'sw' | 'lamp' | 'bad'`, by the README §2 table, from
   `epCodeOf` / `type` / `jb` of the child and of `upDev(child.up.id)` or `upDoor(…)`.
2. **`tvPattern(c)`** returns `'ded' | 'socket' | 'light' | 'string' | 'mixed'`:
   - from `CPR_CAT[c.preset].kind` and the members' codes;
   - `'string'` when the circuit's hubs form a chain;
   - `szobakor` (sockets + lighting, CLANV4) is `'mixed'`.
3. **`tvGroups(c)`** returns `[{grp, lamps, switches, head, logic:'chain' | 'star' | 'mixed' | 'none', hub?}]`. The
   logic is **read from `up`** (TR-L1, Q-TV17 A):
   - **star:** every switch and the first lamp have `up` = the same mid;
   - **chain:** the switches form one `up` chain and the lamps hang on its end;
   - otherwise `'mixed'`.
4. **`tvCheck(level)`** = `upCheck(level)` (as is) + the engine's last-run rows that cite a node (`R.warn` with `ids`,
   `tree:true`) + the TV rows:
   - **CK-5:** a mid with no child;
   - **CK-8:** a DED whose `up` is not the board, or a dedicated circuit with ≠ 1 member;
   - **CK-9:** a socket with 2 or more socket children. Sev from Q-TV11: info.
   - **CK-10:** a group whose `lswType` set does not fit TR-W1 and none has `typeFix`;
   - **CK-11:** `tvKind` = `'bad'`;
   - **CK-13 / CK-14:** the G-gap notes. A link the engine will not follow yet: a socket whose `up` is a plain KD (G1);
     hub → hub (G2); a group read as star (G3); `tpoRole` set (G4).
   - Each row is `{sev, msg, rule, ids}`. It is pushed into `STK_CHECKS` for the Erősáram roles and shown in the view's
     checks bar. A click selects `ids[0]`.
5. **`tvCores(group, link)`** returns the TR-W3 row (cores + cable) for the inspector and TV7's hover. It is the doc
   table; the engine's own count (plan.js :261–269) is shown beside it, and a difference is a CK-10-style info line,
   **not a correction**.

## Tests
- one per TV check, on hand-built `up` over the 2-room fixture: the valid tree gives no TV row, and each broken variant
  gives exactly its rule;
- `tvKind`: every row of the README §2 table, plus one `bad` pair;
- `tvGroups`: chain / star / mixed on a 3-switch group;
- `upCheck`'s rows pass through unchanged (deep-equal);
- golden identical.

**⏸ before build:** show the user `01_RULES.md` §5–§6 with every ⚑: the core table, N through the switch boxes, socket
branching, the 600 mm. A changed value goes into the rules file first.
