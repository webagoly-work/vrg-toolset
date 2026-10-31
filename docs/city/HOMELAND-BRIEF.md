Design and start building **Computer Homeland**, a new node in Kódváros (`CodeCity/`) beside the existing Város view. Kódváros shows the git repo as a city; Homeland shows the user's own working desktop PC as a living city-state: hardware, firmware and all software processes, live. Homeland only for now. Bringing Kódváros up to the same level comes later and is out of scope.

## Background

The user builds a Hungarian-UI toolset of single-file HTML apps for electrical planning in the private repo webagoly-work/vrg-toolset. Kódváros (`CodeCity/`) is its live 3D workspace showing the codebase as a city, with work packages C1–C10 and KV-01…KV-27 done, plus a local companion server that already samples the PC. The user's working machine is a Windows 10 desktop, and this is the PC Homeland visualises. This session runs on it, in the main checkout `H:\VRG\Full\Planner_VRG_U100`, branch `main`, like the other GO sessions. The user asked for this as a separate session and wants the concept worked out before heavy building, with Homeland finished first and Kódváros upgraded from it later.

## The user's request, in their own words

Using the visual conceptualisation nature of Git City as a pivot to make something similar yet enhanced:
I want to visualise my own working computer with active processes and interactive UI that similarly to git city shows me the live processes, but this time, between my hardware, firmware and all the software processes active on it: seeing parts of memory that is reached by a progress, I want to see how a certain program is opened and contacts with parts of the system, how traffic is generated - but instead of a codebase repo, I want to reconceptualize the hardware components as different base complexes laying out every core part of the desktop device, from the motherboard as the overall traffic infrastructure connecting local parts, computational unit processors, RAM, Graphics card, audio cards, memory units peripherals, wired and wireless connections - start using Kódváros as a mechanical base for interactivity features, as this will be a node of its own similar to the current Város view, which shows only the git repo.

I want to enrich and extend the City metaphor by going deeper into conceptualisation of computational system.

For this I want to lean heavily into the Tropico games (or cities skyline) that encapsulates the basic analogy: a city state that is independent nation, having parts that function certain progresses, represent computing machine capabilities as industrial buildings/complexes, (create a ideatic topology that map out these commonalities in a diversive and creative conversion)

that give place starting with diversitying the 3D building into more sophisticated design: create different building types that extend the metaphor into fitting archetypes that represent part by function (like large file memory parts represented as warehouses, antivirus as military, file copies are transported by transfer units that are the packets, debugging as police, vmaleware, source codes inside Vault/Archive, different tools as workshop thematically fitting (legal parts of the Workflow Kit for example would be connected to a Lawyers office, representing work/progress/data, financial matters are Offices and Banks, third party programs live in the suburbs and downtown of the city as independent contractors that can be called-in/initiated, active processes lighting up their buildings as sub agents work as workshop owners that work with these contractors if an agentic process requires it, showing user started programs running on the ground view, while showing system background processes as layers underneath the City, or as smaller but constant activity along the roads representing the OS and it's internal processes. Command prompt admin control start from a central Palace building, where the operating system works in as a capital building. (El Preidente RAM should be empty lots that programs use certain parts of, similarly to a Market Place, important/historical, reference and research documents in Libraries and so one - create a detailed picture)

This Computer Homeland and Codecity will be similar at the end, but only work out the Homeland, than we apply that back to enhance Codecity to similar levels.

The overall data stream of the computers function should be fed via TMOG, or other Task manager like program that is can be examined as inspiration to build a plugin for one

Finally give me a host of further options following this thread of thought

## Deliverables, in order

1. **Read first:** `GO-CITY.md`, `docs/city/README.md`, `docs/city/melyviz.md`, then `CodeCity/src`, `CodeCity/world.js`, `CodeCity/land.json` and `CodeCity/companion.js`. Work out how views and map nodes are actually defined; this has not been checked, so confirm where Város lives and what "a node beside it" means in the code.
2. **Concept pack in `docs/city/homeland/`:**
   - the full topology: every PC part and class of software mapped to a district, building archetype or moving unit, with the reason for each mapping, covering everything the user listed plus what they left open
   - the layers: ground view for user programs, underground or road-level activity for the OS and background services, and the firmware / hardware bedrock
   - how each live signal drives the city, for example a program launch, memory being reached, disk and network traffic, sub-agents hiring contractors
   - which of the user's mappings can be measured for real, which only approximately, and which are metaphor only. This matters most for "parts of memory reached by a process": per-process working set is easy, but which physical RAM a process touches is not available in normal user mode, so be honest about it and propose what the view shows instead
3. **Data feed design:** identify what "TMOG" is (see Open questions), compare the sources, and recommend a plugin or adapter design.
4. **A long list of further options** following the same line of thought: scenarios, game-like layers, history replay, alerts, Tropico-style edicts, and so on, each with a rough effort.
5. **Checkpoint:** stop here and put the decisions to the user before any heavy visual build (see Working rules).
6. **After the user's answers, the first vertical slice:** the Homeland node opens from the map, shows the hardware complexes with a first set of archetypes, and runs on the real live feed from this PC.

Done for this session means the pack, options and decisions are delivered and the user has answered. Then the slice is built and seen working in live mode (START → K → S, :8797), with `node CodeCity/build.js` and `node CodeCity/tools/selftest.js` passing.

## What already exists: reuse it, do not rebuild

The Kódváros segéd (`CodeCity/companion.js`, live mode on :8797) already collects much of this:

- `CodeCity/probe-tier0.ps1` samples CPU / RAM / disk / NIC / GPU about every 3 s
- `CodeCity/etw/Program.cs` (`vrg-etw.exe`, an elevated scheduled task, pipe `\\.\pipe\vrg-etw`) gives exact bytes per process per second and file activity by process
- the port street (TCP listeners plus process names), `CodeCity/disk-walk.js` (folder sizes), a foreground-window hook, and Claude session tracking with edit beams
- the Mélyvíz design system

Extend this stream instead of adding a parallel collector.

## Open questions

Put these to the user as numbered CITY-Dn items, with lettered options and A recommended:

- **What is "TMOG"?** It could not be identified in the repo notes, so it may be a typo or a program name. Ask rather than guess. Candidates to study as inspiration: System Informer, LibreHardwareMonitor, HWiNFO (already in `H:\VRG\Full\programs`), Windows performance counters, ETW / WPR, PresentMon.
- Scene direction, render tech and how far the Tropico look goes.
- The display name, in Hungarian, and the launcher key.

## Working rules

- **Live data is available here.** Run the real feed on this PC. If a test needs repeatable data, use a synthetic fixture with the same shape, and mark fixture mode visibly so it can never read as real measurement. The ETW part needs the user's elevated scheduled task; never change system or security settings yourself.
- **Checkout:** stay on `main` in `H:\VRG\Full\Planner_VRG_U100`, as `GO-CITY.md` says: `git add` by path, never push, never stash, never switch branch. Other sessions may be working in the same folder, so never commit their pending files (on 2026-10-31 that means the `Mobile/` changes, `docs/council/` and the `tools/` council files).
- **Scope:** touch only `CodeCity/`, `docs/city/` and `launcher/vrg-menu.json`. If a menu entry is added or changed, run `node tools/check-start.js`, as `CLAUDE.md` requires, and keep existing keys stable.
- **Checkpoints:** phase big work, ask midway, and stop before design-heavy work. Every open question goes into the chat reply as numbered A/B/C options as well as into any decisions file.
- **Language:** UI text is Hungarian. Keep the Mélyvíz look unless a decision changes it.
- **Art:** draw our own illustrations and models. Tropico and Cities: Skylines are inspiration for the concept only: no assets, names or branding from them in the product, including the "El Presidente" name.
- **Privacy (CITY-D27 A):** process, file and network detail stays in memory only. Fixtures must not contain real client names, addresses or live data. `*.pdf` and credentials never go in the repo.
- **Picture sheets:** no overlapping labels on any image sent to the user.
- **Repo gotchas:** see `GO-CITY.md` section 4, especially writing patch scripts with the Write tool and using `replace(a, () => b)`.
