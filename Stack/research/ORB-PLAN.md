# Holo order — the stack as a Jarvis-like orb and an inverted brain (plan, 2026-11-07)

*Status: H1–H4 built 2026-11-07 (`orb.html`, H4 = Őrség, the Night's Watch look, HO-Q5). Same day, second round: Föld + Mag forms, transit, Őrség = the lock (HO-Q7, HO-Q8); answers in DECISIONS.md.*

## Why the Konnektóm got crowded (measured on the 2026-11-07 build)

- **Mass is file size, but importance is activity.** The 50 DevLog lines (7 active, 11 waiting, 16 parked, …) are the actual work pathways, yet they are 50 neurons out of ≈ 24 800 (0.2 %). Code (12 800) and run recordings (7 200) make up most of the brain.
- **14 536 edges are drawn at once.** 3 217 of them touch a run (U), so the top of the stem saturates to white. The busiest nodes are hubs: `C:Planner/projects/varler-planner` has 451 links, `C:tools` 332 and the pillar `E:planner` 278.
- **One stem for every kind of activity:** runs, sessions and commits share one tube, so separate lines of work cannot be told apart.

## Own architecture (the references are only a starting point)

References: cyber1443/jarvis-ai-orb-web-animation (orb-hero, orb-preview), ArtStation "J.A.R.V.I.S." (tangled filament orb), ethanplusai/jarvis (a voice front-end for Claude Code sessions; idea only). No code or image is copied.

1. **One origin.** The base point (the centre of the base, or the orb's core) means *now / the Founder's desk*. Everything grows out of it.
2. **Pathways are the main structures.** Each active line of work gets its own distinct region: an orbit plane in the orb, or a sector or arm in the inverted brain. Its thickness shows mass and its brightness shows recency.
3. **Passive information is a dim halo,** attached only to the pathway that references it. A shared item sits between its pathways.
4. **Edges are bundled per pathway.** All of a node's own edges appear only when it is selected or hovered.
5. **Firing runs along the pathway** from the origin out to the touched nodes, like comets.
6. **Level of detail:** far away = pathways + halo clouds; close up = single neurons (2 KB unit kept).

## Two views on the same data

- **A · Inverted brain:** the origin is at the centre of the base, and pathways grow upward and outward, each in its own angular sector.
  - Body-plan options from other animals:
    - Octopus: a small central brain, with about two-thirds of its neurons in the arms.
    - Bird or crow: the pallium is built from nuclei, not layers, so it reads as distinct clusters.
    - Elephant or whale: very large and folded.
- **B · Holo orb:** the core is *now*, each pathway is a tilted orbital ring in its own plane, and the passive halo is particle dust. States: idle / thinking (a build is running) / alert (drift, failed health).

## Nightwatch — research (to confirm with the Founder)

The likeliest reading is Rembrandt's *The Night Watch* (1642). In Operation Night Watch the Rijksmuseum's macro-XRF scans (announced Dec 2021) found Rembrandt's **sketch on the canvas in a chalk-rich beige paint** over a brown ground. The sketch includes things he later dropped, such as an extra sword and spears above the heads. His drawings use a **reed pen with brown ink and brush wash**, bold broken strokes and white heightening. As a render style:

- dark warm ground with chiaroscuro;
- planned, parked or dropped work as beige chalk underdrawing lines;
- built and active work painted in light.

Other readings (the Game of Thrones Night's Watch sigil, the Russian *Night Watch* film's chalk marks) are possible, so the question is open: HO-Q5.

## Phases (each one ends with a checkpoint)

- H0: answers + a still sketch of the chosen layout (one image).
- H1: data. Add pathway membership to `out/connectome-data.js` (lib/connectome.js), plus edge bundles.
- H2: the first view, with the de-crowding rules 2–6.
- H3: the second view.
- H4: the Nightwatch render style as a toggle.
- H5: START entry + docs.
