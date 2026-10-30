# ServiceKit Phone

Turning a **phone into the CYD**: an installable touch console that plugs into a
PC over USB and acts as the service technician's control surface — run macros,
launch the kit, mirror the job status, browse the offline command DB and Súgó,
and **deploy the whole ServiceKit onto the PC** from the phone.

> Personal project, v1.0. The PWA, the PC bridge and the full phone↔bridge flow
> are **tested** (browser at phone size + bridge in mock mode: connect, auth,
> macros, run-on-PC, command run, Súgó, kit upload). The **APK** is scaffolded
> for you to build in Android Studio — that step needs the Android SDK and isn't
> run here. **No client/job/GDPR data anywhere — example names only.**

## Why a phone instead of a stick (or a CYD)

A passive USB stick is pure storage: the PC has to mount it, run its software and
show that software on the PC's own screen — which fails in exactly the bad states
a service call is about (no display, Explorer down, won't boot to desktop). The
[ServiceKit CYD](../ServiceKitCYD) solved that with a dedicated ESP32 screen. The
phone is the same idea with a screen everyone already carries: **its own display
and touch**, plus a real network stack, so it can both *control* the PC and
*carry and deploy* the kit.

### Two modes — your choice (Kapcsolat → Mód)

| | **Bridge (no root)** — default | **Rooted (stick + HID)** |
|---|---|---|
| USB role | MTP only — phone is a *controller* | real **USB mass-storage** + **HID keyboard** |
| Deploy | phone uploads the kit to a PC bridge, which extracts it | phone **is** the drive; the PC mounts `…:\ServiceKit` directly, no bridge |
| Macros/commands | run on the PC via the bridge (`--allow-run`) | **typed** into the PC as keystrokes |
| Needs | nothing special | a rooted phone + a kernel with configfs `f_mass_storage`/`f_hid` |
| Status | **tested** | gadget/typing **untested on HW**; keymap + protocol tested |

The non-root constraint is real: a non-rooted Android phone **cannot** present
itself as a USB drive or keyboard — modern Android only exposes **MTP**, and true
drive/HID emulation needs root (that's what DriveDroid does). The rooted path lifts
that; everything for it lives in [`rooted/`](rooted/README.md). The rest of this
README describes the default **controller + deploy** path:

```
   PHONE (this app)                         PC (the bridge)
   ┌───────────────────┐                    ┌───────────────────────────┐
   │ Connect  Control  │   ws:// line       │ skphone-bridge.js         │
   │ Commands Help     │◀─ protocol ───────▶│  • mirrors ServiceKit     │
   │ Deploy            │   over USB or Wi-Fi │  • runs curated macros    │
   │ carries the kit ──┼─── uploads ────────▶│  • extracts kit to C:\    │
   └───────────────────┘                    └───────────────────────────┘
```

Two ways to connect, no root either way:

1. **USB cable (recommended).** Turn on USB debugging, run `skphone-connect.cmd`
   on the PC. It does `adb reverse tcp:47814 tcp:47814`, tunnelling the bridge
   down the cable; the phone connects to `127.0.0.1:47814` with **no token**.
2. **Wi-Fi / USB tethering.** Run `skphone-wifi.cmd`; it prints this PC's IP and a
   **6-digit pairing token**. Enter both in the phone. The bridge refuses every
   unauthenticated client when bound off-loopback.

And if there's no connection at all, the phone still shows over USB as a **media
device (MTP)** — copy the `ServiceKit` folder across by hand.

## What's here

| Path | What | State |
|---|---|---|
| `www/` | the PWA — installable phone web app, works fully offline | tested (browser) |
| `www/app.js` | the 5 screens + the ws line-protocol client | tested |
| `www/cmdview.js` | the 329-command DB view (shared with ServiceKit) + "Run on PC" | tested |
| `www/data/` | `commands.js`, `sugo.js` (48 entries), `playbooks.js` — offline reference | — |
| `www/kit/ServiceKit.zip` | the deployable kit the phone carries (296 KB, no client data) | — |
| `www/sw.js`, `www/manifest.webmanifest`, `www/icons/` | offline cache + install metadata | tested |
| `bridge/skphone-bridge.js` | PC-side bridge: ws server, auth, status mirror, macros, run, kit extract | tested (mock) |
| `bridge/macros.json` | 19 curated quick actions, editable | — |
| `bridge/skphone-connect.cmd` | USB (adb-reverse) launcher | — |
| `bridge/skphone-wifi.cmd` | Wi-Fi / tethering launcher (prints token) | — |
| `capacitor.config.json`, `package.json`, `android-res/` | the APK scaffold | — |
| `rooted/` | rooted mode: USB gadget (`skstick.sh`), HID sender (`skhid.py`), HID macros, local HID bridge, Magisk module | keymap+protocol tested; gadget untested on HW |

## The five screens

- **Kapcsolat / Connect** — host / port / token, the connection state, the PC's
  kit + run capability, and quick launch (Dashboard / Setup / Kit Shell / Kit folder).
- **Vezérlés / Control** — the live ServiceKit status mirror, and the macros from
  `bridge/macros.json`, grouped by category. Red ones confirm first.
- **Parancsok / Commands** — the whole 329-command CMD/PowerShell DB, offline. Tap
  to copy always; when connected with run enabled, tap **Run on PC**.
- **Súgó / Help** — the 48-entry offline troubleshooting database. Works with no PC.
- **Telepítés / Deploy** — upload the bundled kit to the PC and extract it
  (default `C:\ServiceKit`), or upload only, or verify an existing install.

## Try it now (no phone, no hardware)

```bash
cd bridge
node skphone-bridge.js --allow-run --mock-pc    # ws on 127.0.0.1:47814, fake PC
# in another shell:
cd ..
npm run serve                                   # www on http://127.0.0.1:8130
```

Open `http://127.0.0.1:8130` in a browser (phone viewport), press **Kapcsolódás**.
On a real phone over USB, it's `skphone-connect.cmd` on the PC, then **Kapcsolódás**.

## Safety

- **Run-on-PC is OFF by default.** Macros and "Run on PC" only work when the bridge
  is started with `--allow-run` (both `.cmd` launchers pass it; plain
  `node skphone-bridge.js` does not). Dangerous macros confirm on the phone first.
- **Auth required off-loopback.** Binding to anything but `127.0.0.1` without a
  token makes the bridge mint one and reject unauthenticated clients.
- **No client data.** The bridge never sends real client data — the status line
  blanks the client to `—` unless explicitly opted in, and the bundled kit's
  `data/` and `state/` are empty. Keep it that way — personal project first.

## Building the APK

The `www/` app is a normal PWA — on Android/Chrome you can **Add to Home screen**
and use it with no build at all. To ship a real installable `.apk`, it's wrapped
with **Capacitor** (chosen over a TWA because the app must run fully offline and
reach a `ws://` bridge on the LAN — a TWA needs HTTPS hosting + Digital Asset
Links, neither of which fits a local tool):

```bash
npm install                 # @capacitor/core, /android, /cli (v6)
npx cap add android         # creates android/  (gitignored)
npx cap sync android        # copies www/ into the app
# then, for cleartext ws:// to the PC:
#   copy android-res/network_security_config.xml
#     -> android/app/src/main/res/xml/network_security_config.xml
#   add to <application> in AndroidManifest.xml:
#     android:networkSecurityConfig="@xml/network_security_config"
npx cap open android        # opens Android Studio -> Build > Build APK(s)
```

`appId` is `work.webagoly.servicekit`. Re-run `npx cap sync android` after any
change under `www/`.

## Next ideas (not built)

- ~~A one-line PC bootstrap (`irm … | iex`) as a deploy alternative~~ — **done**:
  see [`ServiceKit/bootstrap.ps1`](../ServiceKit/bootstrap.ps1); the controller-mode
  Deploy screen shows the one-liner as an alternative to the upload.
- Test the rooted gadget path on a real rooted phone and pin down the per-device
  configfs quirks (UDC name, `f_hid` availability).
- Gyro / trackpad control for Planner and Kódváros (folds in the old phone-relay
  idea — see the air-mouse sketch), riding the same ws line protocol.
- Fold into `vrg-toolset` proper as `Phone/` sharing the CYD line-protocol
  conventions with `planner-cyd` and `servicekit-cyd`.
