# VRG Mobile UI audit, 2026-11-23

After DevLap (D-172) proved hard to find (the sheet bar's + scrolled out of sight, the + list could not scroll),
the Founder asked for the whole app to be checked for availability and visual clarity. The rules are in
`../UI-CHECKLIST.md`; three static audits read every screen's Compose code (nothing could run in the cloud session),
and each report has a "Fixed" section saying what was fixed and what was skipped and why.

- `2026-11-23-shell.md`: the shell (Asztal, home, Lapok, Katalógus, lock screen), kit, Beállítások, Fiók, Eszközök, Frissítés, Párosítás.
- `2026-11-23-pc-link.md`: Légegér, Indítópult, Átadás, Képernyő, PC ablakok, Localhost, Hálózat, Claude, Értesítések, Haladás, Gyorsjegyzet, Alkalmazások, Archívum, Kódváros, Rétegverem, Gömb.
- `2026-11-23-field.md`: Pager, Tárgykereső, Óra, Térkép, Időjárás, Vault, Workflow, and the Sketcher (its findings are
  marked sketch-owned: another session owns feature-sketch; they are reported, not fixed).

Also changed: every palette's `faint` text colour is at 4.5:1 (it was 2.4–3.5), and the light palette's accent too.
Closed 2026-11-23: the kit-* palettes come from the VRG UI Kit tokens (`shared/vrg-ui-kit`, shared with the Desktop);
their `faint` was raised there by blending toward muted — kit-ej #6C757D → #7B848C (3.69 → 4.55:1), kit-papír
#8D969D → #657079 (2.70 → 4.55:1), kit-mélyvíz #646D74 → #818A91 (3.03 → 4.55:1; kit-owned, `--mv-faint` unchanged);
kit-kontraszt already passed (9.8:1). Min over deep/surface/raised.

## Telefonon ellenőrizni

1. Asztal, 3+ lappal, álló telefon: a felső sáv ⌕, ▦, ⋮ és ⚙ gombja mind látszik; ⋮ alatt Katalógus és Tájolás.
2. Az aktív lap fülére koppintás (név ▾): a lap menüje; fekve is görgethető, a "Lap bezárása" elérhető.
3. Egy ablak fejlécén ⋯: teljes méret, mozgatás, méretezés, bezárás.
4. Légegér fekve: a pad balra, a vezérlők jobbra görgethetők; állva a pad nem tűnik el.
5. Nagy betűméret (Android 1,5×): a Pager beállításai, a Rétegverem fejléce és a zárolt képernyő gombjai mind látszanak.
6. Halványabb (súgó) szövegek jobban olvashatók minden színsémában; Sekély sémában az akcentus sötétebb.
7. Claude és PC ablakok párosítatlan vagy --claude/--files nélküli relével: ok és ⟳ Újra jelenik meg, nem üres "—".
