# Varler Console

Villanyszerelői terepi konzol és zseb-műszerfal. Offline-first, helyi tárolás, magyar alapnyelv.
*An electrician's field console and pocket dashboard. Offline-first, local storage, Hungarian by default.*

Status: **Phase 2, template pages.** 31 of 49 pages are built; the other 18 show a working empty state
that says what they wait for. The PWA and the APK arrive in Phase 4; the full README with them.

## Run

START menu: **W** Varler Console, then **S**. Or:

```bash
node serve.js    # http://127.0.0.1:8133
npm test
```

Serve it: `localStorage` and ES modules do not work from `file://`.
Ring primitives gallery: `http://127.0.0.1:8133/tests/ring-gallery.html`.

## Layout

| Path | What |
|---|---|
| `design/tokens.json` | Varler SUI tokens, copied unchanged from the design system |
| `design/sunlight.json` | the sunlight theme; derived here, the design system has none |
| `tools/build-tokens.js` | generates `www/css/tokens.css` (`npm run tokens`) |
| `www/js/core/` | i18n, locale formatting, the local-first store (`store.js` settings, `db.js` IndexedDB records), limit checks, calculators, redaction, the PC bridge client |
| `www/js/pages/*.js` | one module per page: `{ manifest, strings, mount(root, ctx) }`; small widgets share `widgets-simple.js` and `widgets-device.js` |
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

**Not tested:** real touch hardware, a real phone, any native shell, screen readers, the swipe edge
guard (it applies to touch input only), a real PC run, a paired Wi-Fi bridge, level, compass, sound
meter and media player with real sensors, microphone or files, the photo picker, and supplier CSV
import in the browser.

**Not built yet:** OCR in the inbox; quote view, legal lookup; kit deploy, network tools, site survey;
all five smart-home pages; worktrees, trace mini view, terminal, Kódváros map, CI status; file
converter, QR and barcode, document viewer.
