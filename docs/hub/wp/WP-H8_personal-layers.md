# WP-H8 — Personal layers: Saját linkek (L5) and Helyi célmappa (L6)

**Goal (user):** "an additional layer … for custom hyperlinks for their own use (a layer of their
choice that only they see)" · "another additional layer for users to set a destination folder on
their own device (so with later allowance an AI or code session could send exports)".

## Depends / decisions
H3. **HUB-Q15** (A = browser storage + export/import file).

## Build
1. **L5 Saját linkek**: groups of links (`{id, t, url, d, attach?:programId}`); a link with `attach`
   draws under that program's column in the L5 band, the rest in a "Saját" group at the left.
   Add / edit / delete via RCO on the band and a ☰ entry. Stored in `kpStore` (`vrgKapu.l5`).
   **Export** `vrg-kapu-sajat-linkek.json` / **Import** (merge by id, report counts). Only `http(s)`
   URLs and `file:///` accepted (no `javascript:`).
2. **L6 Helyi célmappa**: "Helyi célmappa…" (☰) → `showDirectoryPicker({mode:'readwrite'})`; the
   handle is kept in IndexedDB (`vrgKapu` db, store `handles`); permission re-requested on use
   (`queryPermission` / `requestPermission`). Shown as one node "📁 <folder name>" with "Megnyitás"
   (companion `open-folder` when the path is known — the API does not reveal full paths, so the user
   may type the path once for the companion) and "Teszt fájl írása".
   Not supported / denied → explain: "Ez a böngésző nem engedi a mappa választást — a Munkanapló
   letöltéssel mentsd."
3. A `kpTarget.write(name, text)` helper that H9 uses; a stub `kpTarget.inbox()` documented in code
   as the future entry point for AI/session exports (no behaviour yet).

## Tests (`spec-80-personal.js`)
- import of `[{id:'a',url:'javascript:alert(1)'}]` → rejected, count 0.
- import merge: existing a,b + incoming b',c → a,b',c; report "1 új, 1 frissített".
- L5 never appears in `kpApply` output or any save payload (spy on the PUT body).
- Browser: pick a scratch folder in the pane (if the pane allows the picker; if not, note it in the
  report and test with a stubbed handle) → "Teszt fájl írása" creates `vrg-kapu-teszt.txt`.

## Out of scope
Gist sync (HUB-Q15 B, v2). AI sessions writing into the folder (later, needs its own decision).
