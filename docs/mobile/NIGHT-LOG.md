# Night log — 2026-11-12 (NIGHT-DESKTOP.md)

| Time (CEST) | Step | Note |
|---|---|---|
| 03:07 | start | `git rev-parse` = main checkout, tree clean except the brief; brief committed (807db8b) |
| 03:10 | preflight | `mobile.cmd test` found no Java from the CLI shell: this shell does not get the Claude app's `%LOCALAPPDATA%` redirect. Ran with `JAVA_HOME` = the real `Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\Android\jdk-17.0.20.1+1`, and `local.properties` (git-ignored) now names the real SDK path under `Packages\...\LocalCache` (works from any shell) |
| 03:11 | preflight | 166 core tests, 1 red: `PortsTest.theCatalogueEntry` still expected M8 = BETA after b772d2f moved it to LIVE. A stale assertion, not a broken feature: fixed the one line, all green. `relay-pair.js` all ok |
| 03:16 | N1 | PARITY.md: 34 User units + 12 window kinds + frame parts mapped; new WPs M19-M23 as PLANNED tiles, WP stubs, roadmap rows |
