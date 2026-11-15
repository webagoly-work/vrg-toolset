# Konnektóm-labor: sources

The one-file page `Archive/files/konnektom-labor.html` (published: https://claude.ai/artifact/VQ5Wd4wHYJVTtwrtxjR5rz),
made 2026-11-14. Five views: Muslica (FlyWire v783), Saját konnektóm (the Stack as a brain), Holo, Rétegverem, Üres háló.

| File | What |
|---|---|
| `gen-fly.py` | FlyWire annotations + Shiu et al. connectivity → `fly-data.js` (all neurons as uint8 xyz, the cell-type graph, top 20 inputs per type, signed, log-quantised) |
| `gen-stack.js` | the repo checkout → `stack-data.js` (git ls-files, git log, entities.json, DECISIONS files; no transcripts, so the U layer is empty) |
| `gen-build.js` | joins `shell.part.txt` + data + `Stack/earth-land.js` + `Stack/brain.js` + the view scripts into the page |
| `core.js` … `main.js` | the page: WebGL core, one file per view, the switchboard |

Rebuild (any machine with Python + pandas/pyarrow and Node):

1. Download into one folder `ann.tsv` (flyconnectome/flywire_annotations, `supplemental_files/Supplemental_file1_neuron_annotations.tsv`)
   and `conn.parquet` (philshiu/Drosophila_brain_model, `Connectivity_783.parquet`, about 100 MB).
2. `python gen-fly.py <that folder> fly-data.js 20`
3. `node gen-stack.js <repo root> stack-data.js`
4. Put the view scripts under `src/` with `shell.html`, then `node gen-build.js <dir> <out>` (paths inside the script are absolute to the
   session that made it; adjust `Stack/earth-land.js` and `Stack/brain.js`).

Data credits: FlyWire 783 (Dorkenwald et al., Schlegel et al., Nature 2024), Shiu et al. (Nature 2024), Natural Earth (public domain).
