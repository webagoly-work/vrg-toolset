# VRG Containment (Karantén VM)

Eldobható, elszigetelt gép egy kattintásra, gyanús dolgokhoz: ügyféltől kapott fájl, ismeretlen link,
kipróbálandó program. Bezáráskor minden, ami benne történt, eltűnik. Két változat, ugyanazokkal a profilokkal:

| | **SANDBOX** (ezen a gépen) | **STICK** (pendrive-ról) |
|---|---|---|
| Mi fut | Windows Sandbox: friss, tiszta Windows | hordozható QEMU + Debian Live (Firefox, LibreOffice, PDF) |
| Kell hozzá | Windows 10 21H2+ / 11 **Pro, Enterprise, Education**, a funkció bekapcsolva | bármely 64 bites Windows 10/11, **Home is**; nincs telepítés |
| Gyorsaság | gyors | gyors, ha a *Windows Hypervisor Platform* be van kapcsolva, nélküle lassú |
| Bemenet (inbox) | csak olvasható mappa: `C:\Containment\inbox` | csak olvasható USB meghajtó a vendégben (max. ~480 MB) |
| Kimenet (outbox) | írható mappa: `C:\Containment\outbox` | nincs: a VM-ből semmi nem jön ki |
| Helyigény | 0 | kb. 4 GB (`runtime\`) |

A kit egy mappa. A repóban is fut, de átmásolható pendrive-ra (menü **P**), és ott ugyanúgy működik mindkét mód.

## Gyors indulás

1. **CONTAIN.cmd**: a menü. Az **S** megmutatja, mi működik ezen a gépen, és ha valami nem, miért nem.
2. SANDBOX módhoz egyszer: **E** (rendszergazda, utána újraindítás).
3. STICK módhoz egyszer: **F** letölti és ellenőrzi a QEMU-t és a Debian Live-ot (kb. 4 GB),
   a **H** bekapcsolja a Hypervisor Platformot (rendszergazda, újraindítás), ettől lesz gyors.
4. **Gyanús fájl**: húzd a fájlt a **SANDBOX.cmd** (vagy a **STICK.cmd**) ikonjára. A kit lemásolja az
   `exchange\inbox\<időbélyeg>\` mappába, és csak ezt a másolatot látja a gép, csak olvasásra. Az eredetit soha.

Parancssorból: `SANDBOX.cmd browse`, `STICK.cmd quarantine D:\letoltes\szamla.zip`, `SANDBOX.cmd ajanlat.pdf -Open`
(az `-Open` a fájlt rögtön meg is nyitja a Sandboxban; nélküle az Intéző mutatja).

## Profilok (`profiles.json`)

| Profil | Hálózat | Vágólap | Bemenet | Mire |
|---|---|---|---|---|
| `quarantine` (Karantén, alap) | nincs | nincs | van, csak olvasható | gyanús fájl megnyitása |
| `browse` (Böngészés) | van (NAT) | nincs | nincs | gyanús link, letöltés megnézése |
| `offline` (Offline munka) | nincs | van | van, csak olvasható | ismeretlen program kipróbálása |

Új profil: új bejegyzés a `profiles.json`-ban (legfeljebb 4). A mezőket a `test\check.js` ellenőrzi.

## Indítás a Windows-szal

A menü **A** pontja a Windows Indítópult mappájába tesz egy kis `VRG Containment.cmd`-t: bejelentkezéskor megnyílik
a választott profil Sandboxa. Ugyanez a gomb kapcsolja ki. Pendrive-on lévő kitnél csak akkor indul, ha a pendrive
bent van, ugyanazon a meghajtóbetűn.

## Mi lép át a határon, és mi nem

- **Be**: csak az, amit átadsz (inbox), csak olvasásra.
- **Ki**: SANDBOX módban az `exchange\outbox`. Ami ott van, a gyanús gépből jött: **ne futtasd** a gazdagépen.
  STICK módban nincs kimenet.
- **Hálózat**: a `browse` profil NAT-on át internetet kap. A vendég ilyenkor a helyi hálózatot (routert, NAS-t) is
  eléri, mindkét módban. Ügyfélhálózaton ezért a `quarantine` az alap.
- **Vágólap**: csak az `offline` profilban, és csak SANDBOX módban. STICK módban soha.
- A virtuális gép erős határ, de nem tökéletes: tartsd frissen a Windowst és a kitet (menü **F** újra).

## Ellenőrzés és források

- A letöltések forrása a `sources.json`: a QEMU for Windows (Stefan Weil buildje, `qemu.weilnetz.de`), és a
  Debian Live XFCE (`cdimage.debian.org`). Alapból a legújabbat veszi, a `pin` mezővel rögzíthető egy URL.
- A QEMU telepítőt a mellette közzétett **SHA-512**-vel és az **Authenticode aláírással** ellenőrzi. Ha egyik sincs,
  nem használja (csak `-AllowUnsigned`-del, kézi ellenőrzés után). A Debian ISO-t a hivatalos `SHA256SUMS` alapján.
- A kicsomagoláshoz 7-Zip kell (`Full\programs\7zip`, Program Files vagy PATH); ha nincs, a QEMU saját telepítője fut
  a kit mappájába.
- A `runtime\manifest.json` és a `runtime\qemu.sha256` rögzíti, mit töltött le. A **V** (integritás-ellenőrzés)
  újraszámolja: idegen gépen használt pendrive után érdemes.
- Saját lemezkép (pl. a saját, jogtiszta Windowsod): `STICK.cmd -Disk D:\vm\win.vhdx`. Mindig pillanatképpel fut,
  a kép nem változik.

## Fájlok

| | |
|---|---|
| `CONTAIN.cmd` | a menü |
| `SANDBOX.cmd`, `STICK.cmd` | a két mód közvetlenül; ráhúzható fájl vagy mappa |
| `profiles.json`, `sources.json` | profilok és letöltési források (`{ format, version }`) |
| `core\contain.ps1` | parancssor és menü; `core\contain-lib.ps1` a működés |
| `exchange\inbox`, `exchange\outbox` | a csere mappák (gitben nincsenek) |
| `runtime\` | QEMU, a vendég ISO, a hash-ek, a munkamenetek `.wsb` / parancssor fájljai (gitben nincs) |
| `test\check.js` | `node Containment/test/check.js` (bárhol fut) |
| `test\selftest.ps1` | `powershell -NoProfile -ExecutionPolicy Bypass -File Containment\test\selftest.ps1` (Windows, offline, ideiglenes mappában) |

---

## English

A disposable, isolated machine on demand, for untrusted things: a client's file, a link, an unknown program. Closing it
throws away everything that happened inside. Two modes share the same profiles:

- **SANDBOX** uses Windows Sandbox on the host. Needs Windows 10 21H2+ / 11 Pro, Enterprise or Education with the feature
  on (menu **E**). It's fast, and you get a fresh Windows every time. The inbox is mapped read-only, the outbox writable.
- **STICK** uses a portable QEMU with a Debian Live ISO (Firefox, LibreOffice, a PDF viewer). It runs from the folder
  or a USB stick with nothing installed, Home edition included. It's fast with Windows Hypervisor Platform
  (menu **H**) and slow without it. The inbox appears as a read-only USB drive (about 480 MB at most), and there is no
  outbox: nothing comes out.

Drop a file on `SANDBOX.cmd` or `STICK.cmd`: it is copied to `exchange\inbox\<stamp>\` and only that copy is shown to
the machine, read-only. Menu **F** downloads the stick runtime and verifies it: the QEMU installer against its published
SHA-512 and its Authenticode signature, the ISO against Debian's `SHA256SUMS`. **V** re-hashes it later. **P** copies
the kit to a stick and verifies the copy. **A** opens a chosen sandbox at every sign-in.

Caveats: with the `browse` profile the guest can reach the local network as well as the internet. Files in the outbox
came from the untrusted machine. A VM is a strong boundary but not a perfect one, so keep Windows and the runtime
updated.

The working logic was extracted from ServiceKit's built-in "Windows Sandbox" launcher (`ServiceKit/core/server.ps1`).
ServiceKit keeps its own copy, because it is deployed on its own from a public branch.
