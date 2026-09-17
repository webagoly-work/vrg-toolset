# QR subsystem — design, integration, verification

*Companion to `ARCHITECTURE.md` and `DECISIONS.md`. Triage: **1.1 · INDEPENDENT** for the
engine and the static targets; the relay-backed targets are **2.0 portable/on-site** and
land with the Portable Hardware Pack.*

**Status:** written and syntax-verified in isolation and in a concatenated simulation.
Not yet built, not yet run in a browser. See *Verification* at the bottom.

---

## What this is

Two new modules. The split is the whole point.

| file | ~lines | knows about |
|---|---|---|
| `src/05f-qr.js` | 190 + 12 KB lib | encoding, the registry, the dialog, the relay handshake. **Nothing about walls, devices or circuits.** |
| `src/05g-qr-targets.js` | 130 | every "make a QR of this" option in the Planner. |

`05f` is the file you copy into the next project unchanged. `05g` is the file you rewrite.
Delete `05g` and `05f` still builds and still works — it just offers nothing.

Both sort after `05e-settings.js` and before `06-wall-editor.js`, which puts them after the
action registry (`05c`, where `ACTIONS` is a `const` and therefore in TDZ until it runs) and
before anything that might want to call them. Everything they touch from the rest of the app —
`$`, `openModal`, `esc`, `t`, `actionCtx`, `registerAction`, `data`, `state` — is either a
hoisted function declaration or read at call time.

---

## The one thing to understand: adding an option is one call

This is the requirement you actually asked for — point at something, say "make a QR option
for that", and have it be a small edit rather than a feature.

```js
qrRegister({
  id:'dev', label:'QR — készülék adatai', icon:'▦', group:'Készülék',
  on:['devices'],                       // right-click menus it attaches to
  when:c=>qrRefIdx(c,'devices')!=null,  // when it's offered
  text:c=>qrDevText(data.devices[qrRefIdx(c,'devices')])   // the payload
});
```

That single call gets you, with no other edits anywhere:

- an entry in the **⌘K palette** (`qrRegister` calls `registerAction` for you, id `qr.dev`),
- a button in the **inspector**, because the inspector is generated from the registry and
  `group:'Készülék'` is a selection group,
- a line in the **right-click menu** of every device, because `on:['devices']`,
- a **keyboard-reachable** command, if you add `keys`,
- and later, a **Súgó** entry for free when H1 lands, because it is a registered action like
  any other.

This is deliberately the same shape as an action. `DECISIONS.md` already says *"an action that
isn't registered is a feature nobody can find"* — a QR source that isn't registered is worse,
because it is a feature only you know the name of.

### The three shapes of target

All three are in `05g` as working templates.

- **STATIC** — `text()` returns a constant or reads a small `form()`. `wifi`, `url`, `text`.
- **BOUND** — `text(c)` reads the clicked or selected record. `dev`, `path`, `room`.
- **RELAY** — `text()` is a `qrLink(...)` and needs the relay running. `phone`, `cmd`, `dl`.

A target may declare `form(ctx)` returning HTML; the dialog re-runs `text()` on every
keystroke in it, so a WiFi form or a command picker live-updates the code.

---

## The IP problem, which is the actual problem

You named it: *"make the phone read info that otherwise users would have to type by hand,
like the generated IP address."*

The Planner runs from `file://`. There is **no browser API that tells a page its own LAN
address** — not `location`, not WebRTC (mDNS obfuscation killed that in 2019), not anything.
So the planner cannot generate the phone-connect QR on its own. Something that *does* know
the address has to tell it, and the only such thing on the machine is the relay.

**The contract.** `phone-relay-server.js` grows one endpoint:

```js
// GET /whoami  →  the only thing the planner needs from the relay before a QR exists
if (req.url.split('?')[0] === '/whoami') {
  const os = require('os'), lan = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list)
      if (i.family === 'IPv4' && !i.internal) lan.push(i.address);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    // file:// pages send Origin: null, which '*' matches. Without this the
    // planner cannot read the reply and every link QR stays dark.
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify({
    app: 'varler-relay', v: 1, port: PORT, lan, token: TOKEN || '',
    paths: { phone: '/phone-sender.html', cmd: '/cmd', dl: '/dl' }
  }));
  return;
}
```

**The handshake.** `qrProbe()` tries `http://127.0.0.1:<port>/whoami` across
`8080, 8081, 3000` (configurable), 900 ms each, and stops at the first reply whose `app` is
`varler-relay`. It runs only when a `net:true` target opens its dialog — no background
polling, nothing at boot.

Three outcomes, all visible in the dialog rather than silent:

| | shown |
|---|---|
| relay answers | 🟢 green dot + the base URL + an *Újrakeresés* button |
| relay down, or CORS blocked | 🔴 red dot + *"Nem fut a relé (START.cmd → 4)"* + a manual address field that persists |
| manual address set | that address wins over the probe, always |

The manual field is the escape hatch and it is not a fallback of last resort — it is also how
you point QR codes at *anything else* in the environment: a second Node service, a file
server, a camera stream on another port.

**Where the address is stored.** `localStorage`, keys prefixed `VQR_` — **not** `state`, and
therefore not inside a `.vplan.json`. The relay address belongs to this PC on this site. A
drawing that carried a stale `192.168.1.24` to another machine would generate confidently
wrong QR codes, which is worse than generating none.

---

## Menu-layer integration — five one-line edits in `09-menus.js`

The engine exposes one seam: `qrInject(items, kind, ref)`. Add it to each `ctxMenu` branch
just before the `ctxMenu(e, items)` call.

| branch | line to add |
|---|---|
| device hit (after `deviceExtraItems(di,items);`) | `qrInject(items,'devices',{i:di});` |
| path section (`if(ps){...}`) | `qrInject(items,'paths',{pi:ps.pi,si:ps.si});` |
| generic hit (after `if(h.t==='devices')deviceExtraItems(h.i,items);`) | `qrInject(items,'devices',{i:h.i});` |
| `roomMenuItems(rh)` — serves both the slab hit and the polygon hit | `qrInject(items,'floors',{i:rh.i,rm:rh.rm});` |
| empty stage (`bgItems`, optional but recommended) | `qrInject(bgItems,'stage',null);` |

The last one is the on-site one. Right-click anywhere on empty canvas and you get
📱 *telefon csatlakoztatása*, 📶 *WiFi hálózat*, 🔗 *cím / port* without hunting for anything.

Note the room case: `roomMenuItems` is shared by a floor-slab hit and a room-polygon hit and
only one of them carries an index, so `qrRoomRec()` accepts either the record or the index.
That asymmetry already exists in the codebase; the target works around it rather than
requiring `09-menus.js` to be normalised first.

**The inspector and the palette need no edits at all.** They are generated from the registry.

---

## What ships in `05g` today

| id | label | kind | notes |
|---|---|---|---|
| `phone` | Telefon csatlakoztatása | RELAY, `on:['stage']` | the flagship — the IP you no longer type |
| `cmd` | Parancs a Plannernek | RELAY | picks any keybound action; relay forwards it back |
| `dl` | Letöltés telefonra | RELAY | BOM / vezetékkimutatás / .vplan / SVG |
| `wifi` | WiFi hálózat | STATIC, `on:['stage']` | ECC M by default; escapes `\ ; , : "` |
| `url` | Cím / port | STATIC, `on:['stage']` | any other service in the environment |
| `text` | Tetszőleges szöveg | STATIC | the scratchpad |
| `dev` | Készülék adatai | BOUND, `on:['devices']` | ref, type, level, height, position, lamp, box |
| `path` | Pálya szakasz | BOUND, `on:['paths']` | kivitel, áramkörök, hossz |
| `room` | Helyiség | BOUND, `on:['floors']` | név, terület, környezet, belmagasság |

`cmd` and `dl` are written against the relay contract above and are **inert until the relay
implements `/cmd` and `/dl`** — the QR will encode a well-formed URL that 404s. That is
deliberate: the planner side is done and the server side can follow whenever the Portable
Pack work resumes.

---

## Hard limits, written down so nobody rediscovers them

- **~2953 bytes at ECC L**, 2331 at M, 1663 at Q, 1273 at H — and those are byte-mode maxima;
  pure-numeric or uppercase-alphanumeric payloads fit more, which is why `qrEncode` is the
  authority and `QRCAP` is only a UI hint. Over capacity, the dialog says how many bytes over
  and suggests the two real fixes: lower the ECC, or send a link instead of the data.
- **Anything bigger than a QR must be a link.** That is what `dl` is for. A BOM is not going
  in a QR code and no amount of compression changes that by an order of magnitude.
- **`file://` cannot be the target of a phone-scanned QR.** A phone cannot open
  `file:///C:/Planner_VRG/...`. Every link target goes through the relay by construction.
- **A QR is a picture of a credential.** The WiFi target embeds a password and the relay
  targets embed the token. `qr.sub.wifi` says so in the dialog. Do not paste one into a
  drawing that goes to a customer.
- **`shape-rendering="crispEdges"`** is on the generated SVG on purpose. Without it the
  browser antialiases module edges and phone cameras fail on small renders. Don't strip it.

---

## Engine API (for the next project)

```
qrEncode(text,{ecc,border,dark,light}) → {ok,n,w,border,get(x,y),svg,version,ecc,bytes,err}
qrSvg(text,opts)                       → svg string | null
qrPng(text,opts,scale)                 → data URL | null      (raster from the matrix,
                                                               no SVG→Image, no tainting)
qrBytes(s)                             → UTF-8 length, no TextEncoder needed

qrRegister(src) / qrRegisterAll([...]) / qrById(id) / qrSources(ctx)
qrInject(items,kind,ref)               → menu seam
qrShow(srcOrString,ctx)                → the dialog
qrRefIdx(ctx,collection)               → clicked index, else selection index, else null

qrProbe(cb) / qrBase() / qrLink(path,params) / qrGet(k,d) / qrSet(k,v) / qrCfg()
```

The Nayuki encoder (v1.8.0, MIT, © Project Nayuki) is wrapped in its own IIFE with its own
`'use strict'` prologue. This matters in this codebase: pasted verbatim into the
concatenation, its leading `'use strict'` would land mid-file where it is a no-op string
expression, and the library would silently run in sloppy mode. Wrapping also contains its one
top-level name, `qrcodegen`, which never reaches the shared scope.

**Collision check run against `dist/varler_planner.html` (v1.0.0):** all 32 new identifiers
plus the `VQR_` storage prefix return **0 matches**. Re-run before building —

```
findstr /C:"qrEncode" /C:"qrRegister" /C:"qrInject" /C:"QRGEN" /C:"QRSRC" /C:"VQR_" dist\varler_planner.html
```

---

## Verification — what is done and what isn't

Done here:

- `node --check` on `05f` alone, `05g` alone, and the two concatenated.
- A concatenated-scope harness with stubs for `t`, `esc`, `$`, `openModal`, `registerAction`,
  `ACTIONS`, `actionCtx`, `data`, `DEV`, `BUILDS`, `polyArea`, `localStorage`: **23/23**.
  Covers registration count, action-id prefixing, re-registration replacing rather than
  appending, SVG output, version selection, UTF-8 byte counting, over-capacity reporting,
  WiFi escaping, null base → null link, manual base → correct link, `qrRefIdx` resolving from
  both `qrRef` and `selected`, and menu injection for all four kinds.
- Encoder smoke test: `http://192.168.1.24:8080/phone-sender.html` → version 3, 29×29.

Still yours to do, on your machine:

1. `node build.js` with both files in `src/`, then `node --check` on the extracted script.
2. Full-source `findstr` collision pass (above).
3. `npm test` — the golden renders **must not move**. The QR subsystem is chrome, not
   drawing; if a hash changes, something leaked into `draw()`.
4. Browser pass (`browser_verification_checklist.md` additions):
   - ⌘K → "qr" lists nine entries, disabled ones dimmed with their `need` line.
   - Right-click a device / a path section / a room / empty canvas → the QR line appears.
   - Open `QR — WiFi hálózat`, type an SSID, watch the code redraw per keystroke.
   - **Scan one with an actual phone.** A code that renders is not a code that scans.
   - SVG and PNG download buttons from a `file://` page in portable Opera GX. `a.download`
     + object/data URL is expected to work in Chromium from `file://`, but it is exactly the
     kind of thing that behaves differently there — this is the highest-risk item on the list.
   - With the relay stopped: `QR — telefon csatlakoztatása` must show the red dot and the
     manual field, not a blank box or a dead code.
   - With the relay running and `/whoami` added: green dot, correct LAN address, scan it.

---

## Deliberately not built

Recorded so they don't get re-investigated.

- **QR scanning in the Planner.** The PC side reading codes is a separate capability with a
  separate library; Chromium's native `BarcodeDetector` makes it nearly free when it's wanted.
  Not needed for any of the flows above, all of which are phone-reads-screen.
- **`qr-zip` style binary/deflate codes.** They break every normal QR reader — the receiving
  phone would need bespoke software. If the payload doesn't fit, use a link.
- **Animated / chunked QR sequences** for large payloads. Same objection, plus a scanner that
  reassembles chunks. The relay is the answer to "too big".
- **Printing QR codes onto the drawing** (a code beside each board or box on the printed
  plan). Genuinely useful, genuinely a different feature — it touches `04-render.js` and the
  print path. **Parked as a real 1.1 candidate**, not a dead end.
- **Copying the code as an image** to the clipboard. `ClipboardItem` is unreliable from
  `file://`. The copy button copies the payload text; PNG download covers the rest.
- **WebRTC / PeerJS direct phone↔PC** to avoid the relay. Still needs a signalling server to
  exchange offers, so it does not remove the server — it adds a second one.
