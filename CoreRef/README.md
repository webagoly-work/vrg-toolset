# CoreRef — the BRIDGE core reference database

The offline, link-out reference for the systems BRIDGE is built on: **ESPHome** and
**Home Assistant**. Two jobs:

1. **Alignment.** Every other VRG database (Inventory, BuildTree, the BRIDGE standards)
   names components, integrations and config options that belong to upstream. CoreRef
   pins what upstream actually says, at a known release, so a refresh can *diff* and tell
   us what moved. That is the real product here — not the text, the diff.
2. **Reference on site.** A copy ships with a BRIDGE install so the system can be
   understood and serviced without the internet, with a hyperlink back to the online
   source for anything deeper.

## The licence rule (general, applies beyond CoreRef)

Upstream splits cleanly in two and the split is enforced in code, not by good intentions:

| class | sources | where it goes |
|---|---|---|
| **permissive** | ESPHome (MIT/GPL-3.0), ESPHome schema, HA core (Apache-2.0) | `CoreRef/data` + `CoreRef/db` — may ship with an install |
| **restricted** | esphome.io, home-assistant.io, developers.home-assistant.io — **all CC-BY-NC-SA 4.0** | **never in the repo.** Personal reading mirror at `../_refmirror`, outside the repo. The client side stores the **URL only**. |

NonCommercial means a bundled copy cannot ride along on work we are paid for. So: the
prose stays a link, we read it from the personal mirror, and the Hungarian text we
eventually write from it is our own work and ships freely. `tools/harvest.js` refuses to
write a restricted source into the repo — see `assertRepoSafe()`.

## Layout

```
CoreRef/
  coreref-sources.json      pinned sources, licence class, destination routing
  tools/harvest.js          the harvester
  tools/lib/net.js          retrying fetch + bounded concurrency + sha256
  tools/lib/pylit.js        parses HA's hassfest-generated .py tables (no Python needed)
  tools/lib/store.js        SQLite schema (node:sqlite, no dependencies)
  data/                     harvested payload          [gitignored, regenerable]
  db/coreref.sqlite         the queryable database     [gitignored, regenerable]
  docs/PHASE-0-REPORT.md    generated: versions, footprint, row counts, fetch health
  docs/COREREF-PLAN-001_*   scope, catalogues and work packages
```

## Run it

```bash
node CoreRef/tools/harvest.js
```

Takes about 8 minutes on a home connection (~2,300 requests, all to CDNs). Flags:
`--limit N` for a quick slice, `--concurrency N` (default 12), `--esphome` / `--ha` to do
one side only. The database is rebuilt from scratch each run; `data/provenance.json` and
the `artifact` table keep every URL with its HTTP status, byte count and sha256 so two
harvests can be compared.

Pins resolve to the **latest release tag**, never a branch — same rule as
`vendor-manifest.json`. A branch quietly becomes different content tomorrow.

## What is in there

Run against ESPHome **2026.9.1** and HA core **2026.10.0** (2026-10-09):

- **746** ESPHome components, **40,805** config variables (16,930 excluding LVGL's DSL),
  each with key/type/default, and 5,599 of them carrying upstream docs text and a doc URL
- **1,254** HA brands, **1,541** integrations with `iot_class`, `integration_type`,
  `quality_scale`, `config_flow` and the official documentation URL
- **`local_rank`**, derived from `iot_class`: 1 local push, 2 local polling, 3 assumed,
  4 cloud push, 5 cloud polling. **689 local vs 508 cloud** — this column *is* the BRIDGE
  "prefers to be integrated" axis
- **895** device discovery fingerprints (mDNS/HomeKit/BLE/DHCP/USB → integration), which
  is how an unknown device on a client's network gets identified
- an FTS5 `search` table so all of it is full-text searchable offline

## Not yet built

A reader UI (single-file HTML, Hungarian), the refresh diff report, and the catalogue
layers for technologies, form factors, brands and sourcing. See
`docs/COREREF-PLAN-001_Scope-and-Work-Packages.md`.
