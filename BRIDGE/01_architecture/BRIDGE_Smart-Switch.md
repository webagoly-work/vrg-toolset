# BRIDGE — Smart Switch

**Doc:** BRIDGE Smart Switch / r1 · DRAFT · 2026-05-27 · *(supersedes ARCH-A1 "Parallel Control Topologies")*
**Parent:** BRIDGE-ARCH-001 §5 (Control Doctrine).
**Figures:** `BRIDGE_Smart-Switch_peer-figures.svg` (Peer Switch — Dual & Single).

---

## 1. Foundation

A **Smart Switch** adds wireless control to a load while keeping the human's physical action authoritative. You cannot do this with two actors wired directly to one load:

- RF in **parallel** with the manual switch can only **add** power — never remove it.
- RF in **series** can only **subtract** power — and can block the manual.

So every Smart Switch routes the load through a **bistable memory element** (a changeover/impulse/cross relay, or its firmware equivalent). The load follows the memory; both manual and RF feed the memory. "Manual-first" then means two things: **(a) every manual transition is guaranteed to land, and (b) on loss of the wireless part, the circuit degrades to a clean manual state.**

The two families sit on one axis — *how much authority RF holds relative to the manual control:*

| Family | RF authority | Defining behaviour |
|---|---|---|
| **Smart Peer Switch** | Full peer | RF is constantly powered and toggles as an equal alongside manual. Last actor wins; manual edges always land. |
| **Smart Gate Switch** | Gated | A manual switch governs whether RF has any authority at all. The gate's OFF state guarantees a defined fallback. |

---

## 2. Smart Peer Switch

**Shared principle.** The RF actuator's coil is **always powered from the Shadow tap** (independent of the load's switched state), so it can act from any state ("close-to-equal" reach). It is wired into the *traveller path* of a two-way / multi-point circuit as a changeover or cross element. Every actor — each manual switch and each RF unit — is an equal peer toggle. On RF power loss, the relay rests to a contact that leaves the manual switch(es) in control.

> Mental model: a switch's physical position need not equal the lamp state — **the lamp itself is the indicator**, exactly as in any staircase circuit. (If position-truth matters more than invisibility, use the Gate family or a firmware sense-relay instead.)

### 2.1 Peer Switch — Single  *(figure: Peer — Single)*
- **Build:** 1 manual changeover (106) + 1 RF SPDT **changeover** relay wired as the companion switch of a two-way circuit. `L → 106 → traveller pair → RF changeover → lamp → N`.
- **Peers:** manual flip toggles; RF toggles. 2 peers, no cross needed.
- **Fail-safe:** RF rests on its N.C. contact → the manual 106 acts as a plain on/off switch.
- **Use:** the common case — a room with one wall switch plus wireless.
- **Note:** the RF unit must be a true **changeover (SPDT / "2-way / 3-wire")** device, not a plain on/off relay.

### 2.2 Peer Switch — Dual  *(figure: Peer — Dual)*
- **Build:** 2 manual changeovers (106) + RF wired as the **cross (107)** between them. `L → 106 → travellers → RF cross (DPDT) → travellers → 106 → lamp → N`.
- **Peers:** 3 — either manual switch or the RF cross toggles the lamp.
- **Fail-safe:** RF rests **straight-through** → degrades to an ordinary two-switch staircase.
- **Use:** a room that already wants two manual control points (staircase) plus wireless.
- **Where the RF unit lives:** mid-run / at a junction between the two switches — handy when the Shadow tap is not at either switch or the lamp.

### 2.3 Peer Switch — Multi
- **Build:** a standard multi-point group (two end 106s + one or more middle 107 crosses) with **RF added as one further cross (107)** inserted anywhere in the traveller chain.
- **Peers:** all manual points + RF, each an equal toggle.
- **Fail-safe:** the RF cross rests straight → the manual multi-point group continues unaffected.
- **Use:** hallways / stairwells / large rooms with several wall switches plus wireless.

### 2.4 Peer Switch — Cross
- **Build:** **one** manual changeover (106) at the supply end + **multiple wireless systems each wired as a cross (107)** in the traveller pair, with the chain terminated by a wireless changeover (106) at the lamp end.
- **Peers:** one physical switch + N independent wireless peers (e.g. HA-over-RF, a standalone Zigbee controller, a presence-sensor system) — each can toggle the lamp co-equally.
- **Fail-safe:** any wireless cross that loses power rests straight; control survives through the remaining peers and the manual switch.
- **Use:** multi-protocol redundancy, or several independent automation systems sharing one lamp with a single manual control.

### 2.5 Peer Switch — End
- **Build:** the manual side is a normal control group (an end 106 plus any crosses), and the **RF changeover (106) is the terminal element nearest the lamp** — i.e. wired as the *end* switch rather than a mid-chain cross.
- **Peers:** all manual points + RF.
- **Fail-safe:** RF rests on its N.C. contact → the manual group controls the lamp.
- **Why "End" vs "Dual":** placement. As the terminal changeover, the **RF unit directly handles the lamp's final feed** — so it can sit in the luminaire / ceiling rose and can meter actual lamp power. Choose this when the Shadow tap is at the lamp rather than the switch.

---

## 3. Smart Gate Switch

**Shared principle.** A manual switch governs **whether RF has authority** over the circuit. Unlike the Peer family (RF always live), here the gate's OFF position cuts the wireless part and forces a defined, manual-guaranteed fallback. This is the most conservative reading of manual-first.

### 3.1 Gate Switch  *(for power sockets)*
- **Purpose:** RF control of a power **socket**, with a manual gate. The protected guarantee for a socket is **"stays live"**, not "switches off" — cutting a socket could disrupt whatever is plugged in.
- **Behaviour:**
  - **Gate OFF →** RF controller disabled **and** the socket is fed live directly (bypassing the RF relay). The outlet behaves as a plain, always-live socket.
  - **Gate ON →** the socket feed runs through the RF relay (RF now controls the socket) and the RF unit is powered.
- **Build:** a changeover/2-pole gate that, in OFF, routes a **direct live bypass** to the socket while removing power from the RF unit; in ON, routes the feed through the RF relay contact and powers the RF unit. Use an N.C. relay so an enabled-but-idle socket defaults live (RF acts to switch *off*); use N.O. if the socket should default off until RF commands on.
- **Manual-first:** the user can always revert the socket to dumb-live; RF can never hold a socket off against the gate.

### 3.2 Smart Cut Switch  *(manual-only fallback for a Peer circuit)*
- **Purpose:** a manual "kill the smarts" switch — **one additional physical switch mounted underneath / behind a Peer Switch — Single**, in series with the **power feed to the wireless elements only** (the RF relay coil + ESP, fed from the Shadow tap).
- **Behaviour:**
  - **Cut OFF →** the wireless parts are depowered → the Peer relay rests to its N.C. fail-safe → the circuit becomes **manual-only** (the Peer manual switch drives the lamp through the relay's rest contact).
  - **Cut ON →** wireless restored → full Peer behaviour.
- **In effect:** a discreet, user-operable trigger of the Peer Single fail-safe — a physical guarantee of manual-only operation for maintenance, troubleshooting, or "leave it alone" periods.
- **Distinction from Gate Switch:** the Gate Switch is for sockets (keeps the load **live**, gates RF authority); the Cut Switch is for Peer lamp circuits (cuts wireless **power**, forcing the manual-only fallback). Both gate the wireless rather than the load.

---

## 4. Selection Guide

| Situation | Use |
|---|---|
| One wall switch + wireless on a lamp | **Peer — Single** |
| Existing two-point staircase + wireless | **Peer — Dual** |
| Several wall switches + wireless | **Peer — Multi** |
| One switch, several independent wireless systems | **Peer — Cross** |
| RF unit must live at the luminaire / meter lamp power | **Peer — End** |
| RF control of an outlet that must never be cut by automation | **Gate Switch** |
| A physical "force manual-only" override on a Peer lamp | **Smart Cut Switch** |
| Outlet/lamp where automation may act only with explicit per-moment consent | *(consider an HOA-style 3-position selector — bridges Peer↔Gate)* |

---

## 5. Open Items
- Diagrams still to draw: **Multi, Cross, End, Gate Switch, Smart Cut Switch** (only Peer Dual & Single are figured so far).
- Per-fixture **rest-state policy** (which relay contact is N.C.) — i.e. which state survives a wireless power loss. Default per room/fixture.
- Gate Switch **default-state** (N.C. vs N.O.) per socket — live-by-default vs off-by-default.
- Confirm the bistable element's physical home: the Shadow space adjacent to the load's switch (Peer Dual/Single/Multi/Cross) vs at the luminaire (Peer End).
