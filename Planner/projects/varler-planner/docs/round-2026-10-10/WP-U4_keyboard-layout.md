# WP-U4 — Keyboard layout: the camera keys are never captured

Status: todo · Wave U · Depends: — · Size: M (~120 lines incl. hint texts) · Spec: 61 · Decisions: U03 / U04 answered — two selectable layouts

## Goal
*"Find a new keyboard layout which leaves WASDQE keys free for camera moving, as well as the arrow
keys on their default function (height change, device cycle)."*

The full old → new table is **MATERIAL §1** — that is the spec. This WP implements it.

## Read
`src/08-interaction.js` lines 320–410 (the main keydown handler) · `src/05c-actions.js` lines
306–335 (help dialog + registry key dispatch) · the five Tab handlers: `05p-hardware.js` ≈ 206
(hwPlace), `05s-endpoints.js` ≈ 163 (epPlace), `05r-channel.js` ≈ 93 (chnRoute), `05u-arms.js` ≈ 32
(armRoute), `05n-marks.js` ≈ 574 (mrkPlane) — and each tool's hint text.

## Build
1. **One nudge function** in 08, replacing the two copies (grab ≈ 332, selected object ≈ 355):
   ```js
   // Shift + W A S D moves the selection, Shift + Q / E turns it — plain W A S D / Q / E are the camera,
   // always [Q-U03]. Step 100 mm; 10 mm in fine mode (F held or the 🔍 lock), like every other drag.
   function kbdNudge(e){…}   // returns true when it used the key
   ```
   Called at the top of the handler **only for the layout's nudge keys** (Shift+W/A/S/D/Q/E in both
   layouts; plain I/J/K/L/U/O as well in `'ijkl'`) and only when there is a selection (grab: `selected`
   or a multi-set; select: `selected`) — the Object tool ghost too (Shift+Q/E rotates `state.objAng`).
   Fine step: `fineAnchor || state.fineLock` → 10 mm, else 100 mm. Shift+↑/↓ lift stays as today
   (it is an arrow, not part of this change).
2. **Remove the capture**: in grab mode and for a selected object, plain W/A/S/D/Q/E fall through to
   the camera code at ≈ line 364. Ctrl+D (duplicate) and Delete stay where they are.
3. **Two layouts, one table** — `KBD_LAYOUTS={shift:{…},ijkl:{…}}` (MATERIAL §1) and
   `state.kbdLayout` (Settings select `Billentyűkiosztás: Shift + WASD / IJKL`, 05e; default
   `'shift'`). `kbdNudge` reads the active table. `kbdApplyLayout()` runs on load and on change: it
   rewrites the `keys` of `mark.wall` / `mark.wallBack` (J → M) and `circuit.pick` (K → C) in the
   registry and refreshes every hint and help row from the same table. No legacy capture mode.
4. **Tab → arrows / R** (frees Tab for U5):
   - hwPlace (RBX class) and epPlace (endpoint variant): `key(e)` handles `ArrowLeft` / `ArrowRight`
     instead of Tab (← previous, → next). These tools run in select mode, where ←/→ would otherwise
     rotate the camera — the tool's `key()` runs first (`stkToolEvent('key')`, 08 line 326), so
     returning true is enough.
   - chnRoute, armRoute (süllyesztett ↔ csatorna) and mrkPlane (padló ↔ mennyezet): `key(e)`
     handles `e.key==='r'||e.key==='R'` (no modifiers) instead of Tab.
   - Update every hint string that says "Tab" in those five modules.
5. **Help + hints**: the rows in MATERIAL §1 into `help.keys`; `HINTS.grab` →
   `'Mozgatás — kattints egy elemre. Shift+WASD tol (F: finom), Shift+Q/E forgat, ↑/↓ emel, kék gyűrű: forgatás, lila: emelés, sárga sarok: méret, Del töröl, Ctrl+D másol. WASD/QE: kamera.'`
   and `HINTS.object` likewise.
6. **Phone link**: `07a-link.js` `synthKey` forwards `shift` — no change needed; check that
   `07b-phone-camera.js` does not rely on WASD moving a selection (it does not as of 10-09; re-grep).

## Tests — `tests/spec-61-keys.js`
Dispatch `KeyboardEvent('keydown',{key, shiftKey})` on `window`.
1. Grab mode, an object selected: `w` → `state.panY` changed, object x/y unchanged; `W` with Shift →
   object moved by 100 mm along the screen-up direction (rotation-aware, as today), pan unchanged.
2. Same with `fineLock=true` → 10 mm.
3. Shift+`e` → object angle +15°; plain `e` → zoom changed, angle unchanged.
4. Select mode, object selected: plain `d` pans.
5. `kbdLayout='ijkl'`: `l` moves the object +100 mm right, `o` rotates +15°, `m` starts the mark-wall
   tool, `c` starts circuit picking, `j` / `k` start nothing; back to `'shift'` → J / K again.
6. RBX tool active: `ArrowRight` cycles `HW_T.rb` to the next class; camera rotation unchanged; Tab
   does nothing to `HW_T.rb`.
7. ARM tool active: `r` flips `ARM_T.rule`; Tab does not.
8. ↑ in device mode still steps the drawing height; ← in device mode still cycles the device type.

## Verifier focus
Shift+letters arrive as uppercase `e.key` — compare with `toLowerCase()`; the registry dispatcher
(05c line 326, capture phase) must not grab Shift+W etc. (no action has those keys — confirm with
`actionForKey`); Shift+J / Shift+G stay the mark tools' "previous mode"; nothing else changed meaning.

## Browser (owed)
Move tool on P33: select the BASE, press W A S D → camera pans, BASE stays; Shift+D → BASE moves.
