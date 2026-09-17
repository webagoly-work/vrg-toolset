# Browser verification checklist — everything jsdom could not confirm

**How to use this.** Do the action, pick the letter that matches what happened, send me a list like:

```
P1 A · P2 C · P4 B (only the second wall) · K3 D — Alt opened the Chrome menu
```

`D` always means "something else — one line of what happened". A one-word `A` is a complete answer; only B/C/D need detail.

**Priority key:** ★ blocking (a refactor decision depends on it) · ○ good to know.

**Before you start:** open the shipped file, load the Domoszló project, and note browser + OS + zoom level (e.g. "Chrome 127, Win 11, 100%"). If you test on the phone too, do group **T** there.

---

## P — Plan canvas: pointer, camera, drag

**P1 ★ Drag a device on the plan.** Press on a socket, move slowly across the screen, release.
- A — follows the cursor smoothly and lands where I released
- B — follows but lags / jumps in steps
- C — stops following if the cursor leaves the canvas or passes over a panel
- D — other

**P2 ★ Drag fast and off-screen.** Grab a device, whip the pointer off the window edge, come back, release.
- A — keeps tracking the whole time, drops correctly
- B — drops the item as soon as the pointer leaves the window
- C — item sticks to the cursor after release (drag never ends)
- D — other

**P3 ★ Draw a path.** Path mode, click 4–5 points along a wall, Enter to finish.
- A — every click lands, the line previews between clicks, Enter finishes
- B — clicks land but there is no preview line while moving
- C — some clicks are swallowed / double-register
- D — other

**P4 ○ Wall snap.** Draw at 1100 mm along a wall, then turn on *szabad köztes magasságban* and draw again.
- A — first run sticks to the wall, second runs free
- B — both stick to the wall (toggle has no effect)
- C — both run free (snap never engages)
- D — other

**P5 ○ Camera.** Right-drag to yaw, both-buttons-drag to pitch, wheel to zoom.
- A — all three work
- B — right-drag opens the browser context menu instead
- C — pitch (both buttons) doesn't work
- D — other

**P6 ★ Right-click hit priority.** Right-click on: a device / a path line / an empty wall / an empty floor.
- A — each gives the menu that belongs to that thing
- B — one of them gives the wrong menu (say which)
- C — the browser's own context menu appears somewhere
- D — other

**P7 ○ Context menu near the screen edge.** Right-click something in the bottom-right corner.
- A — the menu flips and stays on screen
- B — the menu runs off screen / gets clipped
- D — other

---

## G — Move tool and the gizmo

**G1 ★ Purple Z handle on a device.** Select a socket, drag the purple square up and down.
- A — height changes, the mm badge updates live, guide lines catch it
- B — moves but there is no badge / no guide snap
- C — the handle can't be grabbed
- D — other

**G2 ★ Z handle on a wall.** Select a wall, drag the purple handle.
- A — the wall lifts off the floor and the 3D view shows the gap
- B — the badge changes but the wall doesn't visibly move
- C — the wall has no purple handle
- D — other

**G3 ○ Z handle on a floor and on a window.** Same test on a floor slab and on a window.
- A — floor rises as a podium, window sill changes
- B — one of them does nothing (say which)
- D — other

**G4 ○ Red/green axis arrows and the rotate ring.**
- A — both axes constrain correctly, rotate works
- B — an arrow moves the wrong axis
- D — other

**G5 ○ Corner resize handles on a wall/floor/object.**
- A — resize works from all four corners
- B — resizing jumps or flips the shape
- D — other

---

## K — Keyboard and modifiers

**K1 ★ Space places from the palette.** In path mode press Space.
- A — the selected item drops at the cursor
- B — the page scrolls instead
- C — nothing happens
- D — other

**K2 ★ ←/→ cycle the palette.** In path mode, press ← and → a few times.
- A — the HUD shows the item name changing and the ghost updates
- B — the camera rotates instead
- C — nothing happens
- D — other

**K3 ★ Alt = fine movement.** Start dragging something, hold Alt mid-drag, keep moving.
- A — movement slows to a crawl, HUD says finomhangolt
- B — Alt focuses the browser menu bar and the drag breaks
- C — Alt does nothing
- D — other *(on Mac: report whether you used Option)*

**K4 ○ ↑/↓ change drawing height.**
- A — steps through the guide lines, HUD shows the mm
- B — the page scrolls
- D — other

**K5 ○ Ctrl = other wall side while drawing.**
- A — the run flips to the far face and stays there
- B — no effect
- D — other

**K6 ★ Esc and Enter.** While drawing a path press Esc; while drawing press Enter.
- A — Esc cancels, Enter finishes
- B — Esc closes something else (a dialog, the editor)
- D — other

**K7 ○ Delete/Backspace on a selection.**
- A — deletes the selected item(s)
- B — the browser navigates back
- D — other

**K8 ○ Typing in a number field.** Click into any mm input and type 1250, arrow keys included.
- A — types normally, arrows change the number
- B — arrow keys also move the drawing / change height behind the dialog
- D — other

---

## W — Wall elevation editor

**W1 ★ Open it.** Right-click a wall → *Fal nézet*.
- A — opens, drawing fits, everything legible
- B — opens but the drawing is cut off / scrolls oddly
- C — opens tiny or oversized
- D — other

**W2 ★ Drag a device inside it.** Drag a box left/right and up/down.
- A — smooth, snaps to 10 mm, badge shows the position
- B — jumpy or the drag ends early
- D — other

**W3 ★ Drag a whole path section.** Grab the *line* (not a node) and move it.
- A — both ends move together, neighbours follow
- B — grabbing the line selects a node instead
- C — nothing grabs
- D — other

**W4 ★ Warp mode.** Alt+click a section line, then drag a corner handle.
- A — the orange box appears, the whole run stretches about the opposite corner
- B — Alt+click does nothing (see also K3)
- C — the box appears but the handles can't be grabbed
- D — other

**W5 ★ Sub-dialogs.** Right-click a section → *⌀ Cső átmérő* → OK. Then repeat and press Mégse.
- A — both return to the wall view, OK applies the change
- B — Mégse closes the whole editor
- C — OK closes the whole editor
- D — other

**W6 ★ Coordinate list.** Type an exact value into *balról* and into *földtől*.
- A — the item moves to exactly that mm, the drawing updates
- B — the value snaps to 10 mm anyway
- C — the field resets / nothing moves
- D — other

**W7 ★ Save vs discard.** Move something, press *Elvetés*. Then move something, press *Mentés*, then Ctrl+Z in the main view.
- A — discard reverts everything; save keeps it and one Ctrl+Z undoes the whole session
- B — discard didn't revert
- C — Ctrl+Z after save undid too little/too much
- D — other

**W8 ★ Fullscreen.** Press ⛶, then Esc.
- A — fills the window, drawing scales up, Esc returns to normal size
- B — fills the window but the drawing stays small
- C — Esc closes the editor instead of leaving fullscreen
- D — other

**W9 ○ Undo inside the editor.** Ctrl+Z / Ctrl+Shift+Z with the editor open.
- A — steps back and forward within the session only
- B — undoes things outside the editor too
- D — other

**W10 ○ Create from the wall.** Right-click empty wall → add a socket, a window, and draw a path.
- A — all three appear in the right place and survive Mentés
- B — one of them lands in the wrong position (say which)
- D — other

**W11 ○ Mirror and far side.** Toggle *Tükrözés* and the far-side layer.
- A — mirrors correctly, far-side items appear greyed
- B — mirrored drag now moves the wrong way
- D — other

---

## F — Floor / álmennyezet / ceiling plane editor

**F1 ★ Open it.** Right-click a room → *Padló nézet*, then switch through all three planes.
- A — all three open, walls solid on floor, ghosted on the two ceilings
- B — one plane is empty when it shouldn't be (say which)
- D — other

**F2 ★ Drag in top view.** Move a lamp and a path node.
- A — smooth, heights unchanged
- B — the item's height changed as well
- D — other

**F3 ○ Riser markers.** In the ceiling plane, find a run that drops to a switch.
- A — ⊙ with an arrow and the target height is visible
- B — no marker where I expected one
- D — other

**F4 ○ Álmennyezet.** Set 2400 for the level, open the álmennyezet plane.
- A — plane opens at 2400, the caption shows the plenum, the translucent plane shows in 3D
- B — opens but the 3D plane isn't visible
- C — the height field didn't take
- D — other

**F5 ○ Coordinate list + height column.** Type a new X and a new magasság.
- A — both apply exactly
- B — one of them doesn't (say which)
- D — other

---

## D — Dialogs

**D1 ★ Wall properties.** Right-click wall → *Fal tulajdonságai*, change thickness to 100, apply.
- A — wall thins about its centreline, live m²/m³ readout updated while typing
- B — applies but the readout never updated
- C — the wall moved sideways instead of thinning symmetrically
- D — other

**D2 ★ Room data sheet.** Fill it in, then press *⤓ Alkalmaz a helyiség készülékeire*.
- A — only that room's sockets/switches move to the new heights, one Ctrl+Z undoes it
- B — devices in other rooms changed too
- C — nothing moved
- D — other

**D3 ★ Lamp sheet.** Open a lamp, set függesztett + 800 drop, tick *Objektum generálása*, save.
- A — a fixture box appears in 3D at the right height
- B — the box appears at the wrong height
- C — no box appears
- D — other

**D4 ★ Lamp image.** Upload a photo in the lamp sheet.
- A — thumbnail appears in the dialog and the file stays small (project still saves)
- B — the image appears but saving the project now fails / is slow
- C — nothing appears after choosing the file
- D — other

**D5 ★ Hover preview.** With the lamp saved, hover over it on the plan in select mode.
- A — the picture pops up next to the cursor and follows it
- B — pops up in the wrong place / off screen
- C — never appears
- D — other

**D6 ○ Store link.** Press *↗ Megnyit* in the lamp sheet.
- A — opens the webshop in a new tab
- B — blocked by the popup blocker
- D — other

**D7 ○ Door type.** Change a door to tolóajtó, then to garázskapu; check the 2D blueprint style.
- A — the symbol changes correctly each time
- B — the symbol doesn't change until I redraw/switch view
- D — other

**D8 ○ Door orientation.** Use *Zsanér oldal* and *Nyitásirány*.
- A — the swing arc flips as expected on both axes
- B — one of them looks wrong (say which)
- D — other

---

## N — Notes

**N1 ★ Create a note** in the wall editor and in a plane editor.
- A — the dialog opens immediately, text with a line break renders wrapped
- B — an empty note is left behind if I cancel
- D — other

**N2 ○ Edit by double-click.**
- A — double-clicking a note opens the editor
- B — double-click drags it instead
- D — other

**N3 ○ Kinds.** Set one of each: figyelmeztetés, teendő, kész.
- A — colours, icons and the strike-through on *kész* all render
- B — the icons show as empty boxes
- D — other

---

## X — Export, print, files

**X1 ★ PNG export** from the wall editor and from a plane editor.
- A — a PNG downloads and looks like the screen
- B — downloads but text/icons are missing or boxes
- C — downloads blank/black
- D — nothing downloads

**X2 ★ Print / PDF.** Press *Print/PDF*.
- A — a new tab opens with the drawing and the print dialog
- B — blocked by the popup blocker
- C — opens blank
- D — other

**X3 ○ JSON export and re-import.** Export, then import into a fresh tab.
- A — the project comes back identical (spot-check walls, chases, lamps, notes)
- B — comes back but something is missing (say what)
- D — other

**X4 ○ Background image load.**
- A — loads, positions, scales
- B — loads but can't be positioned
- D — other

---

## S — Storage and projects

**S1 ★ Autosave.** Make a change, wait 3 s, reload the page.
- A — everything is where I left it
- B — some things reverted (say what)
- D — other

**S2 ★ Multiple projects.** Save two projects, switch between them.
- A — clean switch, no bleed-through
- B — something from project 1 appears in project 2
- D — other

**S3 ★ Storage limit with photos.** Add 5–10 lamp photos, then reload.
- A — everything still saves and reloads
- B — a quota error appears / saving silently stops working
- D — other

---

## R — Render fidelity (a real browser vs my test renderer)

**R1 ★ White halo text.** Look at chase labels (`⌀20 · 32×30`) and device refs over dark lines.
- A — dark text with a clean white outline
- B — text appears solid white / invisible
- D — other

**R2 ★ Chase hatch.** Look at a corner where two runs meet.
- A — one continuous 45° hatch, no seam, single outline
- B — visible seam or double outline at the join
- C — no hatch visible at all
- D — other

**R3 ○ Ghosted walls in the ceiling plane.**
- A — dashed, see-through, clearly different from the floor view
- B — looks the same as the floor view
- D — other

**R4 ○ Emoji in menus and notes** (⌀ ✥ ⊙ 🔗 ⚠ ☐).
- A — all render
- B — some show as boxes (say which)
- D — other

**R5 ○ Blueprint style.** Switch to the official 2D style with dimensions on.
- A — clean, printable, dimension chains readable
- B — overlapping text somewhere (say where)
- D — other

---

## Q — Performance (this decides how urgent the render rework is)

**Q1 ★ Drag with a full project loaded.** Open the largest real project you have and drag a device around for a few seconds.
- A — smooth, feels immediate
- B — noticeable lag but usable
- C — choppy / unusable
- D — other

**Q2 ★ Same, in the wall editor** on a wall with many items.
- A — smooth · B — laggy · C — unusable · D — other

**Q3 ○ Rough size of your biggest project.** How many devices and paths roughly, and how many levels?
- A — under 100 devices · B — 100–300 · C — 300+ · D — I'll count exactly

**Q4 ○ 3D vs 2D.** Is one noticeably slower?
- A — about the same · B — 3D slower · C — 2D slower · D — other

---

## T — Phone / tablet (only if you use it on site)

**T1 ○ Open on the phone.** Does the mobile layout appear?
- A — yes, usable · B — appears but cramped · C — desktop layout on a phone · D — other

**T2 ○ One-finger drag and two-finger zoom/rotate.**
- A — both work · B — drag works, gesture doesn't · C — neither · D — other

**T3 ○ Right-click equivalent (long press).**
- A — opens the context menu · B — no way to reach it · D — other

**T4 ○ Editors on a small screen.**
- A — usable · B — the coordinate list or buttons are unreachable · D — other

---

## If you only have 20 minutes

Do these ten and nothing else — they cover the decisions that block the refactor:

**P1, P2, K1, K3, W3, W5, W7, D2, Q1, R1**

---

---

## ⟳ RE-TEST list (fixed in v0.9.1)

These were reported in round 1 and have been changed. Re-test **only these** plus the group-2
items you haven't reached yet; everything else you already answered `A` stands.

| id | what changed | what to check now |
|---|---|---|
| P6 | a floor slab hit fell through to a Delete-only menu; the room menu is now shared | right-click a floor → full room menu (adatlap, plane views, rename, label toggle) |
| P7 | menu is viewport-fixed and flips/clamps at the edges | right-click bottom-right → menu stays fully on screen |
| W5 | the menu was behind the editor modal (z-index) | right-click inside the wall editor → menu appears **on top** |
| — | new: action rail down the right side of both editors | click a device / path line / note → its actions appear as buttons; with nothing selected the create block shows |
| — | device visibility rewritten (face normal + real occlusion) | orbit a full turn: a device never flips to "direct" while a wall is between it and you |
| G2 G3 | height was applied but invisible from directly above | 2D top view: raised wall gets a dashed outline + `↑900`, raised floor gets `↑150 dobogó`; 3D unchanged |
| G5 | four corner handles → four edge handles, single-axis | red pair changes width only, green pair depth only, live size readout |
| K2 | palette name + a size swatch added to the floating height display | draw a path: the box shows `␣ <item> · 68 mm` and a grey square scaled to it |
| K3 | Alt now preventDefaults, **F** works as an alias, plus a 🔍 finom lock button | hold Alt mid-drag → slow movement, no menu bar; if Alt still misbehaves use F or the button |
| K8 | number inputs blur on Enter / after change | type a value, press Enter, then use ↑/↓ → the drawing responds, not the input |
| W8 | `#modal` had a hard max-width/height that beat the inline style | ⛶ → the drawing itself gets bigger, not just the window |
| W11 | mirror kept as correction; new 🔄 Túloldal nézet | press it → the far face, right way round |
| — | doors/windows locked to the wall centreline | drag a door → it can no longer sit on a face or off the wall |

Version is now shown next to the title in the header (`v0.9.1`) — quote it in any further report.

## Reporting shorthand

```
Env: Chrome 127 / Win11 / 100%
P1 A · P2 A · P3 B · P6 B (path line gave the device menu)
K1 A · K3 B
W3 A · W5 A · W7 C (Ctrl+Z undid only the last move)
D2 A · D3 B (box 400 too low)
Q1 B · R1 A · R2 A
```

Anything not listed I'll treat as untested, not as passing.
