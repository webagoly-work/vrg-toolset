# Homeland concept pack (working name: Gépország)

A new node of Kódváros beside the Város view: this desktop PC as a living city-state, its hardware the land, Windows the
state, programs the economy, data the cargo. The request and the rules are in
[`../HOMELAND-BRIEF.md`](../HOMELAND-BRIEF.md). Kódváros follows later and is out of scope.

**Status 2026-10-31: concept pack delivered, waiting for the user's decisions.** No product code is built yet.

| File | What |
|---|---|
| [concept-sheet.png](concept-sheet.png) | One picture: the island, the layers, the archetypes ([HTML source](concept-sheet.html)) |
| [01-topology.md](01-topology.md) | Every PC part and software class mapped to a place, building or unit, with reasons |
| [02-layers-signals.md](02-layers-signals.md) | The five layers, and how each live signal drives the city |
| [03-truth.md](03-truth.md) | Measured, approximate or metaphor, checked on this PC; memory; the ETW finding |
| [04-data-feed.md](04-data-feed.md) | What TMOG is, sources compared, the adapter design, how a node is built |
| [05-options.md](05-options.md) | The long list of further options, with effort |
| [06-decisions.md](06-decisions.md) | CITY-D34…D49, for the user |

## The main results

- **The street plan is this board's real wiring,** and the ground/underground split is the kernel's own session number.
  Neither is an invented rule.
- **TMOG is Task Manager OG** by Dave Plummer. It is closed source, has no plugin surface we could find and does not
  officially support Windows 10, so it stays inspiration. The feed extends `vrg-probe.exe`.
- **The native process snapshot takes 6–7 ms** here, for all 415 processes without elevation. The same data through WMI
  takes 558 ms, so a 1 Hz feed is cheap only in the C# sidecar.
- **Which physical RAM a process touches** is not a useful truth, and the access itself cannot be read at all. The market
  shows the real mix and real stall sizes on schematic lots, and the true address space goes in a per-program panel.
- **ETW is off today,** for two reasons found here: a broken task action and an old repo path in the installed binary.
  Fixing it is the user's step; Homeland runs without it.
- **A "node" is a fourth entry in `VIEWS`** (`CodeCity/src/39-views.js`), and Erőmű on the Land becomes its door.
