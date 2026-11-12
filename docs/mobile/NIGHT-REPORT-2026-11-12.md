# Night report — 2026-11-12 (NIGHT-DESKTOP.md)

Run 03:07–06:40 CEST on `main` in the main checkout. Nothing pushed. Step-by-step times: [NIGHT-LOG.md](NIGHT-LOG.md).
The run stopped past its 3 h 15 min line (06:22) while finishing N2; this report was written the next morning.

## What was built

| Step | WP | State | Commit | Tests |
|---|---|---|---|---|
| — | night brief | committed | `807db8b` | — |
| preflight | `PortsTest` follows M8 to LIVE (a stale assertion, not a broken feature) | fixed | `272dc43` | 166 core tests green, `relay-pair.js` ok |
| N1 | parity map [PARITY.md](PARITY.md): 34 User units, 12 window kinds, frame parts; M19–M23 as PLANNED tiles, WP files, roadmap rows | done | `6e8b468` | — |
| N2 | **M19 Asztal**: catalog generated into the app (`Mobile/catalogue/desk-gen.js`, `--check` in `mobile.cmd test`); Kommand = the Desktop palette's search in Kotlin; frame with top strip, home window, dock, ◣ menu / ◢ Rétegverem dials; Kezdőlap Asztal / Kompakt; orientation toggle | **BETA** | `ad52743` | 174 kit-core tests green (KommandTest replays the palette on 25 queries, same order), APK compiles, `relay-pair.js`, `check-start`, `check-catalog` ok |

## Night defaults to revisit

- **D-14** — the orientation toggle starts on Álló (the old lock) and covers the whole app. Alternatives: start on
  Automatikus, or a per-feature setting.
- **D-15** — the Asztal is the default home, built into the shell, not a feature module; the palette match is proved
  with a palette-written fixture, not by running Node in the JVM test. Alternatives: Kompakt stays default; a separate
  `feature-desk` module.

Both are in [DECISIONS.md](DECISIONS.md).

## What I could not verify here

- Layout in both orientations, and WebViews surviving a rotation: no emulator in the CLI shell.
- Légegér's gyro axes with the phone lying down: needs the phone.

## Your phone checks

1. `docs/mobile/WP/M19.md` → "Telefonon ellenőrizni" (8 items).

## To ship

```
Mobile\mobile.cmd install
```

installs the debug build; or push `main` for a release (Actions builds the APK).

## Next

N3 (M20 Lapok), N4 (M21 Alkalmazások), N5 (M22 Claude) and N6 (M23) were not started.

## Changes outside git

`Mobile/android/local.properties` (git-ignored) now names the real SDK path under
`Packages\Claude_…\LocalCache`, so the build also works from a shell without the Claude app's folder redirect.
