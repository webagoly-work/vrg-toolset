# SK-CYD line protocol

A ServiceKit companion for a classic **Cheap Yellow Display** (ESP32-2432S028R:
ESP32 + 2.8" ILI9341 320×240 + XPT2046 touch + microSD). The CYD is the dumb
display + input; the PC **bridge** (`bridge.js`) is the smart half. Same shape as
the Planner's CYD: short `TAG|field|field` lines over the USB-serial COM port at
**115200 baud**, `\n`-terminated.

The classic CYD reaches the PC only as a COM port (CH340/CP2102). It is **not**
USB mass storage and **not** a USB HID device. So:

- The **passive ServiceKit stick** stays the thing the PC mounts as a drive.
- The **CYD's own microSD** is the device's offline store (reference + a manifest
  of what the deployment stick should contain). The firmware reads it directly —
  no bridge needed — which is what makes the device useful when the PC is dead.
- Anything touching the PC's filesystem or running the kit goes through the bridge,
  and only works when the PC is alive enough to run `bridge.js`.

## Charset

UTF-8, limited to what the CYD fonts draw: ASCII, `áéíóöőúüű ÁÉÍÓÖŐÚÜŰ` and
`° – … · ×`. The bridge folds other accented letters to their base, drops emoji,
turns a literal `|` inside a field into `/`, and cuts each field to the CYD buffer
**in bytes**, never inside a character. No field contains `\n`.

`|` separates fields. A field may be empty. Numbers are decimal ASCII.

## Bridge → CYD

| Line | Meaning |
|---|---|
| `HELLO\|<pcName>\|<bridgeVer>` | Sent once on connect. |
| `HB\|<pcAlive>` | Heartbeat, every 1 s. `pcAlive`=1 always here (the bridge runs on the PC); its absence for 4 s = no bridge / PC asleep. |
| `KIT\|<present>\|<drive>\|<ver>` | Deployment stick seen? `present` 0/1, `drive`=e.g. `E:`, `ver`=kit version or empty. |
| `JOB\|<client>\|<computer>\|<status>\|<min>` | Active ServiceKit job. **Example/placeholder names only** — the bridge never ships real client data (see §Privacy). Empty client = no job. |
| `PB\|<title>\|<done>\|<total>\|<running>` | Active playbook progress. |
| `STEP\|<status>\|<text>` | Latest playbook step. `status` ∈ ok/info/warn/fail/skipped. |
| `SETUP\|<done>\|<total>\|<phase>` | Installer progress; `phase` ∈ resolve/download/extract/done. |
| `DRV\|<id>\|<label>\|<freeGB>\|<totalGB>\|<kind>` | One PC drive. `kind` ∈ fixed/removable/cd/net. Repeated. |
| `DBEG\|<path>` | Start of a PC directory listing for `path`. |
| `D\|<name>\|<isDir>\|<sizeKB>\|<mtime>` | One entry. `isDir` 0/1. Repeated after `DBEG`. |
| `DEND\|<path>\|<count>\|<truncated>` | End of listing. `truncated` 0/1 (listings are capped). |
| `WIZ\|<id>\|<step>\|<status>\|<text>` | Deployer/wizard progress for action `id`. `status` ∈ run/ok/warn/fail. |
| `MSG\|<level>\|<text>` | Banner/toast. `level` ∈ info/ok/warn/err. |
| `ACK\|<cmdId>\|<ok>\|<text>` | Reply to a CYD command. `ok` 0/1. |

## CYD → Bridge

| Line | Meaning |
|---|---|
| `HI\|<fwVer>\|<sdGB>\|<sdFreeGB>` | Hello; the CYD's own SD size. |
| `P\|<pageId>` | The CYD moved to a page, so the bridge can tailor what it streams. |
| `DRIVES` | Ask for the PC drive list (→ `DRV` lines). |
| `LS\|<path>\|<cmdId>` | List a PC directory (→ `DBEG`/`D`/`DEND`). `path` empty = drive roots. |
| `OPEN\|<path>\|<cmdId>` | Open a file/folder on the PC in Explorer. |
| `RUN\|<actionId>\|<arg>\|<cmdId>` | Run a bridge action (see §Actions). |
| `PING` | Keep-alive (→ `HB`). |

## Actions (`RUN`)

Every action is explicit and reported step-by-step via `WIZ`. Nothing destructive
runs without a `confirm:1` arg, which the CYD only sends after a touch confirm.

| actionId | arg | What the bridge does |
|---|---|---|
| `verify` | — | Check the deployment stick against `manifest.json` (files present, sizes, SHA256 of small files). Report pass/missing/changed. Read-only. |
| `deploy` | `<dest>;confirm:1` | Copy ServiceKit from the stick to `<dest>` folder on the PC. Refuses without confirm. Never overwrites outside the chosen folder. |
| `launch` | `dashboard` / `setup` / `shell` | Start ServiceKit's START/SETUP/KITSHELL from the stick on the PC. |
| `makeboot` | — | Open the boot-stick tool (Rufus/Ventoy) from the stick on the PC. Guidance only; the bridge never writes a disk itself. |
| `syncsd` | `confirm:1` | Refresh the CYD SD's `reference/` + `manifest.json` from the stick (small files only; serial is slow). |
| `openkit` | — | Open the deployment stick's folder in Explorer. |

## Privacy

The bridge is built for a personal project. It **never reads, sends, stores or
displays real client/job data**. The `JOB` line carries only example/placeholder
names, and the bridge's demo/sample data uses obviously-fake names (e.g.
`Minta Ügyfél`, `TESZT-PC`). If a real ServiceKit job file is ever present, the
bridge shows the computer name and status but blanks the client to `—` unless the
operator has explicitly opted that job in. Nothing client-identifying is written to
the CYD SD.
