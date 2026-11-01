# Varler Console

Villanyszerelői terepi konzol és zseb-műszerfal. Offline-first, helyi tárolás, magyar alapnyelv.
*An electrician's field console and pocket dashboard. Offline-first, local storage, Hungarian by default.*

Status: **Phase 3, live agent trace.** 32 of 49 pages are built; the other 17 show a working empty state
that says what they wait for. The PWA and the APK arrive in Phase 4; the full README with them.

## Run

START menu: **W** Varler Console, then **S**. Or:

```bash
node serve.js    # http://127.0.0.1:8133
npm test
```

Serve it: `localStorage` and ES modules do not work from `file://`.
Ring primitives gallery: `http://127.0.0.1:8133/tests/ring-gallery.html`.

## Agent trace

The same view runs in three places: the Console page **Ügynöknyom**, `dist/vrg-trace.html` as one offline
file (`npm run build:trace`), and the **Ügynöknyom** button in Kódváros. The relay is START **W**, **R**
(or `npm run relay`), `http://127.0.0.1:8134`. It prints a pairing code; its own page is paired already.

Sources share one interface in `www/js/trace/sources.js`: Claude Code hooks, a Managed Agents slot that says
it is not there yet (Session 2), and replay of a saved `.jsonl` with the timeline.

To turn the hooks on, copy `tools/hooks.example.json` into `.claude/settings.local.json`, or merge it in if the
file already has hooks. They only observe. A session reads its hooks when it starts. Each hook call costs one
Node start, about a second on the dev PC, so a tool call waits about that long before and after it runs.
To answer from the page, add `--gate=Bash,Write` to the `PreToolUse` hook and raise its `timeout` to 120: those
tools then wait up to 100 s while a viewer is connected. With no answer or no viewer, Claude Code's own
permission prompt decides, and deny rules in your settings always hold. A message from the prompt box is
delivered the next time the session stops.

Privacy: events are scrubbed in the hook before they touch the disk and again in the page, which also knows
the client names from your jobs. To cover them in the hook too, list them in `traces/names.txt`, one a line.
The rules take names, emails, phones, streets, secrets and folders under `jobs/`. The page shows what went.
`traces/` is gitignored; retention is set on the page (the hook, the relay and the browser store all obey it).
Token counts are input plus output per message, read from the transcripts; cached tokens are not included.

## Layout

| Path | What |
|---|---|
| `design/tokens.json` | Varler SUI tokens, copied unchanged from the design system |
| `design/sunlight.json` | the sunlight theme; derived here, the design system has none |
| `tools/build-tokens.js` | generates `www/css/tokens.css` (`npm run tokens`) |
| `www/js/core/` | i18n, locale formatting, the local-first store (`store.js` settings, `db.js` IndexedDB records), limit checks, calculators, redaction, the PC bridge client |
| `www/js/pages/*.js` | one module per page: `{ manifest, strings, mount(root, ctx) }`; small widgets share `widgets-simple.js` and `widgets-device.js` |
| `www/js/trace/` | events, model, privacy, sources, view, panel; `standalone.js` is the single-file entry |
| `tools/` | `trace-hook.js`, `trace-relay.js`, `trace-retention.js`, `build-trace.js`, `hooks.example.json` |
| `www/data/` | `commands.js`, `sugo.js`, `playbooks.js`, copied unchanged from ServiceKitPhone |
| `www/fonts/` | bundled woff2 subsets with their OFL licences (`NOTICE.md`) |
| `www/js/i18n/` | `hu.js`, `en.js`: every UI string |
| `www/js/pages/catalog.js` | the 49 page manifests (id, HU and EN names, category, permissions, offline) |
| `www/js/pages/registry.js` | page id to mounted page; Phase 2 pages plug in here |
| `www/js/ring.js` | SUI primitives: ticks, sector, callout, reticle, branchTree, radar, vitals |
| `www/js/ui/` | carousel, library, settings, sheets, toasts, confirm |
| `tests/` | `node --test`; `i18n.test.js` fails on a missing key or hard-coded text |

## Rules that the tests hold

- Every key exists in both languages, placeholders match, and no user-facing literal sits in the source.
- Text contrast is at least 4.5:1 in both themes, and `tokens.css` matches the tokens.
- No supplier or film names in any UI string (landmines L4, L10).
- The shell loads nothing from the network.

## Tested

In Chromium at 375 and 320 px wide, against the real app: wrap-around by arrows, dots, keys and swipe;
enable, disable, reorder by buttons and by drag; presets across a reload; language; glove mode with
hold to confirm; sunlight; export; erase with undo; 48 px minimum on every control (64 px in glove
mode). Reduced motion was checked by stubbing the media query.

Phase 2, in Chromium at 375 px on real IndexedDB: job, measurements with the user's limit table, panel
schedule, checklist, time, calculators, supplier list into job materials, agent kit redaction, EXIF
removal from a generated test image, job delete with undo, export and erase covering both stores.
Every Phase 2 ServiceKit and widget page mounted in both languages with no load error, no sideways
scroll and no control under 48 px.

ServiceKit pages against `skphone-bridge.js --allow-run --mock-pc` (the mock runs nothing): connect,
329 commands, search, Run on PC behind a confirm showing the exact command, 19 macros, confirm on a
dangerous macro, and the pairing code absent from stored settings.

Phase 3, in Chromium at 375 px and through the real relay and hook processes, fed with hand-written hook
input: replay and timeline; live events; Approve reaching the hook as `allow`, Deny as `deny`; a queued
message returned at Stop; the hook silent and exiting 0 with no relay; wrong code, foreign origin and foreign
host refused; no email or job folder on disk or in the browser store; the standalone page over the relay.

Then in real headless `claude -p` sessions on the dev PC, observe only: prompt, Read, Glob, a failed Read and a
subagent, live and from a saved session; test contact details removed on disk; token counts equal to the
session and subagent transcripts, message by message. Approve, Deny and the prompt box were not used in a real
session: they stay tested with hand-written hook input only.

**Not tested:** real touch hardware, a real phone, any native shell, screen readers, the swipe edge
guard (it applies to touch input only), a real PC run, a paired Wi-Fi bridge, level, compass, sound
meter and media player with real sensors, microphone or files, the photo picker, supplier CSV import
in the browser, the trace gate and prompt box in a real session, the Kódváros specs, and Managed Agents
(not built).

**Not built yet:** OCR in the inbox; quote view, legal lookup; kit deploy, network tools, site survey;
all five smart-home pages; worktrees, terminal, Kódváros map, CI status; file converter, QR and
barcode, document viewer.
