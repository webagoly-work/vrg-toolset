# Simplified UI — DESIGN

*The look is **inspired by** the Zion control room in The Matrix Reloaded (pale, cool, glassy operator panels in a bright
room), not copied from it. No film imagery, fonts or assets: we draw our own, from the tokens below. `mock/sm-mock.html`
shows them in use.*

## §1 Screen

- Everything except the canvas is hidden (contract §2.1). The canvas fills the window: `.wrap` with no sidebars, and no
  header.
- One control: the **dial** (tárcsa), a quarter circle in the **bottom-left corner** (SUI-Q S01 ★A). Its centre is the
  corner of the window, so only the quadrant inside the window shows.
- The **menu** column rises above the dial when it's open. Nothing else is on screen, except:
  - the **hint pill** while a tool runs (§5);
  - a **sheet** when a feature needs a table (S7);
  - the app's modal dialogs (unchanged);
  - the right-click menus on the canvas (unchanged).

## §2 Geometry (CSS px, at 100 % zoom)

| Element | Value |
|---|---|
| Dial outer radius | **88** (hit area = the quadrant only, not the bounding square) |
| Dial rings | outer 88 (2 px), middle 64 (1 px), core 40 (filled) |
| Dial ticks | 10 ticks on the outer ring, every 9°, length 6 px; depth segments = 4 arcs on r 76, 5 px stroke (lit = menu depth) |
| Core glyph | 22 px: `≡` idle · `×` menu open · the tool's icon while a tool runs |
| Menu column | `left: 20px`, `bottom: 100px` (12 px above the dial), width **248**, items **48** high, gap **6** |
| Max items | **5** = 4 content + 1 Back (or Bezár at the root). The Back item is always the **bottom** one, nearest the dial |
| Breadcrumb | 18 px line above the top item: `MENÜ / VILLAMOSSÁG / KAPCSOLÁS`, 10.5 px |
| Search line | replaces the breadcrumb while searching: `⌕ lámp▏   5–8 / 23` |
| Hint pill | `left: 100px`, `bottom: 14px`, max-width `min(560px, 60vw)`, 30 px high, one line, ellipsis |
| Touch | items stay 48 px (≥ 44 px target); the dial core is 80 px in diameter, but only a quarter of it shows |

## §3 Menu item anatomy

```
┌──────────────────────────────────────────────┐
│▌ 02   ⚡  VILLAMOSSÁG                      ›  │   ▌ = 3 px accent bar, visible on focus only
└──────────────────────────────────────────────┘
  index  icon  label (caps by CSS)      chevron (only for a submenu) · "↺" for stay-open toggles · "●" running tool
```

- **Index:** `01`–`05`, tabular numerals, dim. It is also the hotkey (1–5).
- **Disabled item:** the content (index, icon, label) at 45 % opacity, the glass unchanged, so the canvas does not show
  through; a second line, 10.5 px, shows the action's `need` text, or `nem elérhető most`. It
  cannot be activated, but it can be focused, so the reason can be read.
- **Back item:** `◂ VISSZA` (`✕ BEZÁR` at the root), with a slightly darker glass, index `05` (or the next free one).
- **Paging:** a node with more than 4 children shows 3 children + `TOVÁBB ›` as item 4. The breadcrumb shows `(2/3)`.
  Back from page 2 goes to page 1.

## §4 Interaction

| Input | Closed | Open (browse) | Open (search) |
|---|---|---|---|
| Click / tap the dial | open at the root | close | close |
| Ctrl+K (⌘K) | open in search | switch to search | — |
| ↑ / ↓ | (app) | move focus, wrapping | move in the result list (the window scrolls by 1) |
| Enter / → | (app) | activate | activate |
| ← / Backspace / Esc | (app) | Back (Esc at the root = close) | Backspace deletes a letter; Esc or ← on an empty query = back to browse |
| 1–5 | (app) | activate that slot | — (digits are typed) |
| Letters | (app) | start search with that letter | type |
| Mouse hover | — | focus follows | focus follows |
| Gamepad (S7) | the wheel button opens | D-pad ↑↓, A = activate, B = Back | same |

**What activating does:**

| Item kind | Result |
|---|---|
| submenu | the column is replaced (§6 motion); the breadcrumb grows |
| action leaf | `runAction(id)`; the menu **closes** |
| tool leaf (`tool:true`) | `runAction(id)`; the menu closes; the dial core shows the tool; the hint pill appears |
| stay leaf (`stay:true`, toggles like 2D / 3D or a style) | `runAction(id)`; the menu **stays** at this level, so you can try the next |
| generated leaf | as its kind |

- **Clicking the canvas** while the menu is open closes the menu. The click is consumed, so you don't select by accident.
- **Wheel / pan on the canvas** keep working while the menu is open.

## §5 The running tool

- The dial core shows the tool's icon, and the ring turns accent blue.
- **Click the core** = stop the tool (T1 `toolStop()`; fallback: `setMode('select')` + Esc).
- **The hint pill** shows `toolCurrent().hint`, falling back to the text of `#modeHint`:
  - when a tool starts;
  - and whenever `#hud` text changes (via a MutationObserver; only the text is read, never moved).

  It fades after **6 s** (SUI-Q S04 ★A). Hovering the dial brings it back.
- **The validation count** from `statusValidate()` (05c) is a small amber numeral just outside the outer ring at 45° (r 100). Only errors
  show, warnings don't.

## §6 Motion

- **Replace (going deeper):**
  - The old items slide 8 px left and fade, 90 ms, staggered 20 ms from the top.
  - The new items rise 10 px from the dial side and fade in, 140 ms, staggered 25 ms from the **bottom** (Back first).
- **Back:** the same, mirrored: the old items slide right, the new ones come from the left.
- **Open / close:** the dial ring rotates 30° and the column unfolds bottom-up (as replace), in 160 ms in total.
- `prefers-reduced-motion: reduce` → everything is instant. Keyboard repeat never queues animations: a new replace
  cancels the running one.

## §7 Visual tokens (the S6 pass puts exactly these in `:root` under `body.ui-simple`)

```css
--sm-glass:      rgba(214,224,232,.80);   /* light greyish blue — item background */
--sm-glass-hi:   rgba(234,241,247,.94);   /* focus / hover */
--sm-glass-back: rgba(196,208,219,.86);   /* Back item */
--sm-edge-hi:    rgba(255,255,255,.90);   /* top + left hairline (bevel light) */
--sm-edge-lo:    rgba(110,130,150,.45);   /* bottom + right hairline (bevel shade) */
--sm-ink:        #1c2833;                 /* label */
--sm-ink-dim:    #5b6d7e;                 /* index, breadcrumb, disabled reason */
--sm-accent:     #3a8ac4;                 /* focus bar, ring when a tool runs, depth segments */
--sm-glow:       0 0 0 1px rgba(255,255,255,.55), 0 0 16px rgba(130,185,228,.45);
--sm-warn:       #c0530f;                 /* validation numeral */
--sm-scan:       repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 3px);
--sm-font:       "Bahnschrift SemiCondensed","Bahnschrift","Segoe UI",sans-serif;   /* Windows-built-in, offline */
--sm-num:        "Cascadia Mono","Consolas",monospace;                              /* index numerals */
```

- **Item:**
  - background `var(--sm-glass)`, with `var(--sm-scan)` layered on top;
  - `backdrop-filter: blur(6px) saturate(1.1)`;
  - border 1 px, light `--sm-edge-hi` on the top and left, dark `--sm-edge-lo` on the bottom and right;
  - radius 2 px;
  - label 14 px, `letter-spacing: .08em`, uppercase, `--sm-font`;
  - line 2 is one line with an ellipsis;
  - **icons are monochrome ink**: `filter: grayscale(1) brightness(.4) contrast(1.3)` on the emoji. The panel reads as one
    material; colour is kept for the dial core only, where the running tool shows.
- **Focus:** `--sm-glass-hi`, `box-shadow: var(--sm-glow)`, and the 3 px accent bar on the left.
- **Pressed:** the bevel inverts (dark top-left, light bottom-right) for 80 ms.
- **Dial:**
  - same glass with a ring stroke `--sm-edge-lo`;
  - ticks `--sm-ink-dim` at 50 %;
  - depth arcs: `--sm-accent` when lit, `--sm-edge-lo` otherwise.
- **The canvas style is never changed by the mode.** On the dark Ügyfél-előnézet style the glass still reads: it is
  light on dark, by design.

## §8 Accessibility

- The dial is `role=button`, `aria-haspopup=menu`, `aria-expanded`, focusable with Tab only while in simple mode.
- The column is `role=menu`; items are `role=menuitem` (`aria-disabled` when disabled) and are announced with their
  index.
- The visible focus ring never relies on colour alone: the accent bar plus the glow.
