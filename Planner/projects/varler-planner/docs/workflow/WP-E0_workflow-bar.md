# WP-E0 — Munkafolyamat bar (the overlay) + Erősáram as the first electrical layer

Status: todo · Wave E · Depends: R1 (any time after) · Size: S (~120 lines) · Spec: next free · Decisions: Q-E01

## Goal
*"After foundation and rules, it is time for (layer based) everything ELECTRONICS / Villamosság. Starting this step
automatically creates / chooses the first layer of the stack that is not architectural but electrical: Erősáram (on the
same basic layer but separated into dugalj and kapcsoló + lights)."* — and the user's ask to decide what is an
"overlaying control system": this bar is it.

## Read
`05m-stack.js` (`stkActive`, `stkCreate`, `stkLayer(S.id, role)`), `13-role-info.js` (S1 layer menu) · R1010 WP-M1 (the
split: `sys:DED`, `sys:SOC`, `sys:LIGHT` — built 2026-10-13) · `05c-actions.js` (registering actions) · `05d-shell.js`
(stage rail).

## Build
1. A thin bar above the canvas: `1 Alapozás › 2 Nyílászárók › 3 Szabályok › 4 Villamosság` (later phases are added by the
   CONT part). Click a phase → `state.wfPhase`, and the rail shows that phase's tools first:
   - Alapozás: Helyiség-toll (F1), Falak létrehozása (F3), Padló létrehozása (F4), Wall, Move.
   - Nyílászárók: Ajtó, Ablak (O1).
   - Szabályok: Helyiségtípus (R1 hint), Vezethető fal (R2), Szabályok panel (R3), Szabványok (R4).
   - Villamosság: sub-steps `4.1 Végpontok · 4.2 Kapcsolások · 4.3 Dobozok · 4.4 Áramkörök · 4.5 Pályák és vezetékek`.
2. Entering Villamosság: no stack → `stkCreate` the BRIDGE stack; activate the **`sys:SOC` layer for 4.1 sockets and
   `sys:LIGHT` for lamps/switches** — the bar's 4.1 has two buttons `Dugaljak` / `Lámpák + kapcsolók` that switch the
   active layer (Q-E01: A two buttons, B one combined view). DED stays reachable from the layer menu.
3. Each phase shows a tiny check: `Alapozás ✓ 6 helyiség · falak · padló`, `Szabályok: 4 helyiség típus nélkül` — read
   from existing data, never stored.
4. The bar is an overlay: it changes `state.mode`, the active layer and the rail order only. Hidden with Tab (U5) like
   the panels; toggle `Munkafolyamat sáv` in the view menu.

## Tests
1. Phase Villamosság on a project with no stack → a BRIDGE stack exists and the active layer role is `sys:SOC`;
   `Lámpák + kapcsolók` → `sys:LIGHT`.
2. The phase checks: a fixture with 2 rooms, 1 without kinds → `'1 helyiség típus nélkül'`.
3. Golden identical; the bar off → no DOM.
