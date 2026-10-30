# WP-H5 — Signed allowed list + top-layer gate

**Goal (user):** "top layer content (new dist html files, worktrees) are only accessible if they are
in the allowed email list (allowed list can be only edited by me)".

## Depends / decisions
H4. **HUB-Q04** (A = signed list). The two users' GitHub logins + emails come from the user in chat
(names and emails only — no passwords; see `04_SETUP-CHECKLIST.md`).

## Read
`01_ARCHITECTURE.md` §3.2 · Node `crypto.generateKeyPairSync('ec', {namedCurve:'P-256'})`,
`crypto.sign('sha256', data, {key, dsaEncoding:'ieee-p1363'})` · WebCrypto `importKey('jwk', …,
{name:'ECDSA', namedCurve:'P-256'})`, `verify({name:'ECDSA', hash:'SHA-256'}, …)`.

## Build
1. `Hub/data/access.json`:
   ```json
   { "schema":"vrg-hub-access/1",
     "body": { "rev":1, "updated":"…", "people":[
       {"name":"…","github":"webagoly-work","emails":["…"],"role":"owner","layers":["L1","L2","L3","L4"]},
       {"name":"…","github":"…","emails":["…"],"role":"member","layers":["L1","L2","L3","L4"]} ] },
     "sig": "<base64 of the 64-byte r||s>" }
   ```
2. `kpCanon(obj)`: canonical JSON (keys sorted recursively, no spaces) — **one implementation**
   shared by `tools/hub-sign.js` (require it from `Hub/src/js/10-model.js`) and the page.
3. `tools/hub-sign.js`: `--init` makes the key pair; private PEM to `--key` (default
   `H:\VRG\Full\_admin\keys\hub-access.pem`; refuses a path inside the repo or containing
   `OneDrive`); writes the public JWK to `Hub/src/access-pubkey.json`. Without flags: signs
   `kpCanon(body)` → `sig`; `--verify` checks it. Never prints the private key.
4. Page: `kpAccessCheck()` → `{valid, me, role}`; invalid → banner "A hozzáférési lista aláírása
   érvénytelen — a programok zárva maradnak." `me` = person whose `github` equals the identified
   login (case-insensitive).
5. Gate: L1 program actions ("Megnyitás", "Előnézet") need `valid && me && me.layers.includes('L1')`;
   otherwise ⛔ with "Nem szerepelsz az engedélyezett listán — kérd a tulajdonost." Branch nodes
   ("fejlesztés alatt", H6) count as L1. The owner sees "Tulajdonos" in Belépések.
6. Honest note in the Belépések panel (one line): "A valódi zár a GitHub és a OneDrive jogosultság;
   ez a lista azt mutatja, kinek nyit a Kapu."
7. `check-hub.js`: verify the signature of the committed `access.json` (warn, not fail, when unsigned).

## Tests (`spec-60-access.js`, a throw-away key pair generated in the test)
- sign in Node → verify with WebCrypto (`globalThis.crypto.subtle`, Node 24 has it) → true.
- change one email after signing → false. Reorder keys in `body` → still true (canonical form).
- `kpCanon({b:1,a:{d:2,c:3}})` = `{"a":{"c":3,"d":2},"b":1}`.
- `hub-sign.js --init --key Hub/x.pem` → refuses (inside repo), exit 1.
- gate: valid + member with L1 → open enabled; login not in list → disabled with the ⛔ text.

## Out of scope
Editing the list in the page (by design it is impossible). Google/Microsoft identities (v2).
