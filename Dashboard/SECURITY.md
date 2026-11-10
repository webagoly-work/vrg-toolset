# SECURITY: threat model and the WP-35 pass (Biztonsági átvizsgálás)

Run of 2026-11-06, tests only: `node Dashboard/test/run.js WP-35` (unit test `test/wp-35.test.js`, shell probe `shell/selftest/wp-35.js`). Status: **done** (DESK-Q94 B): the findings are listed here and stay pinned in the test (Q95 A). Nothing was fixed in WP-35 itself; failures are findings (below) and are pinned in the test as `KNOWN_*` / "FINDING" assertions, so the check is green today and turns red the day a finding is fixed (then move the line out of the pin).

## Threat model in one page: who can send what where

| Actor | Can reach | Gate | What it can never do |
|---|---|---|---|
| Web content (browser tabs, webmail, any site) | its own page only | no preload, `sandbox`, `contextIsolation`, no node, own partition, permissions denied, `will-navigate` http/https only | call `window.vrg` (it does not exist there), use IPC (sender check refuses every frame that is not the frame page or the Kezdőlap) |
| Mail read view (message HTML) | nothing: JavaScript off, CSP `default-src 'none'` | the Posta pane cleans the HTML with DOMPurify before hand-over (DESK-Q73 B, WP-35a; `shell/lib/mailclean.js`), then CSP, images only after "Képek betöltése" | run script, load a remote image on its own |
| The frame page / Kezdőlap (our code, treated as untrusted input) | `window.vrg` (API.md) = `vrg2:<ns>.<fn>` channels + the four legacy `vrg:*` | `lib/ipc.js`: sender URL check, then schema check, then the handler | send a path (handles `h:…`, registry ids and basenames only), start a program except for an act id, read a secret |
| Main process | files, processes, network, `secrets.bin` | allow-list of act ids and registries, `execFile`/`spawn` with argument arrays | accept anything that came up from the page as a path |
| Local files under `home\desktop` | read by main only | per-user folder, `secrets.bin` is DPAPI-encrypted | hold a token in plain bytes |
| The network | OAuth loopback (127.0.0.1), the user's web tabs, Gmail API (read-only scope) | OAuth PKCE, system browser for consent, certificate errors never overridden | carry credentials of ours in a URL |

## CONTRACT §3/§4 rule → the test that proves it

| Rule | Proof |
|---|---|
| §3 the page never passes paths: handles/names/urls are strictly typed | `wp-35.test.js` "IPC fuzz": all 89 channels, 40+ generated bad payloads each (wrong types, 70 000-char strings, extra keys, `__proto__`, `constructor`, missing keys, `C:\Windows`, `..\..`, `\\server\share`, `file:///`, `\\?\C:\`, `/etc/passwd`). Malformed payloads: always `bad-request`, handler never runs. No `handle`, `name` or `url` field ever reaches a handler with a path. (id fields: F1, fixed in WP-35a.) Also WP-03 (`wp-03.test.js`) |
| §3 only the two pages may call; a web view never can | "a refused sender … never reaches a handler on any channel" (4 foreign senders × 89 channels) |
| §3 nothing goes back up as a path except display fields | "replies to the page hold no filesystem path" (fs.roots, fs.list incl. subfolder, fs.stat, unknown handle). Display fields allowed: `display`, `checkout`, git `files[].path`, notes `source.ref`. The git, notes and feed replies are covered by their own WP tests (wp-31, wp-25, wp-29); this file walks only the fs replies, see "Not covered" |
| §4.1 tokens only in `secrets.bin`, encrypted; never logged, in a URL, or sent to the page | "secret scan": WP-06 flow (`secrets.put`) + WP-27 flow (PKCE sign-in, refresh, list, get, sign-out) on the 127.0.0.1 mock, plus hostile IPC payloads carrying `MOCK_ACCESS`, `MOCK_REFRESH`, `client_secret`, `VRG_SECRET_PROBE` fields: zero hits in every file of the temp home (audit logs included) and zero plain bytes in `secrets.bin`. `oauth-clients.json` is excluded: it is the user's own config and holds the client secret by design (never committed, lives in `home\`) |
| §4.2 the batch never handles credentials | all flows run against `test/fixtures/mock-google.js`; the live check stays with the Founder |
| §4.3 web content is isolated | shell probe `wp-35.js`: in a web tab and in the mail view `typeof window.vrg`, `require`, `process` are all `undefined`; `navigator.permissions.query({name:'geolocation'})` = `denied`; `webPreferences` of both have no preload, `sandbox`, `contextIsolation`, no node. Frame `will-navigate` to `https://example.org/` is prevented, URL unchanged. Earlier: WP-03 (`webPrefs`), WP-17, WP-28 probes |
| §4.4 CSP on the frame page and local panes, no remote script | unit test "CSP" (exact policy of `vrg-desktop.html`, mail view policy from `cspFor`, no `<script src="http…">` in the frame page or the Kezdőlap) and probe `wp-35.js` (the policy as the live document reports it, frame and mail view) |
| §4.5 delete = Recycle Bin | WP-12 (`wp-12.test.js`); not re-proved here |
| §4.6 git never force-pushes, asks before every push | WP-31 (`wp-31.test.js`); not re-proved here |
| §4.7 no system changes | none of the sources use registry/firewall tools: the spawn audit below lists the executables that may start |
| §4.8 client data stays local | WP-34 / D4 `jobsPriv`; not re-proved here |
| §4.9 tests use temp roots and 127.0.0.1 only | this test: home is `%TEMP%\VRG\desk-test-*`, removed afterwards; only `127.0.0.1` fixtures; `child_process` is replaced for the whole file so nothing can start |
| Spawn audit (brief) | "spawn audit (static)": no `shell: true`, no `exec(` / `execSync(` in `shell/`, `page/`, `tools/` (probes excluded). "(dynamic)": `child_process.spawn/execFile/exec/…` are patched before `main.js` loads; every call is recorded, refused, and checked against `{node, claude, git, attrib, taskkill, cmd.exe, code}` and `shell` unset. Today the load and the flows start nothing (0 calls) |
| Lib pins (brief) | "lib pins": every lib the code names (`dompurify`, `markdown-it`, `node-pty`, `xterm`, `xterm-addon-fit`) must have `VENDOR.json` with an `sha512-…` integrity. Findings F2, F3 |

## Findings of this run

| # | Severity | Where | What | Suggested fix (a WP in the morning review, not done here) |
|---|---|---|---|---|
| F1 | low (hardening) · **fixed WP-35a** (`types.id` refuses `..` segments, a leading `/`, drive letters, `file:`, `//`; `KNOWN_ID_PATH_CHANNELS` is now empty) | `shell/lib/ipc.js:43` `types.id` | The id regex `^[a-z0-9:_./-]{1,80}$` admits `..`, `../..`, `/etc/passwd`, `c:/windows`, `file:///`. 41 id fields reach their handler with such text (list pinned in `KNOWN_ID_PATH_CHANNELS`: chat, ctx, feed, fs.answer, git.*.repo, jobs, layout.bounds/openWorkspace, mail.*, term.open, web.*). `C:\Windows`, `..\..`, `\\server\share` are already refused (no backslash, no upper case). The handlers look an id up in a registry and do not open it as a path, so no exploit is known | Tighten `types.id`: no `..`, no leading `/`, no `file:`, `:` only after a known prefix; keep the lower-case registry ids (`root:x`, `line:x`, `srv:x`) working |
| F2 | medium (supply chain) | `H:\VRG\Full\tools\js-libs\dompurify\` | no `VENDOR.json` (and no integrity) next to the vendored DOMPurify that `app.info().libs.dompurify` points the mail cleaner at (`shell/main.js:153`; since WP-35a it runs in the Posta pane, DESK-Q73 B, so this pin matters more) | an attended re-vendor with the sha512 recorded, like xterm / markdown-it |
| F3 | low | `page/frame.js:361`, `page/panes/term.js:69`, `page/vrg-desktop.html:8` | the page builds `tools/js-libs/…` URLs itself (xterm, xterm-addon-fit, xterm.css), not only through `app.info().libs`. The frame's CSP (`script-src 'self' file:`) still holds and the files are pinned (VENDOR.json exists), but the "libs only via app.info" rule is not true for xterm | make `app.info().libs` carry `xterm`, `fit`, `xtermCss` and drop the relative fallbacks |

No finding in: path fields typed `handle`/`name`/`url` (never reach a handler with a path), malformed payload refusal (all channels), sender check (all channels), reply paths in the fs replies, secrets on disk and in audit logs, `shell: true` / `exec`, web/mail isolation and geolocation, CSP of the frame page and mail view.

## Not covered (so the morning verifier knows)

- The fuzz replaces every handler with a spy, so it proves the gate (sender + schema) on all 89 channels, not what each handler does with a valid-but-hostile value. Types built inside the schema as closures (`types.arr(types.handle, n)`, `ctxIds`, `gitRepo`, `isTarget`) are exercised but not introspected: only fields typed directly `types.handle` / `types.name` / `types.url` / `types.id` are rule-checked.
- The four legacy D1 channels (`vrg:act` …) are covered by WP-03 and WP-02, not fuzzed here (their handlers start programs).
- Reply-path walk covers the fs replies on a temp root; mail and OAuth replies are checked for secrets, not for paths; git/notes/feed replies are left to wp-31 / wp-25 / wp-29.
- The dynamic spawn audit sees only what this test file runs (nothing starts). The static scan is the real guard; executable names inside the sources are not extracted.
- Permission handling beyond geolocation, downloads and certificate errors are WP-17 / WP-18 territory.
