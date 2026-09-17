# Varler Planner 2.0 — tool taxonomy, tool pages, phone protocol

Status: **design, not committed.** Nothing here is built. This exists to hold the
shape of the thing while 1.1 work continues, and to be argued with.

Written 25 Aug 2026, from the category model and the three-page tool concept.

---

## 1. Tool taxonomy

Four groups. Three are categories of work; the fourth is the set of tools that
apply across all of them and therefore must never be hidden by a category switch.

### Construction — what gives the house its form

| mode | state today |
|---|---|
| `floor` | exists |
| `wall` | exists |
| `roof` | exists |
| `build` | exists |
| `object` | exists |

### Electrical

| mode | state today |
|---|---|
| `board` — Elosztószekrény | **new.** Placement first; its own editor later |
| `device` | exists |
| `path` | exists (no number key) |
| `cable` | exists |

Ordering is deliberate and matches how the work actually happens: the board is
placed first, and everything else is downstream of it.

### Data — reading, extracting and configuring rather than drawing

| feature | state today |
|---|---|
| Wiring mind map | planned (1.1 backlog, `dagre` scouted) |
| Path inspector — open a path/kötődoboz under the cursor, show wires crossing that point | **new**, visual approach to be specified |
| Export: blueprint, whole or partial, hivatalos/normál render, 2D/3D | partial |
| Order lists → spreadsheet, selectable content | partial (`PapaParse` scouted) |
| Lists: lamps, hyperlinks, notes | partial |
| Symbol set: which icon represents what | **new** |
| Theme: three custom colours, or a preset | **new** |
| Info / súgó | exists |

### Utility — always available, never filed under a category

`select` · `grab` · `format` · `measure` · `note`

These are modal helpers, not authoring tools. On the phone they live in a fixed
strip that does not change when the category changes.

### Open structural question

Does this taxonomy reorganise the **planner's** tool rail too, or is it only how
the **phone** groups things? Reorganising the desktop rail is a bigger change
than it looks — muscle memory, the `1`–`9` keys, `TOOLKEYS`, and every golden
render that includes the rail. Doing it on the phone alone costs nothing and
tests the model first. **Recommendation: phone first, desktop later or never.**

---

## 2. Three pages per tool

Every major tool gets three views on the phone, swiped or tabbed between.

### Page A — Minimal

Near-black. No chrome. Faint, transient visual feedback only when a gesture or
the gyro is doing something. This is the page you leave open while working: the
phone is an input device, not a screen you look at.

Design rule: **nothing on page A may require looking at the phone.** Anything
that does belongs on page B.

### Page B — Controls

Every keyboard action for that tool, as a button, with its hint. This is the
page that makes the phone a genuine keyboard replacement on a ladder.

Source of truth: the `HINTS` table in `08-interaction.js`. It already documents
each mode's keys — Path's ↑/↓ height, ←/→ rotate, Space for kötődoboz, Ctrl to
flip side; Grab's WASD/QE/Del/Ctrl+D; Wall's radír toggle. **Page B should be
generated from `HINTS`, not hand-written per tool**, so a new shortcut appears on
the phone the day it appears in the app. Hand-tuned layout only where a slider or
a stepper beats a button.

### Page C — Configurator

The genuinely new idea, and the one worth the most.

Design an element on the phone *before* it exists in the drawing, then **Send**.
The planner receives it, and the element appears under the cursor already picked
up, ready to place.

| tool | page C |
|---|---|
| `wall` | Isometric wall diagram, arrows/sliders off each dimension (Sims wall editor as the reference). Thickness, height, length. |
| `object` | Same treatment — bounding dimensions and orientation. |
| `cable` | Visual wire picker: pick the count and colours. Send loads the cable tool. Recent sets kept as history; any set saveable as a preset. |
| `device` | Which device Space drops, its height, its side. |
| `board` | Later — this is where the Elosztószekrény editor eventually lives. |

#### What this requires from the planner

A concept that does not exist yet: a **pending prefab** — a configured, not-yet-
placed element held by the active tool, which the next click commits.

This is the single biggest architectural addition in 2.0. It needs:

- a prefab schema per tool, versioned alongside the project schema
- a "loaded" indicator in the planner UI, since the cursor now carries state
- a way to clear it (Esc) that doesn't collide with existing Esc behaviour
- decisions about what happens on tool switch while loaded

**It is worth building the prefab concept for the desktop first, driven by a
normal dialog.** If it works with a mouse, the phone becomes a nicer front end to
it rather than the only way to reach it. Building it phone-only would make a core
authoring feature depend on a second device being present and paired.

#### Preset scope — open question

Are cable presets **project** data (they travel in the `.vplan`, and a house with
unusual wiring keeps its own) or **application** data (they travel with you
across every job)? Both are defensible. Application-scoped with an
export/import is probably right, but it changes where they're stored.

---

## 3. Phone ⟷ planner protocol

### The requirement

A sophisticated two-way link, with a simple one-way link as a guaranteed
fallback. The way to get both without maintaining two protocols is **capability
negotiation**: one wire format, and each side announces what it can do.

### Envelope

```json
{ "v": 1, "from": "phone", "seq": 412, "t": 1756142000123,
  "type": "cmd", "payload": { } }
```

`from` matters immediately. The relay currently rebroadcasts every message to all
other clients, which is fine while traffic flows one way. The moment the planner
also sends, a third client — or a reconnect — can produce echo loops. Each side
ignores messages carrying its own role.

### Handshake

On connect, both sides send `hello`:

```json
{ "type": "hello", "role": "planner", "app": "2.0.0",
  "caps": ["state", "cmd", "prefab", "keys"] }
```

- Phone sees `state` in the planner's caps → enables the reactive tool pad
- Phone does not see it → falls back to blind one-way sending, everything still works
- Planner sees `prefab` → accepts configurator payloads

**This is what makes the fallback real rather than aspirational.** An old phone
page against a new planner degrades to one-way instead of half-working.

### Message types

| type | direction | purpose |
|---|---|---|
| `hello` | both | handshake, capabilities |
| `orientation` | phone → planner | gyro (exists) |
| `gesture` | phone → planner | zoom/pan/reset (exists) |
| `cmd` | phone → planner | **semantic:** `{tool:'path', action:'heightUp', n:1}` |
| `keys` | phone → planner | escape hatch: a synthetic keystroke |
| `prefab` | phone → planner | a configured element from page C |
| `state` | planner → phone | active tool, level, selection, heights |
| `ack` | planner → phone | prefab received and loaded, or rejected with a reason |

Semantic for everything a tool panel does; keystrokes only where no semantic
command exists yet. That keeps the phone working when you rebind a key, without
blocking on a complete command vocabulary before anything ships.

### `state` throttling

The planner must not stream at frame rate. **On change, coalesced, ≤10 Hz.**
The hook is `setMode()` for tool changes; selection and level changes need their
own. Everything the phone shows is a readout — none of it is authoritative, and a
dropped `state` message must never corrupt anything.

### Reconnect

The phone already retries every 2 s. With `state` in play it must also **request
a full snapshot on reconnect**, or it will show a stale tool panel after a WiFi
blip. Cheap to add, easy to forget.

---

## 4. Sequencing

Roughly a year of evenings if all of it gets built. Ordered so each step is
useful alone.

**2.0-a — protocol** · envelope, `hello`, roles in the relay, `state` on
`setMode()`, `cmd` dispatcher. Nothing visible; everything else depends on it.

**2.0-b — page B, generated** · tool pad driven by `HINTS`. First real payoff:
the phone becomes a keyboard on a ladder.

**2.0-c — page A + gesture set** · the minimal page and the designed gestures,
with the help overlay. Editable tool wheel lands here.

**2.0-d — prefab, desktop first** · the pending-prefab concept with a normal
dialog. The largest single piece.

**2.0-e — page C** · configurators on top of 2.0-d. Wall and cable first; they
have the clearest shape.

**2.0-f — board mode** · Elosztószekrény placement. Its editor is a separate
project.

**Separate projects, not phases:** the wiring mind map, the path inspector, the
symbol editor, the theme system. Each is large enough to deserve its own design
document.

---

## 5. Risks worth naming now

- **Scope.** The Data category alone contains three features that are each bigger
  than the whole phone link. It should probably be split out of 2.0 entirely.
- **Prefab as phone-only** would make a core authoring capability depend on a
  paired second device. Build it for the mouse first.
- **`HINTS` becomes load-bearing.** If page B is generated from it, that table
  stops being documentation and becomes an interface. It needs test coverage.
- **Two clients assumed.** The relay broadcasts to all others. Two phones, or a
  stale tab, will behave oddly. Roles fix most of it; a client registry fixes the
  rest.
- **The gyro secure-context problem is unsolved.** Everything above works over
  touch regardless, but it should not be forgotten.
