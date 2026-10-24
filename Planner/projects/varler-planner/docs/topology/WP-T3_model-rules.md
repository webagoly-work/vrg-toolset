# WP-T3: Model and rules (`c.topo`, `tpoCheck`)

Status: todo · Wave B · Depends: T1 · Size: M (~180 lines) · Spec: next free · Decisions: Q-T03, Q-T04, Q-T05, Q-T11 · **⏸ before build: the ⚑ rows**

## Goal
*"With this information, circuits should be set covering every device point, and this should be the basis of the
autowiring."*

This WP turns the rules into data and checks. There is no UI beyond the checks bar.

## Read
- `01_RULES.md` §2, §4–§7 (this WP implements TR-G, TR-D, TR-S1/S4, TR-L1/L2, TR-W1/W3/W4, TR-H1, CK-1 … CK-11)
- `00_CONTRACT.md` §3
- `05j-circuits.js` 1–60
- `08o-cpr.js` 21–56 (`CPR_CAT.kind`)
- `08l-wf-switches.js`: `lswLegsOf`, `lswChain`, `lswType` (E1's groups, chain order and switch types)
- `08ob-wf-engine.js` 101–115 (`blSwitchGroups`: how the engine reads the groups today)
- `05m-stack.js` 115, 272–284 (`STK_CHECKS`)

## Build (`src/08pa-tpo-model.js`)
1. **Accessors:**
   - `tpoOf(c)` returns `c.topo` read with defaults (`{v:1, links:[], groups:[]}`);
   - `tpoLinks(c)` drops links whose ends no longer resolve;
   - `tpoSet(c, links, groups)` writes, and the caller has pushed undo.
2. `tpoPattern(c)` returns `'ded' | 'socket' | 'light' | 'string' | 'mixed'`, from `CPR_CAT[c.preset].kind`, the
   members' codes and the link kinds. `szobakor` (sockets + lighting) is `'mixed'`. It is never stored.
3. `tpoGroups(c)` returns the switching groups: from the members' lamp `grp` + the switches' `ctl` (E1), merged with
   `c.topo.groups` for `logic` / `hub`.
4. `tpoSwitchTypes(group)` returns the types per TR-W1 by **calling E1's `lswType` / `lswChain`**, so there is one
   derivation. If they disagree with TR-W1, report it; do not fork them. `tpoCores(link, group)` returns the cores + cable per
   TR-W3 / TR-W4.
5. `tpoCheck(level)` returns `[{sev, msg, rule, ids:[…]}]` for CK-1 … CK-11 (CK-6, CK-7 and CK-12 belong to T1, T10
   and T10). It is pushed into `STK_CHECKS` for the Erősáram roles and shown in the view's checks bar. A row click
   selects `ids[0]`.
6. **Cycle and shape checks:** one DFS per circuit from its board, over `links` as directed edges. It finds a second
   upstream (CK-4), a mid leaf (CK-5), an illegal kind pair (CK-11, the TR-G4 table) and socket branching (CK-9).

## Tests
- one per CK rule, on hand-built `c.topo` over the T1 fixture: a valid tree gives `[]`, and each broken variant gives
  exactly its rule;
- `tpoCores`: the full TR-W3 table, chain and star, for 1, 2 and 3 switches;
- old documents: a circuit without `topo` gives `tpoOf(c).links.length === 0` and no error;
- golden identical.

**⏸ before build:** show the user `01_RULES.md` §5–§6 with every ⚑ (the core table, N through the switch boxes,
branching, the 600 mm). Build what they confirm. A changed value goes into the rules file first, then into the code.
