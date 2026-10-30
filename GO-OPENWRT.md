# GO OPENWRT — put OpenWrt on the TP-Link TL-WR1043ND

*You were started with the codephrase **GO OPENWRT**. This file is the whole briefing. The user asked for this
thread on 2026-10-26 (in the GO LIVE session, answering CITY-D24): "no router change for now, but create a new
thread that starts up the process of flashing OpenWrt — I wanted to do it anyway".*

## 0. What this is, and what it is not

- The router is the **TP-Link TL-WR1043ND** at `192.168.0.1`. It sits behind the ISP's Huawei ONT (double NAT),
  and this PC is wired to it. Facts and sources are in `docs/research/2026-10-26_router-usb-phone-wake.md` (if it is
  not on `main` yet, it is an uncommitted file of the primary account; read it, do not commit it).
- **Flashing is the user's hands-on step.** You prepare, check, write the plan and the step list, and verify
  afterwards. You never flash, reboot or reconfigure the router yourself, and you never ask for or store the
  router's admin password. A wrong image or a power cut during the flash can brick the router.
- During the flash and the first setup this PC has **no internet** (it reaches the internet only through this
  router). Plan the order so that everything that needs a download is downloaded first.

## 1. Where and how

- Main checkout `H:\VRG\Full\Planner_VRG_U100`, branch `main`. Write into `docs/openwrt/`
  (new). Commit your own files by path after each phase; never push, never switch branch, never stash.
- Follow `CLAUDE.md`. No secrets in the repo: no passwords, no Wi-Fi keys, no MAC addresses in full.

## 2. Phases (stop at the end of each, report, wait for "tovább")

**P0 · Facts from the user.** Ask, numbered: (1) the hardware version on the sticker underneath (v1 / v2 / v3 / v4
— v1 has 32 MB RAM and is effectively out; v2–v4 have 8 MB flash and 64 MB RAM), (2) the stock firmware version
(stock UI → System Tools → Firmware Upgrade shows it), (3) what the router must still do afterwards (Wi-Fi names,
USB stick sharing, Wake-on-LAN for this PC, anything else), (4) whether a spare router or the Huawei's Wi-Fi can
carry the household during the flash. Ask the user to save a **stock config backup** (System Tools → Backup & Restore)
to a folder outside the repo.

**P1 · Research, then `docs/openwrt/PLAN.md`.** For the exact hardware version: the OpenWrt Table of Hardware page,
the newest release that still builds for 8/64 devices, the **factory** image (from stock) vs the **sysupgrade**
image, and its sha256 from downloads.openwrt.org; known problems on this model; the recovery path (TFTP recovery /
serial) and the stock firmware for going back. Size check: which packages fit in 8 MB (ksmbd or Samba for the USB
stick, etherwake / wol, luci). Write PLAN.md: steps, the go / no-go checks, the rollback, what is offline when.

**P2 · Downloads and checks (while the internet still works).** Download the image(s), the stock firmware for
rollback and any packages into a folder outside the repo (e.g. `H:\_installers\openwrt\`); verify the sha256 against
the official list; record names and checksums in PLAN.md.

**P3 · The flash (the user, guided).** A short numbered step list in Hungarian for the user: wired to a LAN port,
no Wi-Fi, stock UI → Firmware Upgrade → the factory image, wait without touching power, then `192.168.1.1` (OpenWrt's
default address). You verify afterwards: ping, LuCI reachable, the image version.

**P4 · Set up again.** Back to the old LAN address `192.168.0.1` (so this PC, its Wake-on-LAN and the double-NAT
notes stay right) — or a decision to change it; WAN to the Huawei; Wi-Fi; the USB share; WoL. The user types every
password themselves.

**P5 · What Kódváros may then see (only with the user's yes).** CITY-D24 is **A for now** (no router change, the
city uses NIC counters, tracert and ARP). After a working OpenWrt, re-ask CITY-D24 as C: read-only router telemetry
(e.g. collectd / luci-app-statistics or a read-only ubus user) for the city's border and station. Record the answer in
`docs/city/README.md` §5.

## 3. Ask

Decisions as numbered items with lettered options, the recommended one first. When unsure about a hardware detail,
ask for a photo of the sticker rather than guess.
