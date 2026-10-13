# EXPLORE-002 — BRIDGE Remote Service Card (Szervizkártya)

*Quick deep dive, 2026-10-12/13. Nothing decided or built. Companion to
`EXPLORE-001_mapper-deck-control.md`.*

---

## 1. The idea
A module the client plugs in that opens a private connection to a device of mine, so that I am on
their network **as if I had driven there and plugged my laptop in** — my likely next step anyway when
a phone call does not solve it. Because the access is a physical object, the client holds the
control over my control: **pull the card and I am out.**

**Verdict: sound, worth developing.** The nearest existing product is **Tosibox** (industrial remote
access built on a physical key + "lock" box), which proves the concept. The BRIDGE angle — consent
that is visible inside the system — is a real difference.

## 2. What "as if I were there" actually needs

| Level | Gives | Does not give | How |
|---|---|---|---|
| **L3 routed** | every IP on their LAN: HA, ESPHome, router admin, cameras | mDNS / broadcast discovery, my own DHCP lease | WireGuard or Tailscale subnet router |
| **L2 bridged** | truly on the LAN: DHCP lease, discovery, mDNS | simplicity — heavier, leaks more traffic | ZeroTier bridging, WireGuard + GRETAP/VXLAN |

**Recommendation:** L3 + an mDNS reflector (avahi on the card) covers ~90 %; L2 as an optional mode.

The jobs that really force a drive are often **radio or physical**, not network: reflash an ESP over
USB, BLE provisioning, Zigbee re-pair, power-cycle a hung box. So the card should be **remote hands**,
not only a tunnel:
- USB serial console to the BASE,
- an ESP32 radio for BLE / ESP-NOW,
- optionally a Zigbee/Thread dongle,
- one relay to power-cycle a single named device.

## 3. Architecture

```
my laptop / field device ──WireGuard──► my hub (VPS or own home server)
                                            ▲  outbound only: works behind CGNAT,
                                            │  no port forwarding at the client
client LAN ── [ Service Card ] ─────────────┘
               Linux core (OpenWrt) + ESP consent controller + optional LTE
```

- **Core = small Linux box.** An ESP32 can run a WireGuard client but cannot route or bridge a LAN
  properly. BuildTree order tab: GL.iNet mini router (`o_glinet`).
- **GL.iNet travel routers have a hardware toggle switch that can be bound to the VPN.** The bare
  MVP is nearly off-the-shelf: GL.iNet + WireGuard + that switch + a BRIDGE enclosure.
- **Consent controller = owned parts.** ETH01-EVO or a C3 Zero drives a button, an STD-008-style
  LED ring and the PN532 (NFC), and gates the core's VPN or power.
- **LTE fallback** (SIM7600, `o_lte`): "their internet is down" is one of the likeliest reasons for
  the call, and a card that depends on their internet fails exactly then.

## 4. Consent model

"Unplug = out" is clear and trustworthy. Its weak side: a card left in for months is **standing
access nobody remembers**. So:

- **Card inserted = available. Button press (or BRIDGE panel / HA toggle) = session window**, closing
  by itself after e.g. 4 h or when I end it.
- **Visible while active:** own colour in the STD-008 alphabet on the card and the panels, plus a
  phone notification to the client on connect and disconnect.
- **Session log** readable by the client — it protects me as much as them.
- **Unplugging always works as the hard kill**; the physical promise stays intact.

## 5. Security — this is a door into someone's home

- **Scope:** firewall the card to the BRIDGE/IoT segment (STD-005), not the family's laptops and
  phones. Make it a written promise, not only a setting.
- **One direction:** I can reach the card; the card can never reach my hub, my network or other
  clients.
- **One key per client, revocable on the hub.** A stolen card is useless after one revocation.
- **My side is the real risk:** one compromised laptop or hub = every client's home. Hardware-key
  2FA, a dedicated service profile/VM, a minimal hub.
- **GDPR:** with cameras / an NVR on their LAN I become a data processor. A short service agreement
  in the BRIDGE handover: scope, logging, per-session consent, data-processing clause.

## 6. Form factors

| Form | For | Against |
|---|---|---|
| **Standalone box at the router** (+ LTE) | works when BASE or the internet is the problem | one more device |
| **DIN module in the BRIDGE cabinet, key slot on the front** | fits the STD-001 DIN language; reads like a real key switch | the client rarely looks there — LED and notifications matter more |
| **Key only (USB/NFC), BASE runs the VPN** | cheapest, elegant | fails when BASE is the broken thing — not as the only path |

## 7. MVP path

1. GL.iNet + WireGuard to my own hub + toggle switch — test on my own home first.
2. ESP consent controller: button, LED ring, NFC, timed sessions, client notification via HA.
3. Remote hands: USB serial to BASE, BLE/ESP-NOW radio, one power-cycle relay.
4. LTE fallback and the DIN-rail version.

## 8. Open questions

- **Q1. Who owns the access?** My hub (I revoke) — or also the client in an app beyond unplugging
  (e.g. Tailscale node sharing, where the client can remove me)?
- **Q2. BRIDGE homes only, or non-BRIDGE clients too?** Without BRIDGE there is no panel or LED
  alphabet, so the card must carry the whole consent UX itself.
- **Q3. Where does my hub live:** a cheap VPS, or my own home server (open question 3 of the
  2026-10-07 BRIDGE notes)?
