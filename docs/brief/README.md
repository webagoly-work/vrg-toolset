# docs/brief — the anonymous system briefs (fork F10, 2026-11-21)

*Internal: this file is **not** handed out. The hand-outs are the two PACK files.*

The Founder's request: an AI brief and a detailed system description of the whole VRG devline, in two anonymous
versions, to give to fresh design sessions that cannot reach the repository. Those sessions do a medium-depth UI/UX
research, then a design system and frontend designs (visual, animation, layered controls) for the Desktop and Mobile.

## The files

| File | Hand out? | What it is |
|---|---|---|
| `SYSTEM-A.md` | yes (in PACK-A) | the system overview, **version A**: personal data removed, the electrical trade kept. Codename **Kestrel**. On-screen labels kept in Hungarian as `‹…›` |
| `SYSTEM-B.md` | yes (in PACK-B) | the same system, **version B**: also the trade hidden (a "technical field-service business"). Codename **Halcyon**. No Hungarian at all; the locale is "a non-English primary locale" |
| `BRIEF-A.md` | yes (in PACK-A) | the instructions for a design session, refers only to its SYSTEM file |
| `BRIEF-B.md` | yes (in PACK-B) | the same brief for version B (Halcyon names, English placeholder labels at +40 %) |
| `PACK-A.md`, `PACK-B.md` | **these are the uploads** | brief + system in one file each; generated, never edit |
| `README.md` | no | this file |

Tools: `tools/brief-pack.js` (rebuilds the packs, then runs the check), `tools/anon-check.js` (the sanitiser check).

## Regenerate and check

```bash
node tools/brief-pack.js            # write PACK-A.md + PACK-B.md, then run anon-check (exit 1 on a hit)
node tools/brief-pack.js --check    # exit 1 when a pack is stale
node tools/anon-check.js            # check every hand-out file: A = personal rules, B = personal + trade rules
node tools/anon-check.js --b x.md   # check any file as version B
```

Edit `BRIEF-x.md` / `SYSTEM-x.md`, never the packs. **A change to A needs the matching change in B by hand** (B was
derived from A once with a throwaway transform, then rewritten where the trade showed through; there is no automatic
A → B conversion, on purpose: a keyword swap leaves the shape of the trade visible).

### The deny-list (truly personal data stays out of Git)

`anon-check.js` carries only *patterns* and our own names (brand, product nicknames, agent personas, codephrases, the
account and repository name). Client names, real people, addresses and device codes would be the leak if written in a
committed file, so they go in a deny-list **outside Git**, one entry per line (plain text, or `/regex/flags`; `#`
comments):

1. `ANON_DENY=/path/to/deny.txt node tools/anon-check.js` (the env path wins; nothing else is read), or
2. `~/.config/vrg/anon-deny.txt`, or
3. `tools/anon-check.deny.txt` (gitignored).

The client codes of `tools/anonymise.map.json` (gitignored) are added automatically when that file exists. The output
lists every deny source it read. On the H: PC, keep the list next to the anonymiser map.

### What the check catches

- **Both versions:** e-mails, phone numbers, private IPs, MAC addresses, local paths (`X:\…`, `/home/…`), user folders,
  the account name, session / artifact / repository URLs, the repository name, VRG / Varler, product nicknames (Kódváros,
  Légegér, Csipogó, Mélyvíz, Rétegverem, Solomon, Divergence, Kapu, Asztal, Sketcher, Papír, BRIDGE, …), the agent
  persona names, codephrases (`GO …`), internal ids (D-nn, Mnn, DESKU-Q…), third-party brands we chose not to name
  (the AI vendor, the git host, the cloud drive, phone makers), Hungarian street addresses, phone model codes.
- **B only:** any Hungarian accented letter; Hungarian and English electrical vocabulary (stems such as villany,
  elosztó, kismegszakító, aljzat, kábel, vezeték, fázis, földel, napelem; electric, breaker, socket, outlet, wiring,
  wire, cable, voltage, earthing, conduit, fuse, lamp, lighting, solar, inverter, charger, RCD, MCB; whole words circuit,
  meter, phase, volt, amp, kW, kWh, EV, PV, IP44-style ratings, CEE, ESP32, intercom); locale giveaways (Hungar…,
  Magyar, Budapest, forint, HUF, Ft); giveaway phrases (installation work, burnt, sparks, shock).

## Codenames

| | Version A | Version B |
|---|---|---|
| The family | **Kestrel** | **Halcyon** |
| The business | a small electrical installation business | a small technical field-service business (surveys, plans, prices and carries out fit-out jobs) |
| Locale | Hungarian, labels shown as `‹…›` | "a non-English primary locale" (long compounds, diacritics incl. double-acute vowels, decimal comma) |
| VRG Mobile | the phone app | the phone app |
| VRG Asztal | the desktop shell (Desk) | the desktop shell |
| START | the text launcher | the text launcher |
| VRG Sketcher | the Survey instrument | the Survey instrument |
| Varler Planner | the Planner | the Planner |
| Varler Workflow Kit | the estimate workflow | the estimate workflow |
| Készlet / Inventory | Stock | Stock |
| VRG Kapu | the gate page | the gate page |
| VRG Stack / Rétegverem | the knowledge graph | the knowledge graph |
| Kódváros | the code city | the code city |
| Solomon Gömb | the consistency sphere | the consistency sphere |
| Divergencia board | the signal ring board | the signal ring board |
| Csipogó | the crew pager | the crew pager |
| Légegér | the air mouse | the air mouse |
| Rajztár Stúdió | the drawing library studio | the drawing library studio |
| BRIDGE | a standards document set for smart-home systems | a standards document set for building-automation systems |
| Varler Console | the field console | the field console |
| ServiceKit | the service kit | the service kit |
| Mélyvíz | Deep Water | Deep Water |
| Varler Papír | Paper | Paper |
| RCO | the long-press menu ("RCO") | the long-press menu ("RCO") |
| D-90 | the modular "every feature switchable" rule | the same |
| the agent council (personas) | roles: lead coordinator, department heads, contractors, workers | the same |

## The term map A → B

| Version A (electrical) | Version B (neutral) | Shape kept |
|---|---|---|
| electrical installation business, electrician | technical field-service business, technician | a trade that surveys, plans, prices, builds |
| installation point | service point / point | a point on a plan with a type and a state |
| socket ‹dugalj› | wall unit | the most common point type |
| switch ‹kapcsoló› | control | a point type |
| light ‹lámpa› | overhead unit | a point type |
| junction box ‹kötődoboz› | junction node | a point type |
| data / low voltage ‹gyengeáram› | data point | a point type |
| fixed connection ‹fix bekötés› | fixed unit | a point type |
| sensor | sensor | a point type |
| distribution board ‹elosztó› | hub | the source a group is served from |
| sub-board | sub-hub | a secondary hub |
| circuit ‹áramkör› | group | a set of points served by one hub |
| dedicated circuit | dedicated group | a group for one large unit |
| isolation ‹leválasztás› | separation flag | a group attribute |
| Connect ‹Bekötés› (feed circuits from the nearest board) | Assign (link groups to the nearest hub) | one tap that links all unassigned groups |
| cable route ‹nyomvonal› | route | a polyline with a length |
| cable metres | route metres | lengths + drops + reserve |
| meter point ‹mérőhely›, meter cabinet | service entry, service-entry cabinet | where the supply comes into the site |
| main fuse rating, phases | entry rating, supply type | a capacity question |
| RCD / FI, earthing, EPH | safety device, baseline safety checks | safety questions and photos |
| type plate ‹típustábla› (serials, ratings, breakers) | equipment label (serial, maker, model code, ratings) | an on-device text reader that offers chips |
| IP44, wet room | wet zone, protected | tags with a downstream meaning |
| EV charger / wallbox | large external unit | a system toggle with its own questions and shots |
| solar / inverter | roof-mounted add-on | a system toggle with roof questions |
| smart home | automation | a system toggle |
| low voltage (LAN, TV) | data network | a system toggle |
| air conditioning, heat pump, underfloor heating | climate units, floor systems | system toggles |
| LED strip | linear strip / linear unit | a want with a quantity; a pricing calculator |
| industrial CEE socket | heavy-duty wall unit | a point preset |
| high-bay lamp, emergency lighting | high-mounted unit, safety signage unit | variant presets |
| "égett" detector (burning smell, sparks) | damage words (a smell, stains, marks) | a keyword detector that only suggests |
| "no RCD" ≠ "RCD"; "kiégett izzó" is not a fault | "no safety device" ≠ "safety device"; a worn-out consumable is not a fault | negation-safe suggestions |
| electrical tool pack ‹Villany› | service tool pack | a sketch plugin |
| switch-and-socket product family picker | modular fittings product family | a configurator |
| panel material calculator, general electrician calculator, LED price calculator | material-cost, general trade, linear-unit pricing calculators | three phone calculators |
| professional electrical design packages | the trade's professional design packages | the drawing library |
| single-line board diagrams | schematic hub diagrams | planned output |
| wiring pipeline (conduit, pulling, cable sizing) | route pipeline (containment, staged runs, sizing) | the Planner's route work |
| PCB-style autorouter | chip-layout-style autorouter | the routing engine |
| home-cinema module | media-room module | a Planner module |
| frost for PVC cable, PV commissioning days | frost limits for materials, outdoor commissioning | weather alerts |
| panel schedule, measurement log with a limit table | hub schedule, measurement log with limit values | field-console pages |
| "switch off / on" pager messages are not a lockout | "stop / start equipment" messages are not a safety isolation | safety wording on the pager |
| Planner phases 1–6 | work stages 1–6 | (B never uses "phase") |
| wire red (Paper accent), terminal dot | signal red, open dot | the document signature |
| the bulb logo | a round emblem | the brand mark |
| Hungarian labels ‹…› | English meaning only, +40 % length budget | the locale |
| Ft budget chip | ¤ budget chip | a chip |

## Choices made for the Founder (no D-numbers: this fork writes documents)

1. **English documents, Hungarian labels in A.** The briefs are English (asked); A keeps the real Hungarian UI labels as
   `‹…›` so a designer sets real word lengths. B has no Hungarian at all, because the locale narrows the person down.
2. **B is a hand rewrite, not a keyword swap.** A swap kept the trade's shape visible (point types, the shot list, the
   question topics, the type-plate values). Those passages were rewritten in neutral terms that keep the *feature
   shape*.
3. **The agent persona names became roles**; the Founder is "the owner".
4. **Third-party brands are not named** in the systems (the AI vendor, the git host, the cloud drive, phone makers).
   The briefs name a few comparable *products* for research (magicplan, CompanyCam, Fieldwire, SafetyCulture, Jobber,
   ServiceTitan, Procore, Fulcrum), the same list in A and B, chosen to be general field-service tools.
5. **One brief text for both versions**, differing only in names, the locale and the sample data, so two design results
   can be compared.
6. **Phases → stages.** "Phase" is an electrical word; B's text, and the briefs, say "stage".
7. **Parallel forks are described as part of the system.** F6 (one feature registry, ⚙ Funkciók) and F9 (the report from
   the phone) landed on `main` while this fork ran and are described as built (beta); F8 (end-to-end tests) as *in progress*.
8. **The brief asks for no live questions**: the design session works through, writes assumptions, and ends with
   numbered questions, recommended option first (the house rule).

## Deliberately left out

- Every client, job, address, person, account, device code and local path (none was copied in the first place; the
  inventories were read with that rule).
- The colleague's identity and the business's name, the owner's name, the Hungarian legal / standards names (MSZ, HD
  60364, HMKE, …) in both versions: they are not needed for a UI design and they name the country and the trade.
- Internal ids (WP numbers, D-numbers), codephrases, branch names, server ports per tool (only "about twenty fixed
  ports" is said), file paths and the repository layout.
- The personal vault's internals and the device-trust cryptography beyond "ECDH-style grant only that phone opens".
- Developer-only research spikes and retired tools (Toolbox, Zen sessions) — mentioned at most in passing.
- In B also: the smart-home device list of the standards set, the electronics names of the small devices (only "a
  development board", "a USB touch display", "a knob pad").

## Things I was unsure how to generalise (for the coordinator)

- **The service-entry questions in B** still form a recognisable "supply comes in, has a rating, may need more capacity"
  shape, which fits several trades (water, gas, electricity, data) but a sharp reader may guess.
- **The weather service's alerts** (work at height, frost limits, outdoor commissioning) are generic but outdoor
  building work is visible in both versions; that is intended.
- **The Planner's routing engine** is described as a chip-layout-style autorouter; that hints at electronics in general,
  not at the trade.
- **Appliances** (cooking, laundry, water heating) stay in B as "large appliances": many building trades connect them.

## Blind de-anonymisation tests (2026-11-21)

A fresh reader got only PACK-B and was asked to guess the trade and the locale.

| Round | Trade guessed (electrical) | Locale guessed (Hungarian) | What changed after it |
|---|---|---|---|
| 1 | ~90 % | ~90 % | point types made abstract (type A / B / C), safety checks, ratings and roof-orientation questions removed, locale clues (double-acute vowels, currency, date order) dropped, exact hex colours and counts rounded, MINI / RCO / START nicknames dropped |
| 2 | ~80 % | ~55 % (Czech / Polish / Turkish / Finnish also named) | deposit clause and the "never an offer" naming dropped |

**The limit:** the brief asked B to keep each feature's *shape* (points on a plan with a type and a state, groups of
points served by one hub, routes with a length, a service entry, a checklist that grows with the scope). Together those
shapes describe this trade to a sharp reader. Going further means abstracting the domain model itself (e.g. "assets on
a plan, grouped by a parent asset") at the cost of design fidelity: a question for the Founder.
