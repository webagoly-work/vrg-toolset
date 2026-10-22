# Starter prompt for a fresh session

Paste the block below. Swap the **First task** line for whichever of the follow-ups you want.

---

```
You're picking up BRIDGE — a home-automation architecture documented to buildable
depth across nine standards. It is far enough along that re-deriving any of it
would waste a great deal of context.

Read this first, and nothing else until you have:

  H:\Dev-VRG\VRG-DE\Planner_VRG_U100\BRIDGE\BRIDGE-PRIMER-001_Session-Handover.md

It names the three files worth reading, says explicitly what NOT to read, and
carries the state, the open items, the findings and how I work. Follow it rather
than exploring.

Three things to hold onto:
- Work in H:\Dev-VRG\VRG-DE\Planner_VRG_U100. H:\Planner_VRG_U100 is a backup,
  not a second workspace — we mixed those up once and it cost a session.
- 188 design questions are answered and recorded by ID. Don't re-ask them. If you
  want to know why something is as it is, _build/BRIDGE-E-002_open-items-briefing.md
  explains nineteen of them at length.
- Keep the "Bernard" register the primer describes in §5.

First task: close the last three gaps in the room schedule — the upper floor
(two bedrooms and a small hall: areas, lamp counts, and whether RBX04 really is
a terminal node), R07 SZOBA's shared wall (served from RBX01 or RBX02), and the
BASE arrangement (G04/G05, one unit or split). Ask me, don't guess. Those three
are what stand between us and CLA-BUILD-001.
```

---

## The follow-ups, ranked

| | Task | Why now |
|---|---|---|
| **1** | **Close the last three D1 gaps** — upper floor, R07's shared wall, BASE arrangement | A short exchange. They are the only thing blocking the first build document |
| **2** | **Write `CLA-BUILD-001`** — the hardware composition | The first real test of all eight standards against an actual building. Errors surface here or they surface on site |
| **3** | **The G06 wall-construction visuals** | Explicitly asked for and still owed. Unblocks chase depth, the cross-vent and the 110 mm envelope |
| **4** | **Fill `06_reference-images/`** | Unblocks five lighting items at once — C23, C23B, C10, C11, C13. `_bad-examples/` is the folder that actually decides them |
| **5** | **Unify the indicator language** | Notification light, Site Pager, follow pendant and HID DECK are four projects converging on four RGBW indicators. STD-008 §2 has the vocabulary; settle it before any is built |
| **6** | **The three Planner features** — renumber hard-block (E02), conduit and cable schedule (B28), as-built photo store (A07) | The tooling the whole method leans on. Without them the schedules live nowhere |

**Deliberately not on the list:** the Hungarian parallel translation (A03 — real, large, no hurry),
the offline archive and AI agent (the user deferred it), and `bridge-fx-core-01-spec.html`
(an optional alternative design, not in use).

**One item that is a measurement, not a conversation:** H10, where the Snapcast server runs. Run a
worst-case transcode alongside multi-room audio and listen. Do not decide it on paper.
