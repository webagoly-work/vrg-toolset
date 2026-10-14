# CoreRef Phase 0 — harvest report

Generated 2026-10-09T11:58:11.241Z by `CoreRef/tools/harvest.js`.

## Pinned upstream versions

| source | pin | resolved | licence |
|---|---|---|---|
| `esphome-core` | latest-release | **2026.9.1** | MIT (.c/.cpp/.h/.hpp/.tcc/.ino runtime) + GPL-3.0 (Python) |
| `esphome-docs` | links-only | **-** | CC-BY-NC-SA-4.0 |
| `esphome-schema` | match-esphome-release | **2026.9.1** | generated from esphome (MIT/GPL-3.0) |
| `ha-core` | latest-release | **2026.10.0** | Apache-2.0 |
| `ha-dev-docs` | links-only | **-** | CC-BY-NC-SA-4.0 |
| `ha-user-docs` | links-only | **-** | CC-BY-NC-SA-4.0 |

## Footprint

| artefact | size |
|---|---|
| `CoreRef/data/` (raw, regenerable) | 5.71 MB |
| `CoreRef/db/coreref.sqlite` | 11.34 MB |
| - esphome schemas bundle | 4.32 MB |
| - ha integrations.json | 219.1 KB |
| - ha zeroconf.py | 22.9 KB |
| - ha bluetooth.py | 30.1 KB |
| - ha dhcp.py | 33.9 KB |
| - ha usb.py | 4.0 KB |
| - ha manifests.json | 461.7 KB |

**This is the whole permissive layer.** It is what may ship on a BRIDGE install.

## Row counts

| table | rows |
|---|---|
| `esphome_component` | 746 |
| `esphome_config_var` | 40,805 |
| `esphome_extends` | 5,297 |
| `ha_brand` | 1,254 |
| `ha_integration` | 1,541 |
| `ha_discovery` | 895 |
| `artifact` | 2,274 |
| `source` | 6 |

## ESPHome

- release **2026.9.1**, schema version **2026.9.1**
- 746 component directories; 709 have a published schema, 37 do not
- 40,805 config variables captured, with inline docs text and doc URLs

## Home Assistant

- release **2026.10.0**
- 1254 brands, 1541 integrations, 1523 manifests

### Integration preference (the BRIDGE "prefers local" axis)

| iot_class | rank | count |
|---|---|---|
| local_polling | 2 | 427 |
| cloud_polling | 5 | 393 |
| local_push | 1 | 262 |
| cloud_push | 4 | 115 |
| calculated | 3 | 34 |
| assumed_state | 3 | 24 |

**689 local** vs **508 cloud** integrations.

### Discovery fingerprints (device identification)

| channel | rules |
|---|---|
| dhcp | 388 |
| bluetooth | 238 |
| zeroconf | 166 |
| homekit | 71 |
| usb | 32 |

### Quality scale

| scale | count |
|---|---|
| (none) | 737 |
| legacy | 294 |
| internal | 182 |
| bronze | 125 |
| platinum | 111 |
| silver | 77 |
| gold | 15 |

## Licence routing (enforced by the harvester)

| source | class | licence | what happens to it |
|---|---|---|---|
| `esphome-core` | permissive | MIT (.c/.cpp/.h/.hpp/.tcc/.ino runtime) + GPL-3.0 (Python) | harvested into `CoreRef/data` + sqlite; may ship |
| `esphome-schema` | permissive | generated from esphome (MIT/GPL-3.0) | harvested into `CoreRef/data` + sqlite; may ship |
| `ha-core` | permissive | Apache-2.0 | harvested into `CoreRef/data` + sqlite; may ship |
| `esphome-docs` | restricted | CC-BY-NC-SA-4.0 | NOT fetched here. Personal reading mirror outside the repo; client stores the URL only |
| `ha-user-docs` | restricted | CC-BY-NC-SA-4.0 | NOT fetched here. Personal reading mirror outside the repo; client stores the URL only |
| `ha-dev-docs` | restricted | CC-BY-NC-SA-4.0 | NOT fetched here. Personal reading mirror outside the repo; client stores the URL only |

## Fetch health

- 2,274 requests, 37 non-200 (missing schema files are expected: not every ESPHome component publishes one)

Every request is recorded in the `artifact` table with its URL, HTTP status, byte count and sha256,
so the next harvest can diff against this one and report what upstream changed.
