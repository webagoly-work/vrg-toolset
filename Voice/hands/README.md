# Kéz (hands): controlled actions in other programs (WP-58)

Phase 4a of the voice work (`docs/research/2026-11-25_voice-roadmap.md`). The Parancs-héj can now act in the program in front, not only
read it. The actions are short and named, and each passes a risk check. The reader (`Voice/screen/`) stays read-only and separate.

## The hard rule first

**Spoken words never type into another program.** There is no text entry of any kind here:
- no value setting;
- no key, mouse or input synthesis;
- no copy-paste buffer.

`act-host.ps1` does not even mention those APIs, and a test proves it (`test/hands.test.js`, the static check). Dictation (WP-54)
fills only the VRG Asztal's own text fields.

What it CAN do, through UI Automation patterns only:

| Verb | Pattern | Example | Default risk |
|---|---|---|---|
| `invoke` | Invoke (SelectionItem for a tab) | "kattints a Mentésre", "nyomd meg az OK-t" | confirm (a tab: reversible) |
| `toggle` | Toggle | "pipáld be az Emlékezz rám-ot" | confirm |
| `select` | SelectionItem | "a második fül", "válaszd a Biztonság fület" | reversible |
| `expand` / `collapse` | ExpandCollapse | "nyisd ki a Fájl menüt" | reversible |
| `scroll` | Scroll (up, down, page-up, page-down, top, bottom) | "görgess le", "ugorj az aljára" | reversible |
| `focus-window` | SetForegroundWindow (+ ShowWindow restore) | "válts a VS Code-ra" | reversible |
| `window` | Window (minimize, maximize, restore, close) | "tedd kis méretre", "zárd be ezt az ablakot" | reversible; close = confirm |

What it never touches:
- the VRG Asztal's own windows: answered `own`; the overlay uses the Asztal's own APIs for those;
- elevated windows: answered `elevated` (UIPI), never retried;
- denied programs and titles: the same policy as `Voice/screen` (password managers, banking, private windows, client folders);
- blocked programs: installers, the UAC and credential prompts, Windows Security, remote access, shells, the registry and disk tools;
- blocked names (`rules.json`);
- password fields;
- disabled elements.

## Risk classes (`rules.json`, editable)

Rules are applied in this order:
1. **`own` / `elevated`:** refused.
2. **`blocked`:** never done, and no plan is made. This covers a password field, a program in `blockedApps` or matching
   `blockedAppPatterns`, or a name in `blockedNames`. A name entry blocks when its words start consecutive words of the target's name,
   compared accent-folded and lower-case: `torl` blocks "Törlés" and "Kosár törlése"; `visszaallit alap` blocks "Visszaállítás
   alapra". The list covers delete, send, submit, pay, buy, order, transfer, approve, accept, allow, sign out, reset, install, update
   now, restart, shut down, discard, overwrite, force, merge, push, deploy, and their Hungarian forms.
3. **`confirm`:** the overlay runs it only after a spoken or typed "igen".
4. **`reversible`:** the overlay may run it after a short visible countdown.

`planTtlMs` (20 s) is how long a plan stays valid.

## The API

```js
const { createHands, classify, matchTarget, RULES } = require('<repo>/Voice/hands/hands.js');
const h = createHands({ spawn, powershell, policy, ownPids, log, now, append?, script?, timeoutMs?, rules? });
await h.plan({ verb, target?, role?, arg?, window? })
  → { ok: true, plan: { id, verb, arg, app, title, target: { name, role }, risk: 'reversible'|'confirm', say, detail, expires } }
  | { ok: false, err: 'denied'|'not-found'|'ambiguous'|'elevated'|'blocked'|'own'|'unavailable'|'bad-request'|'stale'|'busy', hu, choices? }
await h.act(planId) → { ok: true, say, verified: true|false|null, ms } | { ok: false, err: 'stale'|'expired'|'stopped'|'elevated'|'blocked'|'unknown'|'error'|'busy', hu }
h.stop() · h.log() · h.close() · h.pending()
```

**Planning:**
- `target` may be the bare name ("Mentés") or the whole spoken phrase ("kattints a mentésre"). The command verbs, the articles and
  the role words are dropped. A role word sets the role: gomb → button, fül → tab, menü → menuitem.
- Ordinals work: "az első / a második / az utolsó" (also "first / second / last").
- Matching is accent-folded and Hungarian-stemmed, with an edit-distance tolerance ("bizonság" → "Biztonság"). An exact one-word name
  beats a longer one ("mentés" → "Mentés", not "Mentés másként"). Two near-equal names give `ambiguous` with up to 3 `choices`.
- `window` names a top-level window to work in (matched by the program's friendly name, e.g. "VS Code" for `Code`, and its title).
  For anything but `focus-window` that window must already be in front; otherwise `stale`, with the hint to bring it forward first.
- `scroll` with no target scrolls the focused scrollable area, else the biggest one.
- A plan is blocked or refused **before** anything is planned when the window is denied, own or elevated.
- **Blocked actions** come back as `err: 'blocked'` (with the reason in `hu`), not as a plan with `risk: 'blocked'`. There is
  nothing to confirm.

**Acting:**
- `act(planId)` re-checks that the same window is in front, finds the element again by its RuntimeId, re-checks password / enabled,
  then acts once.
- **It never retries.** A `do` that times out has an unknown outcome: the helper is killed, and the answer says "Nem tudom,
  megtörtént-e". Reading ops (`find`, `windows`) are retried once on a fresh helper.
- **`verified`:** a re-read shows the expected change: toggle state, selection, expand state, scroll position, window state, the
  window in front, or the element gone. A plain click gives `null`.

**Stop and one-at-a-time:**
- **`stop()`**, the kill switch: the pending plan is dropped, and an action in flight is cut off at once (the helper is killed; a
  fresh one starts on the next call).
- One action at a time; a new `plan` replaces the pending one, and a plan runs once.

**The log:**
- **`log()`:** the last 50 actions as `{ at, verb, app, target, risk, ok, err?, verified? }`. `target` is the element's name, or for
  window verbs the program's name, never a window title or any other screen text.
- `append(entry)` receives the same entry for a JSONL file.

## The protocol (`act-host.ps1`)

One long-running Windows PowerShell 5.1 process, started once with `-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File`.
JSON lines in and out; ASCII only; non-ASCII as `\uXXXX`.

| Request | Answer |
|---|---|
| `{"id","op":"ping"}` | `{"ok":true,"pong":true}` |
| `{"id","op":"windows"}` | `{"ok":true,"fg":hwnd,"windows":[{hwnd,pid,process,title,min}]}` |
| `{"id","op":"find","hwnd":0\|n,"maxNodes","budgetMs"}` | `{"ok":true,"win":{hwnd,pid,process,title,state},"fg":hwnd,"items":[…],"truncated","ms"}` |
| `{"id","op":"do","verb","hwnd","rid","arg","fg":true\|false}` | `{"ok":true,"before":{state},"after":{exists,…state},"ms"}` |
| `{"id","op":"state","hwnd","rid"}` | `{"ok":true,"exists","fg","win","state"}` |
| `{"id","op":"quit"}` | `{"ok":true,"bye":true}` |

- **An item:** `{rid, role, name, aid, enabled, pw, off, focus, pat:["invoke","toggle","select","expand","scroll","window"], toggle,
  expand, selected, vscroll, window, rect}`. Only elements with at least one allowed pattern are listed.
- **Errors:** `{"ok":false,"err":"stale"|"gone"|"disabled"|"password"|"no-pattern"|"elevated"|"no-window"|"bad-request"|"error","msg"}`.
- **`do` checks before acting:** the window must still be in front (`fg:true`), the element must be found again by RuntimeId, and it
  must be neither a password field nor disabled. It then waits 150 ms and re-reads the state.

## What the local session must verify on Windows

1. **The helper starts.** It starts once and stays up, and the static-check test passes. Check whether Avast blocks its first start
   the way it blocks fresh script processes (see CLAUDE.md).
2. **Chrome / Edge.**
   - Do the page buttons, links and tabs show up with Invoke / SelectionItem? Chromium exposes its full accessibility tree only when
     an assistive technology is detected. Check that UI Automation clients trigger it.
   - If the page content is missing, try `--force-renderer-accessibility` on a test profile. Do not change the user's browser
     shortcuts without asking.
   - Browser chrome (tabs, toolbar) should work either way.
3. **VS Code** (Electron, same question), Explorer, Total Commander: list what `find` returns for each, and whether
   invoke / select / expand work.
4. **An elevated window** (an admin PowerShell or `mmc`) must answer `elevated` quickly and never hang.
5. **`focus-window` and Windows' focus-stealing rules.**
   - `SetForegroundWindow` only works when the calling process may set the foreground. Usually it may, right after the user pressed
     the global key, since the Asztal received the last input. Otherwise the taskbar button just flashes.
   - **Do not inject keys** (the Alt-key trick is input synthesis, ruled out here). If it fails, the documented options are:
     - `AllowSetForegroundWindow` called by the process that has the foreground;
     - having the Asztal itself call `SetForegroundWindow` (it owns the last input);
     - accepting the flash.
   - Report which one is needed.
6. **Timings:** `find` on a busy Chrome page (budget 1.5 s, 600 nodes), and `do` + re-read (about 150–300 ms).
7. **The blocked lists against real dialogs:** a browser "Allow notifications?" prompt, a "Delete?" confirm, a Windows "Sign out"
   button. All must be blocked.
