# BRIDGE Smart Home System — forrásfájl-gyűjtő mappa

**Létrehozva:** 2026-09-21 · **Alap:** BRIDGE-ARCH-002 r1, A. függelék (forrásfájl-leltár)
**Cél:** minden eddigi BRIDGE / OmniComm / VRG anyag egy helyen, mielőtt egyetlen
*BRIDGE System Reference* dokumentummá olvasztjuk őket.

A fájlok **másolatok** — az eredetiek érintetlenül a helyükön maradtak
(`C:\Users\webag\Downloads`, OneDrive `VARLER Documents-`, `Vault MD`,
`VARLERONLINE\Projects`, `H:\Dev-VRG\VRG-DE\_inbox`).

## Mappaszerkezet

| Mappa | Tartalom |
|---|---|
| `01_architecture/` | BRIDGE architektúra és kapcsolás |
| `02_bridge-dn/` | BRIDGE-DN (DIN-sínes hub) |
| `03_omnicomm-hub/` | OmniComm Hub (CM5), rajzok, `_datasheets/` |
| `04_related-hardware/` | kapcsolódó hardvervonalak és eszközök (referencia) |
| `_source-variants/` | régebbi/duplikált változatok, `.bak` fájlok |

---

## A. függelék — leltár kipipálva

### BRIDGE architektúra és kapcsolás
- [x] `BRIDGE-ARCH-001` **r2** — egységflotta-alapozó → `01_architecture/BRIDGE-ARCH-001_unit-fleet-primer.md` (+ `.pdf`)
- [x] `BRIDGE-ARCH-A1_parallel-control-topologies.md` → `01_architecture/` (+ `BRIDGE-ARCH-A1_diagrams.svg`)
- [~] `BRIDGE_Smart-Switch.md` + **hét** SVG ábra → a `.md` megvan, de csak **három** SVG létezik:
      `_gate-figures.svg`, `_peer-figures.svg`, `_peer-figures-2.svg`.
      A hiányzó négy ábra sehol nem található a gépen. *(Az `ARCH-A1_diagrams.svg` külön dokumentum ábrája.)*
- [x] `BRIDGE_Project_Planner_Digest.md` → `01_architecture/`
- [x] `CLA_BRIDGE_Inline_Architecture.md` → `01_architecture/`
- [x] Magyar jegyzet a gyengeáramú szobai központi dobozról → `01_architecture/RoomBox_synopsys.md` (+ `.pdf`)
- [ ] `BRIDGE-ARCH-002_Foundational-Architecture-Plan.md` — **az angol eredeti NINCS meg a gépen.**
      Csak a magyar változat van meg. Ha volt, csak beszélgetésben létezik — exportálni kell.
- [x] `BRIDGE-ARCH-002_Alapozo-Architektura-Terv_HU.md` → `01_architecture/`
- [+] Ráadás: `BRIDGE_SELV_Telepitesi_Standard.docx` (a leltárban nem szerepel, de ide tartozik)

### BRIDGE-DN (DIN-sínes hub)
- [~] `BRIDGE_DN_Protocol_Reference.html` — ilyen nevű fájl nincs; a legjobb megfelelője
      `02_bridge-dn/protocol_buildup_BRIDGE.pdf`
- [~] `BRIDGE_DN_Core_Hardware.md` — ilyen nevű fájl nincs; megfelelője
      `02_bridge-dn/harware_buildup_BRIDGE.pdf` *(elgépelt eredeti fájlnév)*
- [ ] `BRIDGE_DN_Balanced_DNE_DNU.md` — **nem található** sehol a gépen
- [x] `BRIDGE_DN_Build_Diagrams.html` → `02_bridge-dn/B_DN_Build_Diagrams_BRIDGE.html` (+ `build_diagrams_BRIDGE.pdf`)
- [+] Ráadás: `BRIDGE_DN_Elosztoszekreny.md` + V1/V2 SVG, `elosztoszekreny_mistral48_v1_v2.html`,
      `sensor_buildup_BRIDGE.pdf`

### OmniComm Hub (CM5)
- [x] `OmniComm_Hub_Build_Spec_1.xlsx` → `03_omnicomm-hub/` (+ `OMNI_Hub_overview.xlsx`)
- [x] `omnicomm_spectrum_1.html` → `03_omnicomm-hub/` (+ `omnicomm_spectrum4.html`, `omnicomm_radio_spectrum.svg`)
- [x] `full_system_connection_chain.png` → `03_omnicomm-hub/` (PNG + SVG)
- [x] `network_core_topology.png` → `03_omnicomm-hub/` (PNG + SVG)
- [x] `ups_bms_power_wiring_lrs35_to_distribution.png` → `03_omnicomm-hub/` (PNG + SVG)
- [x] `Waveshare_CM5_Dual_Ethernet_4G_5G_Base_Board.pdf` → `03_omnicomm-hub/_datasheets/`
- [+] Ráadás: `OMNICOMM2.sxe`, `CM5_USB2_HUB.sxe`, `rpi5_board.dpdraw/.dxf`, `CM5 IO Board KiCAD/`,
      valamint CM5 IO / RPi5 / SC1676 / LoRa adatlapok a `_datasheets/` mappában

### Kapcsolódó hardvervonalak és eszközök (referencia, nem BRIDGE-mag)
- [x] `esp32_szenzor_lista_2026-05-13.txt` → `04_related-hardware/`
- [x] `espblok-builder.html` → `04_related-hardware/`
- [x] `VRG_MASTERPLAN.md`, `VRG-BuildTree-HANDOFF.md`, `vrg-buildtree.html` → `04_related-hardware/`
- [x] `varler-field-device-summary.md` → `04_related-hardware/`
- [ ] `VAULT-buildtree-entry.md` — **nem található**
- [ ] `vault-buildtree-snippet.js` — **nem található**
- [ ] `HID-DECK-concept.md` — **nem található**
- [+] Ráadás: `smart_home_sensors.html`, `presence-sensing-building-blocks-v1.md`

---

## Hiányzó fájlok — teendő

Öt tétel nincs meg a gépen; ezeket beszélgetésből kell visszaexportálni:

1. `BRIDGE-ARCH-002_Foundational-Architecture-Plan.md` (angol eredeti — a HU változat szerint ez a mérvadó nyelv)
2. `BRIDGE_DN_Balanced_DNE_DNU.md`
3. `VAULT-buildtree-entry.md`
4. `vault-buildtree-snippet.js`
5. `HID-DECK-concept.md`

Továbbá a `BRIDGE_Smart-Switch` hét ábrájából **négy** hiányzik.

Jelölés: `[x]` megvan · `[~]` más néven/formátumban van meg · `[ ]` hiányzik · `[+]` ráadás, a leltárban nem szerepelt
