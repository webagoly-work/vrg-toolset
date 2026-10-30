# Router USB ports, Wake-on-LAN and an old phone as a dev box

2026-10-26 · short research pass, nothing changed on the PC, the routers or the network.

## What is on the network (looked up, not guessed)

| Hop | Device | How identified |
|---|---|---|
| PC | DESKTOP-EE24ALH, Gigabyte **B560M DS3H V2**, Realtek Gaming GbE, `192.168.0.100`, wired | `ipconfig /all`, `Win32_BaseBoard` |
| 1 | **TP-Link TL-WR1043ND** (Wireless N Gigabit Router), `192.168.0.1`, MAC `c0:4a:00:…` (TP-Link), DHCP + NAT for the PC | HTTP 401 realm of its login page |
| 2 | **Huawei HG8245H** GPON ONT (ISP main router), `192.168.1.254` | `ProductName = 'HG8245H'` on its login page |
| 3 | `91.120.199.243` (ISP network) | `tracert -d` |

So the PC sits behind **double NAT** (192.168.0.x behind 192.168.1.x). That matters for anything that has to reach the PC from outside.
The TL-WR1043ND hardware version (v1 to v4) is printed on the sticker underneath. It was not checked, and it affects whether alternative firmware is an option.

## Verdict table

| Question | Verdict | Next step |
|---|---|---|
| 1. USB stick as network storage | **Partly.** The TP-Link shares a USB drive over SMB/FTP (stock UI: FAT32/NTFS). The Huawei is FTP only, behind ISP firmware. | Use the **TP-Link** port, one NTFS stick or a powered hub. Only for low-value, non-private files. |
| 1b. USB 2.0 1-to-4 hub, several sticks | **Partly.** TP-Link documents hubs with up to 4 storage devices on newer models. On this old unit, use a **powered** hub and expect it to be flaky. | Test with a powered hub. If the sticks drop out, go back to one stick. |
| 2. Other USB uses (printer, LTE, DLNA, charging) | **Partly.** Printer server and DLNA (TP-Link "Media Server") yes. LTE failover no (stock firmware). Charging yes, slowly (0.5 A). | A printer server is the only real gain. |
| 2b. Can the router's USB wake the PC? | **No.** | Wake is done over Ethernet (Wake-on-LAN). |
| 3. Wake-on-LAN | **Yes on the PC side, already armed.** No router here sends a magic packet from its stock UI. | Check the BIOS (ErP off), then send WoL from a device on the LAN (phone app / Tailscale node). |
| 3b. Safe remote sign-in | **Yes** | Tailscale + RDP, or Chrome Remote Desktop / RustDesk. **Never port-forward RDP.** |
| 4. Old Android phone mirroring this PC | **No as a mirror. Partly as a small, portable terminal.** | Termux (F-Droid) + proot-distro Debian/Ubuntu, used over SSH. Git and Node yes, Claude Code with a workaround. |
| 4b. Phone plugged into router USB | **Charging only, at best.** | Neither router does USB tethering on stock firmware. |

---

## 1. Router USB storage

**Verdict: partly. Use the TP-Link, not the Huawei.**

- **TL-WR1043ND** (USB 2.0): the stock firmware has *USB Settings → Storage Sharing* (SMB share, FTP server) and a Media Server (DLNA). Use FAT32 or NTFS. NTFS is recommended and is the only practical choice for files over 4 GB. exFAT support on TP-Link routers depends on the model; do not count on it for this one. ext3 is not supported on stock firmware.
- **HG8245H**: datasheet listings show one USB 2.0 port with **FTP-based storage only**. Samba and DLNA appear only on newer Huawei ONTs (HG8245W5/U/Q). It is ISP firmware: menus are often hidden or locked, and the data then sits on the ISP's box. Not recommended.
- **Hub**: TP-Link's own FAQ allows a USB hub with up to 4 storage devices on its newer routers. On a 2010s unit like this one, an **unpowered** 1-to-4 hub will brown out on 0.5 A. A **powered** hub is the minimum, and even then disconnects are reported (OpenWrt forum, WR1043ND + NTFS + powered hub). Each stick mounts as its own share.
- **Size limit**: none of the sources gives one. In practice FAT32 limits you to 4 GB per file, and very large NTFS volumes can mount slowly or fail on old router firmware.
- **Risks**:
  - Speed: USB 2.0 plus a weak router CPU gives low single-digit MB/s over SMB for NTFS. That is fine for documents, useless for `node_modules` or git repos.
  - Wear: sticks are not built for always-on writes. Keep them mostly read-only and back them up.
  - Security: the stock SMB on this firmware is old (SMBv1-era). Windows 10 may refuse it unless SMBv1 is re-enabled, **which should not be done**. FTP is plaintext. Keep it LAN-only and never expose it to the internet.
  - Privacy: do not put client PDFs (names, addresses) there. The repo rule on `*.pdf` exists for a reason.
- **Better port**: the TP-Link. It has a full storage UI and you control it. The Huawei is ISP-controlled and FTP-only.
- **Alternative firmware**: OpenWrt supports WR1043ND v2 to v4 (8 MB flash, 64 MB RAM) and can add ksmbd/Samba and WoL tools. It is tight on space, and v1 (32 MB RAM) is effectively out. This is optional, and it is a router change, so it is not done here.

Sources: [TP-Link FAQ 3951 (USB storage, hubs, formats)](https://www.tp-link.com/sa/support/faq/3951) · [TP-Link FAQ 3448](https://www.tp-link.com/tr/support/faq/3448/) · [Gargoyle: WR1043ND USB drive sharing](https://www.gargoyle-router.com/phpbb/viewtopic.php?p=4380) · [OpenWrt forum: USB HDD disconnects](https://forum.openwrt.org/t/troubles-with-usb-hdd-disconnecting-segmentation-fault/4339) · [HG8245H spec listing (USB 2.0, FTP)](https://www.normann-engineering.com/sk/products/1088/huawei-hg8245h/) · [HG8245W5 datasheet (Samba/DLNA, newer model)](https://www.orange.sk/fileadmin/orange/user_uploads/pages/5818/pdf/hg8245w5-datasheet.pdf) · [OpenWrt v3 support patch](https://lists.openwrt.org/pipermail/openwrt-devel/2016-February/013593.html)

## 2. Other uses for the router USB port

**Verdict: printer server yes. DLNA yes, but the PC already does it. LTE failover no. Wake no.**

- **Printer server**: the TL-WR1043ND stock firmware has a USB printer server (TP-Link "USB Printer Controller" utility). It is useful if a USB printer has to be shared.
- **DLNA**: the TP-Link Media Server can serve the stick. It is redundant, because this PC already runs WMPNetworkSvc as a DLNA server.
- **4G/LTE dongle failover**: not on this stock firmware (TP-Link added 3G/4G on other models). With OpenWrt it is possible in principle, but the ONT is the WAN, so it is not worth it.
- **Charging**: works, at USB 2.0 current (≈0.5 A), so it is slow.
- **Waking the PC**: **no.** The USB port has no path to the PC's power state. Wake goes over the Ethernet cable as a WoL magic packet (section 3).

## 3. Wake-on-LAN and remote sign-in

**Verdict: the PC is ready. The missing piece is something on the LAN that sends the packet.**

Checked on the PC (read-only):

- `powercfg /devicequery wake_armed` lists **Realtek Gaming GbE Family Controller** (and the gaming mouse).
- Adapter advanced properties: *Wake on Magic Packet* Enabled, *Shutdown Wake-On-Lan* Enabled, *Wake on pattern match* Enabled, *Energy-Efficient Ethernet* Disabled, *Green Ethernet* Enabled, *WOL & Shutdown Link Speed* 10 Mbps First.
- Fast Startup is off (`HiberbootEnabled = 0`). That is good for WoL from shutdown.
- **Not checked: BIOS.** On Gigabyte boards, set **ErP → Disabled** (otherwise the NIC has no standby power when the PC is off) and enable **Power → Wake on LAN** / *Resume by PCIe/LAN PME*. The exact names are in the B560M DS3H manual.
- Optional: *Wake on pattern match* can cause random wake-ups. Turn it off if the PC wakes by itself.

Getting the packet there:

- **The PC is wired to the TL-WR1043ND.** A magic packet is a LAN broadcast, so the sender must be on **192.168.0.x** (the TP-Link's LAN). A device on the Huawei's 192.168.1.x network, or one on the internet, will not reach it through the double NAT.
- **Neither router sends WoL from its stock web UI.** The TP-Link stock firmware has no WoL page (OpenWrt adds `luci-app-wol`). The HG8245H's ISP firmware does not expose one either.
- **Practical setup**: something always on, connected to the TP-Link's Wi-Fi, that sends the packet:
  - a phone app (e.g. "Wake On Lan" on Android) while at home, or
  - remotely: an always-on Android phone on the TP-Link Wi-Fi running **Tailscale** and a WoL app or Termux `wakeonlan`. Connect to it over Tailscale and wake the PC from there. This ties in with section 4.
  - Tailscale itself cannot wake a sleeping node; it needs a relay node that is awake on the LAN.

Remote sign-in once the PC is awake (from safest/simplest):

1. **Windows RDP over Tailscale.** Windows 10 **Pro** has an RDP host. Install Tailscale on the PC and the client, and RDP to the PC's `100.x` address. Nothing is exposed and there is no port forwarding, so double NAT does not matter.
2. **Chrome Remote Desktop.** Free, works through NAT, PIN-protected, and runs on the user's Google account.
3. **RustDesk.** Open source. Uses a public relay by default, or a self-hosted one.

**Never port-forward 3389 (RDP)**, on either router. It is scanned constantly, and on this double NAT it would need two forwards anyway.

Sources: [ECS FAQ: EuP/ErP and WoL](https://campaign.ecs.com.tw/ECSWebSite/Support/Support_FAQ_Detail/1/74/77) · [Gigabyte/ASUS/MSI WoL BIOS names (Korean guide)](https://yellowit.co.kr/it-review/wol-%ec%84%a4%ec%a0%95-asus-msi-asrock-%ea%b8%b0%ea%b0%80%eb%b0%94%ec%9d%b4%ed%8a%b8-bios-%ec%9b%90%ea%b2%a9-%eb%b6%80%ed%8c%85-wake-on-lan/) · [Biostar FAQ: WoL standby power](https://www.biostar-europe.com/app/en/support/faq_content.php?S_ID=778)

## 4. Old Android phone as a dev box ("briefcase suit")

**Verdict: it cannot mirror this PC. As a pocket SSH terminal with git, Node and a small repo clone, it can work.**

What runs, in practice:

- **Termux from F-Droid (or GitHub)**, never the Play Store build. Mixing sources causes `INSTALL_FAILED_SHARED_USER_INCOMPATIBLE`.
- `pkg install git nodejs openssh` works natively on ARM64. This repo's Node build scripts should run (pure JS), and `git` is fine.
- **Claude Code is the weak spot (2026).** Since about v2.1.113 Claude Code ships a native binary with no Android build. On plain Termux `npm i -g @anthropic-ai/claude-code` installs, but `claude` fails. Workable routes:
  - **proot-distro Ubuntu/Debian**: a glibc userland where the official linux-arm64 installer works, including auto-update. This is the most reliable one.
  - the community shim `ferrumclaudepilgrim/claude-code-android` (patches the binary through glibc-runner). Unofficial.
  - pinning 2.1.112 (the last JS entry point). It never updates, so avoid it.
- **SSH from the PC into the phone**: `sshd` in Termux (port 8022). Over Tailscale it is reachable from anywhere. This is the comfortable way to use it; typing on the phone screen is not.

Limits:

- **ARM64.** No x64 binaries. Portable Chrome/VS Code from `Planner/apps/` will not run. Native npm modules may need a build or fail.
- **RAM.** An old phone has 2–4 GB, shared with Android. Claude Code plus Node plus proot is tight.
- **Android kills background processes.** On Android 12+ the "phantom process killer" kills Termux children. Use `termux-wake-lock`, exempt Termux from battery optimisation and, if needed, turn off the phantom-process limit via adb/developer options.
- **Thermals and battery.** Always-on charging of an old Li-ion **swells** it. Use a charge limiter if the ROM has one (or a smart plug on a timer), keep it out of a case and in open air, and check the back for bulging. A swollen battery is a fire risk; retire the phone if you see one.
- **Storage.** Internal flash is fine for a few repo clones. `termux-setup-storage` exposes shared storage. It is not a backup target for the 32k-file repo plus `Planner/apps/`.
- **Security.** It would hold `.credentials.json`/SSH keys. Use a screen lock, disk encryption (on by default on Android 10+), and **no** Planner `home/`/`data/` copies.

Phone in the router's USB: **charging only.** Neither router supports USB tethering on its stock firmware (OpenWrt can, but there is no reason to). For the network, put the phone on the TP-Link's Wi-Fi instead.

**Good minimal setup:**
1. Termux + Termux:API from F-Droid. `pkg install git nodejs openssh proot-distro`.
2. `proot-distro install ubuntu`, then the official Claude Code installer inside it.
3. Tailscale on the phone and the PC. `sshd` in Termux. Key-only auth.
4. A shallow clone of the repo (no `Planner/apps/`, no `Vendor/`).
5. Bonus role: the phone, always on the TP-Link Wi-Fi, is the **WoL relay** from section 3. That is probably its most useful job.

Sources: [Claude Code in Termux: what works in 2026](https://jonathansblog.co.uk/?p=30143) · [cosyra guide: Claude Code on Android](https://cosyra.com/guides/claude-code-on-android.html) · [ferrumclaudepilgrim/claude-code-android](https://github.com/ferrumclaudepilgrim/claude-code-android) · [its FAQ](https://cdn.jsdelivr.net/gh/ferrumclaudepilgrim/claude-code-android@main/docs/faq.md) · [Issue: native installer vs Termux/Bionic](https://claudeissues.com/issue/20778-bug-native-installer-incompatible-with-termux-android-bionic-libc-but-npm-instal) · [Feature request: linux-arm64-android binary](https://claudeissues.com/issue/72620-feature-publish-linux-arm64-android-native-binary-for-termux) · [Node v24 startup hang in Termux](https://claudeissues.com/issue/23665-claude-code-hangs-on-startup-in-termux-android-with-node-js-v24) · [Medium: Claude Code on Termux (older npm route)](https://medium.com/@ROCKYSHARAF/how-to-run-anthropics-claude-code-on-android-termux-712b79eb3ee7)

## Open facts (only the user can check)

- TL-WR1043ND **hardware version** (sticker: v1/v2/v3/v4) and firmware date.
- BIOS: ErP and Wake-on-LAN settings on the B560M DS3H V2.
- Which old phone (Android version, RAM), and whether its battery is already swollen.
- Whether the ISP (HG8245H) can be put in bridge mode. That would remove the double NAT, but it is an ISP-side change, so it was not touched.
