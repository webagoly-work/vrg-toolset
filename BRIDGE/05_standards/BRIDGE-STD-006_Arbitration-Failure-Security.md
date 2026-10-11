# BRIDGE-STD-006 — Arbitration, Failure and Security Integration

**Doc:** BRIDGE-STD-006 · **r2** · 2026-10-05 · English
**Parent:** BRIDGE-ARCH-002 r1 §12/§14 · BRIDGE-STD-002 §8.3 · BRIDGE-STD-004 §3.8
**Closes:** U3 arbitration · U10 failure-mode matrix · U11 security data model
**Scope:** who wins when two things want different outcomes, what survives each failure, and what
BRIDGE may and may not do with a third-party alarm.

---

## 1. Arbitration (U3)

### 1.0 The arbiter is its own service (G06)

**Decided in r2:** the precedence model below lives in a **small dedicated service, with Home
Assistant as a client** — not in Home Assistant automations.

The reason is that an eight-tier ladder with per-domain hold-off, declared scopes and provenance is
awkward to express in automation conditions, and it degrades badly as it grows: the precedence logic
ends up smeared across dozens of automations where no single place states the rule, and a conflict
between two of them is invisible until it misbehaves. **A tier model needs one place that owns it,
and one place that can be tested.**

What this costs: one more service to run, patch and monitor. What it buys: §1.4's scope rejection
becomes enforceable, §1.6's provenance is recorded once at the point of decision rather than
inferred afterwards, and the whole ladder can be exercised against synthetic inputs without
touching a real light.

Consequence for the build order: **settle this before much automation is written**, because
automations written against the arbiter look different from automations that *are* the arbiter.

### 1.1 The ladder

Eight classes of intent. Highest authority first.

| | Class | Examples | Can be overridden by |
|---|---|---|---|
| **P0** | **Hardware interlock** | shutter up/down interlock, relay creepage separation, the egress latch relay | **nothing** — it is not software |
| **P1** | **Safety automation** | leak → valve, mains loss → egress, life-safety alarm → escape lighting | P0 only, and only while the condition holds |
| **P2** | **Manual physical action** | wall switch, panel press, physical button | P0, P1 |
| **P3** | **Explicit remote command** | app, voice, a message from away | P0–P2 |
| **P4** | **Scene** | a named scene, invoked by a person or a rule | P0–P3 |
| **P5** | **Presence rule** | occupancy-driven change | P0–P4 |
| **P6** | **Schedule / circadian** | the slow background ramp | P0–P5 |
| **P7** | **Optimisation** | pre-heat, tariff shifting, energy trimming | everything |

### 1.2 Why safety sits above manual, and why that is not a contradiction

Manual-first means **the human's physical action always lands on the thing that control
governs.** It does not mean a light switch outranks a gas shut-off. The two mostly act on
different objects and never meet.

Where they do meet — egress lighting forced on while someone tries to switch it off — three rules
keep P1 honest:

1. **Scope.** A safety action may only write to objects within its declared safety scope. A leak in
   the kitchen does not touch bedroom lighting.
2. **Duration.** P1 holds only while the condition persists. It never latches. When the condition
   clears, control returns to P2 and below, and the pre-condition state is *not* restored — the
   person decides what happens next.
3. **Announcement (G10).** A P1 override must say so — **on the nearest panel, on the room's
   notification light, and in the log.** **An override a person cannot explain is worse than no
   override**, and in a safety context it is dangerous: someone fighting a light that will not turn
   off is someone not evacuating.

> **STD-008 is what makes the announcement rule practical.** r1 required the announcement and had
> only panels to make it with — which meant the announcement often happened in a different room from
> the override. A notification light in every room and at every doorway announces it **where it is
> happening**, which is the only place it is any use. No audible chime: G10 chose panel and log, and
> a sounder that fires on every safety event teaches people to ignore it.

### 1.3 Hold-off, per domain

STD-002 §8.3 set a 90-minute hold-off on lighting after a manual action. Generalised — and the
periods differ because the cost of being overruled differs:

| Domain | Hold-off after P2 | Early release |
|---|---|---|
| **Light** | 90 min | room vacant 10 min |
| **Climate / thermostat** | **4 h** | none |
| **Shutters / blinds** | until the next sunrise/sunset event, max 8 h | none |
| **Ventilation** | 2 h | none |
| **Audio** | until the stream stops | — |
| **Access / lock** | **no hold-off** | — |

Climate gets four hours because thermal response is slow and because having a schedule undo a
deliberate adjustment within the hour is the most irritating behaviour an automated house has.
Shutters hold to the next astronomical event: if someone opens a blind, no passing cloud should
close it again. Access takes no hold-off at all — it is a security domain and state is decided per
event, never held.

### 1.4 Conflict inside a tier

- **Every automation declares `(domain, scope, tier)`.** The arbiter **rejects any write outside
  the declared scope.** Most conflicts are prevented structurally rather than resolved.
- Within a tier and scope, **last writer wins**.
- A rule that repeatedly loses arbitration raises a diagnostic. A rule that never wins is almost
  always misconfigured, and silence makes that invisible for months.

### 1.5 Multiple occupants

| Case | Rule |
|---|---|
| **Shared-space object** — living-room light | last manual action wins. No identity needed |
| **Personal object** — a bedroom, a personal scene, a stream | the owner's preference, requiring **T1** identity or better *(STD-003 §4.3)* |
| **Irreconcilable** — two people, one room, different temperatures | **the system does not choose.** It holds the current state and surfaces the conflict on the panel |

That last rule is deliberate. **BRIDGE never arbitrates between people.** It can hold a state and
say that two preferences disagree; deciding is not its business, and a house that silently picks a
winner between two occupants will be resented by one of them.

### 1.6 Provenance — answering "why is this on?"

Every state change records **source tier · actor · timestamp · prior state**. Actor is an identity
reference, `rule:<name>`, or `system`.

This exists because "why did the light just do that?" is the single most common complaint about an
automated house, and it is unanswerable without provenance. Retention **90 days** (G05), and it is a
separate store from STD-003 §4.5's behavioural profile — different purpose, different lifetime, and
**provenance is never an input to identity scoring.** It is recorded by the arbiter of §1.0 at the
point of decision, which is the only place that knows the tier and the actor.

---

## 2. The failure-mode matrix (U10)

ARCH-002 rule 13 promises manual control through the loss of COMP, the network and the CHANNEL.
This is that promise audited, plus the cases the rule does not mention.

| Failure | Manual switching | Automation in the room | Egress light | COMP / house | Detected by |
|---|---|---|---|---|---|
| **Mains loss, whole house** | **dead** — no power to the load at all | dead unless on bus B | **yes, 2 h** | COMP alive on its 12 V UPS | bus B transfer; egress latch fires without COMP |
| **One room's 230 V circuit** | dead in that room | **alive** — sub-controller on the independent PoE path | **only if bus B is central** — see below | unaffected | sub-controller reports its PSU gone |
| **COMP down** | **full function** | **autonomy** — last state held, local rules continue | normal | scenes, schedules, cross-room suspended | pair 3a heartbeat, within 3 s |
| **BRIDGE_LINK cut, one branch** | **full function** | autonomy, **for every node past the cut** | normal | rest of house normal | heartbeat, 3 s |
| **NET switch down** | full function | autonomy for coordination; local rules continue | normal | no panels, no cameras, no Matter/Thread over WiFi | link loss on every port |
| **Internet down** | full function | full function | normal | voice and remote access dead; everything local works | WAN probe |
| **Sub-controller down** | **full function** | **dead in that room** | normal | rest of house normal | poll timeout, or pair 3b |
| **RoomBox PSU failed** | full function *(mains relays are not coil-fed from this rail — verify per §4)* | dead unless PoE-backed | only if bus B is central | unaffected | branch current + sub-controller on PoE |
| **Bus B depleted** | full function | normal | **none** | normal | **monthly self-test**, before it matters |
| **NET PoE failure** | full function | normal — room switch is on local DC *(STD-005 §1)* | normal | sub-controller loses its backup path only | PoE budget alarm |
| **MEDIA down** | full function | normal | normal | no media, no NVR, no behavioural store | reachability |
| **Relay welded closed** | **no effect — load stuck on** | — | normal | — | **commanded state vs measured branch current** |
| **Relay failed open** | no effect — load stuck off | — | normal | — | same |
| **Security panel down** | full function | normal | normal | arm state unknown — treat as unknown, never as disarmed | provider's own fault contact |

### 2.1 Two findings this audit produced

**A central bus B pack is materially better than per-room packs.** If the assured battery sits in
the RoomBox, then a single room's 230 V circuit failure takes out that room's PSU *and* its egress
light — precisely the room where a fault has just occurred and someone may be standing in the dark.
A central pack feeding an assured 24 V bus survives that. This is independent support for **C17 =
B** in the tuner, arrived at from the failure matrix rather than from convenience.

**Welded relays are only detectable because per-branch current monitoring exists.** ARCH-002 §8.5
specifies it; nothing until now said what it was *for*. Comparing commanded state against measured
branch current is the only way a stuck contact is ever noticed, and a stuck lighting contact is
otherwise invisible until someone cannot turn a light off. **Make this comparison a standing check,
not a diagnostic someone runs.**

### 2.2 The one honest limit

**Manual-first does not survive mains loss.** A bistable relay with no supply cannot energise a
load. The doctrine guarantees that no *intelligence* can trap the user — not that the house works
without electricity. Bus B egress lighting is the answer to a blackout; the ζ/η families are the
answer to a failed controller. Conflating the two oversells the design, and the distinction should
be stated plainly wherever manual-first is claimed.

---

## 3. Security integration (U11)

ARCH-002 §12.4 sets the boundary: the system is the provider's property and responsibility,
integration is optional and only via provider-approved isolated interfaces, and **BRIDGE never
touches alarm wiring.** What it does not say is what BRIDGE does with the states it receives.

### 3.1 The interface

| Direction | Permitted | Mechanism |
|---|---|---|
| **Provider → BRIDGE** | `armed_state` (disarmed / away / night / partial) · `alarm` · `alarm_type` · `fault` · `tamper` · zone states *if the provider exposes them* | volt-free contacts, or the panel's own IP module on **VLAN 50** |
| **BRIDGE → provider** | **a request to arm or disarm, nothing more** — and only if the provider enables it | the same provider-sanctioned interface |
| **Never** | zone bypass · siren control · writing to alarm wiring · altering provider configuration | — |

An arm/disarm request requires **T3 identity** (STD-003 §4.3) and the provider's panel decides
whether to honour it. **BRIDGE never decides**, and the provider's own keypad always works
independently of BRIDGE being alive.

### 3.2 What BRIDGE does with each state

| State | BRIDGE response |
|---|---|
| `armed_away` | away profile: lighting off, climate setback, audio off. **Presence expectations invert** — any detection is now notable rather than routine |
| `armed_night` | night profile: egress active, bedroom-local control only, no cross-room automation |
| `armed_partial` | as night, with the unarmed zones behaving normally |
| `disarmed` | normal operation |
| **`alarm`, intrusion** | all internal and external lighting to full · audio stops · panels show the state · **interior doors unchanged, exterior doors stay locked** · log |
| **`alarm`, life-safety** | egress and path lighting to full · audio stops · **escape route unlocked** · ventilation to a safe state · log |
| `fault` / `tamper` | notify and log. **Never act** |
| unreachable | arm state is **unknown**. Never inferred as disarmed |

> **The door policy inverts between alarm types, and this is the single most important line in
> this section.** An intrusion alarm must not unlock anything. A fire must not keep people in.
> A system that treats "alarm" as one state will get one of these catastrophically wrong, so
> `alarm_type` is **mandatory**, not optional — if the provider cannot supply it, BRIDGE takes the
> intrusion behaviour and never unlocks on alarm at all.

### 3.3 Grade

**EN 50131 Grade 2 (G07)** — the normal domestic grade. Revisit only if an insurer requires Grade 3.
Confirm with the provider **before walls close** — ARCH-002 **D9** already says so, and the conduit
and SSC envelope in STD-001 depend on the answer.

**`alarm_type` availability is unknown (G09), so design for both.** The provider is not yet chosen,
and G09's brief was an **adaptive, modular design built against common rulings and standards**.
That is exactly what §3.2's degradation rule delivers: where the type is supplied, the two alarm
branches behave differently; where it is not, **BRIDGE takes the intrusion behaviour and never
unlocks on alarm.** Nothing in the conduit, the SSC envelope or the VLAN depends on which, so the
decision can wait for the provider without holding up first fix. **It must be asked at the same
meeting as the grade**, because a provider who cannot supply the type is also telling you something
about their panel.

### 3.4 Trust boundary

- **BRIDGE presence data is never sent to the provider.** Different trust domain, and occupancy
  history is among the most sensitive data the house holds.
- Provider zone data, where exposed, is consumed **read-only**.
- VLAN 50 has **no route in and no route out** (STD-004 §2.2). COMP reaches the IP module on named
  ports only.
- **BRIDGE's own sensors are not an intrusion detection system.** They may raise notifications;
  they must never be presented as security, must never be relied on as such, and must never appear
  in a document or UI in a way that implies they are. ARCH-002 is already explicit that
  life-safety detection is certified standalone devices; the same discipline applies here.

---

## 4. Commissioning

**Arbitration**

- [ ] Verify every automation declares `(domain, scope, tier)` and that an out-of-scope write is
      **rejected**, not merely logged.
- [ ] Verify each domain's hold-off period and its early-release condition from §1.3.
- [ ] Trigger a P1 safety action and confirm it announces itself on the nearest panel.
- [ ] Confirm a P1 action **releases** when its condition clears and does **not** restore the
      pre-condition state.
- [ ] Create a deliberate two-person conflict and confirm the system holds state and surfaces it
      rather than choosing.
- [ ] Confirm provenance answers "why is this on?" for every domain, naming tier and actor.

**Failure modes** — walk the whole of §2, not a sample.

- [ ] Kill mains: confirm egress fires **without COMP**, and that COMP rides its UPS.
- [ ] Kill one room's 230 V circuit: confirm the sub-controller stays alive on PoE and **reports
      the PSU loss**.
- [ ] Kill COMP: confirm manual works, autonomy engages within 3 s, and panels show
      "local control only" rather than a blank screen or a spinner.
- [ ] Cut BRIDGE_LINK mid-branch: confirm **every** node past the cut enters autonomy, and that
      nodes before it are unaffected.
- [ ] Pull NET PoE: confirm the room switch **does not** drop (STD-005 §1).
- [ ] Simulate a welded relay — command off with the branch still drawing current — and confirm a
      fault is raised **by the standing check**, not by someone noticing.
- [ ] Depleted bus B: confirm the self-test flags it before an outage does.
- [ ] Take the security panel offline: confirm arm state reads **unknown**, never `disarmed`.

**Security**

- [ ] Verify VLAN 50 has no route in or out, by test rather than by configuration review.
- [ ] Verify no BRIDGE presence or occupancy data egresses to the provider interface.
- [ ] Verify an arm/disarm request requires T3 and that the panel can refuse it.
- [ ] Verify the provider's keypad works with COMP powered down.
- [ ] **Verify both alarm branches separately**: intrusion leaves exterior doors locked;
      life-safety unlocks the escape route. If `alarm_type` is unavailable, verify the system
      takes the intrusion behaviour.

---

## 5. Open items

| Ref | Open |
|---|---|
| **D9** | SSC position and the provider's requirements, including whether `alarm_type` can be supplied (G09). §3.2 degrades safely without it, but degraded |
| **D1** | Room list — safety scopes in §1.2 are defined per room and cannot be written without it |
| **U22** | P33 hardware composition — `P33-BUILD-001`, the first real test of 001–008 |
| — | The arbiter service itself: §1.0 settles *that* it is a service, not what it is written in or how HA subscribes to it |
| — | §2's matrix is reasoned, not tested. **G11 requires walking all of it**, not a sample, and every row becomes a real claim only then |

**Closed in r2:** G01 G02 G03 G04 G05 G06 G07 G08 G09 G10 G11 · **U7** by STD-007 §1–3 · the
arbiter's home by G06 (§1.0) · the announcement medium by STD-008 (§1.2).
