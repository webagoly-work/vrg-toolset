# ServiceKit Phone — Rooted mode

The **no-root** path (controller + deploy) is the default and needs nothing
special. This folder is the **rooted** alternative, for when you own a rooted
phone and want it to behave like a real stick instead of a controller:

- **Real USB mass-storage stick** — the phone exposes a FAT image to the PC as a
  removable drive. The PC mounts `…:\ServiceKit` exactly like a passive stick, with
  **no bridge at all**. (This is what DriveDroid does; it's a root-only trick.)
- **USB HID keyboard** — the phone types service macros straight into the PC
  (open Run, launch the kit, run a command), openly operated by you.

Pick the mode in the app (Kapcsolat → **Mód**). Rooted mode reshapes the app:
Deploy becomes "the phone is the drive", and Vezérlés/Parancsok drive the HID
keyboard through the local bridge below — same UI, keystrokes instead of a PC bridge.

> **Honest status:** the keystroke keymap, the macro sequences and the local HID
> bridge's protocol are **tested**. The USB-gadget setup itself (`skstick.sh`) and
> the actual typing are **untested on hardware** — written without a rooted phone.
> configfs paths, the UDC name and which gadget functions exist vary by device and
> kernel; read the script's echoes. No client/GDPR data anywhere.

## Requirements

- A **rooted** phone (`su`), e.g. Magisk.
- A kernel with **configfs USB gadget** (`CONFIG_USB_CONFIGFS`) plus
  **`f_mass_storage`** and **`f_hid`**. Most phones since ~Android 8 have these;
  some vendor kernels strip `f_hid`. If `f_hid` is missing, only the stick works.
- **Termux** (or any root shell) with `node`, `python3`, and for building the
  image `dosfstools` + `mtools`:  `pkg install nodejs python dosfstools mtools unzip`
- The USB port able to act as a **peripheral/gadget** (true for phones over their
  own USB-C/micro-USB to the PC).

## What's here

| File | What |
|---|---|
| `skstick.sh` | the USB gadget: build the FAT image from the kit, bring mass-storage and/or HID up/down, status, teardown |
| `skhid.py` | turn text / key-combos / named macros into HID reports on `/dev/hidg0` |
| `macros-hid.json` | the HID macros (keystroke sequences), editable |
| `hid-bridge.js` | loopback WebSocket bridge so the **app** drives HID through its normal UI |
| `magisk-module/` | optional reboot-persistent install (auto-setup is OFF by default) |

## Quick start (on the phone, as root)

```sh
su
cd /path/to/ServiceKitPhone/rooted

# 1) build the stick image from the bundled kit, then expose stick + HID keyboard
sh skstick.sh build            # -> /data/local/tmp/servicekit.img (FAT, labelled SERVICEKIT)
sh skstick.sh both on          # PC now sees a removable drive AND a keyboard (/dev/hidg0)

# 2) optional: let the app drive the HID keyboard through its own UI
node hid-bridge.js             # ws://127.0.0.1:47815  (loopback only)
```

On the PC: the **ServiceKit drive** appears — open `…:\ServiceKit\START.cmd`.
In the app: choose **Rooted** mode and **Connect** (127.0.0.1 : 47815). Vezérlés
and Parancsok now type into the PC.

Type without the app, directly:

```sh
python3 skhid.py macro launch-kit        # finds the stick's drive letter and runs START.cmd
python3 skhid.py key GUI+r               # press Win+R
python3 skhid.py text "cmd /k ipconfig"  # type a line
python3 skhid.py list                    # list the macros
```

Tear down when done (restores adb/MTP):

```sh
sh skstick.sh stick off      # safely detach the drive
sh skstick.sh teardown       # remove the whole gadget
```

## The catch with bringing up a gadget

Binding our composite gadget usually **replaces** the stock one, so **adb and MTP
drop** until `teardown` (or a reboot). That's inherent to single-UDC phones, not a
bug. If you need adb alongside, some kernels allow adding it as another function —
out of scope here. `skstick.sh status` shows what's bound.

## Safety

This is an **openly operated** service tool for your own and authorised machines —
it types what you tell it to, in front of you. It is not a covert input device:
no stealth, no logging, no exfiltration. Dangerous macros (admin prompt, lock)
ask to confirm in the app first. The mass-storage image contains only the kit —
no client/job data. Keep it that way.

## Magisk module (optional)

`magisk-module/` is a self-contained module that drops the scripts at
`/data/adb/servicekit/` so they survive reboots. **Auto-setup on boot is OFF by
default** (it would drop adb/MTP every boot); enable it by uncommenting the lines
in `service.sh`. Zip the folder's contents and flash in the Magisk app.
