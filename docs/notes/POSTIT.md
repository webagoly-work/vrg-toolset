# VRG Post-it — notes pinned to a point of any screen (N-POSTIT)

*2026-11-25. A capture-point module of VRG Jegyzetek ([SIMPLE.md](SIMPLE.md) S10), built for the VRG Asztal (Desktop, WP-50)
and VRG Mobile (WP M68). Hungarian version: [POSTIT.hu.md](POSTIT.hu.md); fix both together.*

Contents: §1 what it is · §2 how it fits Jegyzetek · §3 the anchor · §4 the bundle format · §5 the two flows (tester, developer) ·
§6 where it lives in the code · §7 limits · §8 decisions · §9 next steps.

---

## 1. What it is

A small overlay a tester switches on in Settings. Once it is on, **two small buttons sit in the upper left over every screen**:

| Button | Does |
|---|---|
| 👁 **Mutat / elrejt** | shows or hides the notes (Notes visibility) |
| 📌 **Élesít / hatástalanít** | arms the overlay: the **next click (PC) or tap (phone)** leaves a faint mark at that point and opens a text box beside it, as the Planner's note tool does. Saving pins a hovering Post-it there; it disarms after one note. |
| **DEV** | only on the developer's install: shows the testers' notes too, each tester in their own colour |

Right click (PC) or long press (phone) on 📌 opens the small menu: the tester's name, **Export / Küldés** (one file with all
of this install's notes), deleting one's own notes, and on the developer's side **Behívás** (calling testers' files in) with
a switch per tester.

The point: testers comment on the app *where they see the problem*; the developer calls their files in and, with DEV on, sees
the same notes on the same screens of their own PC or phone ("see what they see").

## 2. How it fits Jegyzetek

Jegyzetek's rule R3 lets a feature draw only in its slots. Post-it does not draw inside Jegyzetek at all: it is a **capture
point (S10)** that lives over the *other* apps, like the phone widget or the web clipper. So it is a module of the notes
engine with its own small surface outside it:

| Part of the module | Where |
|---|---|
| capture surface | the overlay (the two buttons, the marks, the editor) over the Desktop window and the phone app |
| store | its own files today (§6); once the Jegyzetek vault (N-VAULT) exists, a Post-it is an ordinary note with the anchor in its frontmatter and a smart folder *Post-it* (S7) |
| settings | one row (S9): *Post-it jegyzetek a képernyőn*; on the phone a second row for the developer's layer |
| format | `vrg-postit/1` (§4), shared by both platforms and tested against one fixture |

Turning the setting off removes everything it adds (no window on the PC, nothing composed on the phone); the notes stay on disk.

## 3. The anchor

A note points at **a screen** and **a point on it**, kept as fractions so it survives a different window size or phone:

```json
{ "screen": "d:app/inventory", "detail": "/Inventory/index.html#tab=2", "x": 0.5, "y": 0.25, "w": 1180, "h": 760 }
```

`x`, `y` are fractions of the anchor's **box**; `w`, `h` are that box's size when the note was made (px on the PC, dp on the
phone), kept only to tell later whether the layout was the same. `detail` is an optional sub-place, shown in the note's header,
never used for matching. A note is drawn only where its `screen` is open now.

### 3.1 Screen keys on the VRG Asztal (`d:`)

The PC overlay finds the topmost pane under the click (in-shell apps, web tabs and the Kezdőlap are WebContentsViews with known
rects) and anchors **to that pane**, so a note stays on the same spot of the app when panes are moved or resized.

| Key | The box is |
|---|---|
| `d:app/<catalog id>` | an in-shell HTML app's pane (`vrg-app://<id>/…`); `detail` = its path and hash |
| `d:web/<host>` | a web tab's pane; `detail` = the path (never the query: it can hold tokens) |
| `d:home` · `d:mail` | the Kezdőlap pane · the mail read view |
| `d:frame/dashboard` · `d:frame/desktop` | the frame itself, under every pane: the Irányítópult or the Asztal view |

### 3.2 Screen keys on VRG Mobile (`m:`)

The phone anchors to the whole app area (one app on screen at a time): `m:<feature id>` (`m:notes`, `m:sketch` …), `m:home`,
`m:home/compact`, `m:catalog`, `m:planned/<id>`, `m:sheet/<id>`, `m:lock`. A phone note can only be drawn on a phone and a PC
note on a PC; both are kept and listed whichever side calls them in.

## 4. The bundle format `vrg-postit/1`

One JSON file per export, named `postit-<date>….vrgpostit.json`. Shared fixture: `shared/postit/fixtures/bundle-v1.json`.

```json
{
  "format": "vrg-postit/1",
  "exportedAt": "2026-11-25T09:30:00.000Z",
  "author": { "id": "t-kovacs01", "name": "Kovács Anna", "platform": "mobile", "device": "Pixel 8", "app": "VRG Mobile" },
  "notes": [
    { "id": "pn-a1b2c3d4e5f6", "at": 1764062400000, "edited": 1764062400000, "state": "open",
      "text": "Ez a gomb nem reagál az első érintésre.",
      "anchor": { "screen": "m:notes", "detail": "new", "x": 0.82, "y": 0.91, "w": 412, "h": 915 } }
  ]
}
```

Rules (both `postit-core.js` and `PostIt.kt` enforce them; a bad file is refused with the first reason):
`author.id` is a random id made at the first start (never a name, an account or a hardware id); `platform` is `desktop` or
`mobile`; at most 500 notes; text 1–2000 characters; `state` is `open` or `done`; `edited ≥ at`; ids unique; screen keys match
`^[dm]:[A-Za-z0-9._/:-]{1,158}$`. Unknown keys are dropped on reading and never written.

**Merging into the developer's inbox:** notes are kept per author and matched by id; the newer `edited` wins. Calling the same
file in twice changes nothing; a later export of the same tester only adds and updates. The developer's *Kész* on a tester's
note is kept in the inbox (the tester's own copy is theirs).

## 5. The two flows

**Tester** (PC or phone, User level / Dev layer not allowed):
1. Settings → *Post-it jegyzetek a képernyőn* on. The two buttons appear in the upper left.
2. 📌, then a click or tap where the problem is. Type, **Mentés** (Ctrl+Enter on the PC). A tap or click outside also saves; Esc
   / Back cancels.
3. Long press / right click on 📌 → name once → **Küldés / Export**: the PC saves a file; the phone shares it (any messenger,
   mail, Drive).

**Developer** (PC at Dev or All level; phone with *Fejlesztői réteg engedélyezése* on):
1. Long press / right click on 📌 → **Behívás fájlból…** → pick one or more files. (On the phone a bundle shared as text to VRG
   Mobile is called in too.) The first import turns DEV on.
2. Open the screens the testers wrote about: their notes hover where they pinned them, in the tester's colour, with name and
   device. Tap one to read it and mark it **Kész**.
3. The menu lists the testers with a switch each, to look at one tester at a time.

## 6. Where it lives in the code

| Part | File |
|---|---|
| shared rules (JS) | `shared/postit/postit-core.js` (UMD: the overlay page and Node load the same file) |
| shared rules (Kotlin) | `Mobile/android/kit-core/src/main/kotlin/hu/vrg/mobile/core/PostIt.kt` |
| fixture | `shared/postit/fixtures/bundle-v1.json` (read by both test suites) |
| PC: overlay window + IPC `postit.*` | `Dashboard/shell/lib/postit.js`, wired in `Dashboard/shell/main.js`; settings keys `postit.*` in `lib/settings.js` |
| PC: overlay page | `Dashboard/page/postit.html`, `Dashboard/page/postit.js`; the switch in Beállítások (`page/desk.js`) |
| PC: store | `<userDir>/postit/me.json`, `mine.json`, `inbox.json` |
| phone: store | `Mobile/android/kit/.../kit/postit/PostItStore.kt` (files/postit/, SharedPreferences `postit`) |
| phone: overlay | `Mobile/android/kit/.../kit/postit/PostItLayer.kt`, composed last in `ShellActivity`'s root Box |
| phone: settings | the *Post-it jegyzetek* section of `feature-settings` |
| tests | `Dashboard/test/wp-50.test.js` (`node Dashboard/test/run.js WP-50`); `kit-core` `PostItTest` |

**Why a window on the PC:** in-shell apps, web tabs and the Kezdőlap are WebContentsViews, native layers above the frame page, so
nothing in the frame's DOM can cover them. The overlay is a transparent, frameless **child window** over the main window's
content area (it moves, resizes, hides and shows with it). It lets the mouse through (`setIgnoreMouseEvents(true, {forward})`)
except over its own buttons, cards, editor and menu, which the page reports as it crosses them; while armed it takes the whole
surface for one click.

**Why last in the root Box on the phone:** Compose hit-testing stops at the topmost node with pointer input, so the overlay's
buttons and cards get their taps, the armed catcher gets the next tap, and everywhere else taps go through to the app.

## 7. Limits (today)

- **Phone dialogs and sheets that open their own window** (a Compose `Dialog`, `ModalBottomSheet`, a system picker) sit above
  the app's window, so above the overlay too. Notes on those need the "over other apps" mode of POSTIT-Q03.
- **PC native popups** (a `<select>` list, a context menu) open above the overlay window while they are open.
- Notes are matched by screen, not by element: if an app moves a button within its pane, the note keeps pointing at the old spot.
  `w`, `h` make a layout change detectable later (POSTIT-Q05).
- Transport is a file (export → any channel → call in). No server, no account, nothing leaves the device by itself.

## 8. Decisions (A = taken as the default here; the Founder may change them)

| # | Question | A (built) | B / C |
|---|---|---|---|
| POSTIT-Q01 | Transport from tester to developer | **a file** (PC save dialog; phone share sheet), called in by the developer | B the GitHub `mobile-log` branch (Gyorsjegyzet's path) for paired devices · C the LAN relay |
| POSTIT-Q02 | Who sees the DEV layer | **PC: Dev / All level; phone: a Settings switch** | B a build flag |
| POSTIT-Q03 | "On top of everything" on the phone | **in-app layer** (above every screen of VRG Mobile, not above its dialog windows) | B also an "over other apps" mode (SYSTEM_ALERT_WINDOW permission) for dialogs and other apps |
| POSTIT-Q04 | Anchor box on the PC | **the pane under the click** (survives moving panes) | B the whole window |
| POSTIT-Q05 | When the layout changed (`w`/`h` differ a lot) | **draw at the same fractions** | B draw dimmed with a "más elrendezés" hint |
| POSTIT-Q06 | Screenshot with each note | **no** (privacy: a screen can show client data) | B optional, blurred thumbnail |
| POSTIT-Q07 | One note per arming | **yes**, disarms after placing | B stays armed until 📌 again |

## 9. Next steps

1. **Telefonon ellenőrizni** (M68) and the PC check list in `docs/mobile/WP/M68.md` — both are BETA until the Founder has gone
   through them.
2. POSTIT-Q01 B: an *Elküldés* that pushes the bundle to the repo's `mobile-log` branch from a paired phone, and a *Behívás a
   repóból* on the PC.
3. When the Jegyzetek vault exists: Post-its become notes with `anchor:` frontmatter and a smart folder; the bundle stays the
   exchange format.
4. POSTIT-Q03 B if notes on dialogs turn out to matter.
