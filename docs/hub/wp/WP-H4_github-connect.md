# WP-H4 — Belépések panel + GitHub identity

**Goal (user):** "provides login (in new window) for each layer" · "other layers only activate if a
user is also signed in to GitHub and OneDrive — and the account has access to content I already
shared with them".

## Depends / decisions
H3. **HUB-Q03** (identity; A = GitHub account), **HUB-Q07** (OneDrive v1 = links + manual tick).

## Read
`01_ARCHITECTURE.md` §3 · `03_UI.md` §6 *Belépések*, *Token varázsló*.

## Build
1. `Hub/src/js/50-github.js`: `kpGh = {token, user, access, rate}`;
   `kpGhFetch(path, {etag, raw})` → adds `Authorization: Bearer`, `Accept: application/vnd.github+json`
   (raw: `application/vnd.github.raw+json`), `X-GitHub-Api-Version: 2022-11-28`; returns
   `{status, json|text, etag, rateRemaining}`; never logs the token; 401 → clears the token and
   says "A token lejárt vagy hibás".
2. `kpGhIdentify()` → `GET /user` (login, name) + `GET /repos/{o}/{r}` (`permissions.push` → "írás",
   else "olvasás"; 404 → "nincs hozzáférés a repóhoz").
3. Belépések modal: rows GitHub / OneDrive / Claude / Engedélyezett lista (H5 fills) / Kapu segéd
   (H10 fills). "Bejelentkezés (új ablak)" = `window.open` of the platform login URL. OneDrive tick
   stored per browser. Three dots in the top bar = GitHub, OneDrive, list.
4. Token wizard (5 steps, Hungarian, from 03_UI §6). Paste → validate shape
   (`/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/`) → identify → store in `kpStore` only. "Kijelentkezés"
   deletes it.
5. Layer gating v1: L3/L4 nodes show 🔒 until GitHub is identified with repo access; L2 shows 🔒 until
   the OneDrive tick. Locked nodes still open their link (the platform will refuse if needed) but
   show "Előbb lépj be: GitHub" in the tooltip.

## Tests (`spec-50-github.js`, with a stubbed `fetch`)
- token shape: `ghp_` + 36 chars → ok; `abc` → rejected; the token never appears in any thrown
  error text or `console` call (spy).
- `/user` 200 + repo 200 with `push:true` → state `{login:'x', access:'write'}`; repo 404 →
  `access:'none'`; `/user` 401 → token cleared.
- ETag: second call sends `If-None-Match` with the first response's ETag.
- Browser: with no token, L3 nodes show 🔒; file:// banner text exactly as 03_UI §7.

## Out of scope
The allowed list (H5). Microsoft / Google OAuth (v2).
