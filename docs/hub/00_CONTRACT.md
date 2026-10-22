# Contract — building VRG Kapu

*Every WP session reads this first. It is short on purpose.*

## 1. Where, and what you own

- Work in the **SecAcc worktree** `H:\cwebuser\projects\VRG-DE\SecAcc`, branch **`secacc`** (see `SECACC.md`).
  The main checkout `…\Planner_VRG_U100` belongs to the primary account — never edit it.
  `H:\Planner_VRG_U100` is a dead backup.
- **You own only:** `Hub/**`, `tools/build-hub.js`, `tools/hub-sign.js`, `tools/check-hub.js`,
  `docs/hub/**` (status lines + agent docs), and — in WP-H0 / H10 only — the hub entries in
  `Planner/START.cmd` and `VRG-DE.cmd`, and a `vrg-kapu` config in `.claude/launch.json`.
- **Never touch** other tools' files. Known dirty files that are not yours (do not stage, do not
  "fix"): see `git status` at start and report what you find before working.
- Commit to `secacc` after each finished WP, message `Kapu WP-Hn: …` (the same rule as `GO-HUB.md`
  §1 and `PROMPTS.md` §2/§4). Never push, never merge, never switch branch, never stash.
- A file outside the list above (e.g. `VRG-DE.cmd`, `tools/prompts/*`, the root `CLAUDE.md`, a `GO-*.md`)
  only when the user asks for it in the session, each change in its own commit that says what and why.

## 2. Conventions

- **Single file out**: source in `Hub/src/` (`index.html`, `css/*.css`, `js/NN-name.js` concatenated
  in order, one shared scope with the prefix `kp` for globals, like the Planner's prefixes),
  `node tools/build-hub.js` inlines CSS, JS, `Hub/data/topology.json`, `Hub/data/access.json` and
  `Hub/src/access-pubkey.json` into `Hub/dist/vrg-kapu.html`. No npm dependencies; Node 24 built-ins only.
- **No external network at runtime except** `api.github.com`, `github.com` links, OneDrive / Microsoft /
  Google / claude.ai links the user clicks, and `localhost:8795`. No CDN scripts — the file must work offline.
- **UI Hungarian, code English**, comments sparse and in English. Console output of `.cmd` files ASCII-only, CRLF.
- **Colours**: the four VRG themes copied verbatim from `Modder/vrg-buildtree.html` `THEMES`;
  department hues map to theme vars (`--hue-teal` …), never hex in CSS rules.
- **Storage**: every `localStorage` / IndexedDB access through `kpStore.get/set` with try/catch, keys
  prefixed `vrgKapu.`; the page must render fully with storage unavailable (file:// "csak linkek" mode).
- **Secrets**: no token, key or password in any file. The GitHub token lives only in the browser's
  storage. The private signing key only in `H:\cwebuser\_admin\keys\`.
- **Security of the companion**: binds 127.0.0.1 only; checks `Host` and `Origin`; per-install token;
  whitelisted actions with fixed argument shapes; paths must resolve inside allowed roots; spawns
  with argument arrays, never a shell string built from request data.
- Batch files: CRLF, ASCII, the CLAUDE.md cmd traps apply.
- START.cmd: keep numbers stable; add a letter entry; update the dated NOTE; run `node tools/check-start.js`.

## 3. The loop after every edit batch

```bash
node tools/build-hub.js          # builds Hub/dist/vrg-kapu.html
node Hub/test/run.js             # pure-function tests (no browser)
node tools/check-hub.js          # topology schema + every repo path exists + no secrets pattern in dist
```
Browser check: `.claude/launch.json` config **`vrg-kapu`** (the companion on :8795, or
`node Hub/companion/server.js --no-open` once H10 exists; before that `npx`-free
`node Hub/test/serve.js` on :8796). Read the page with `read_page` / `get_page_text`, take a
screenshot only for look checkpoints.

## 4. Decisions

`DECISIONS.md` + `HUB-Q-001.json`. Answered ones are in README §5. **Unanswered = the A option.**
If a WP hits a question the pack does not answer, stop and ask — with lettered options.

## 5. Report format (end of every WP)

```
WP-Hn — <title> — DONE | PARTIAL | BLOCKED
Files: <list, + new / ~ changed>
Tests: <run.js n/n> · check-hub OK|FAIL · build size <kB>
Browser: <what was checked, how>
Deviations from the WP: <none | list>
Open questions: <none | Qnn …, lettered options>
```
Then update the WP's line in `docs/hub/README.md` §4 (status, date, one line).
