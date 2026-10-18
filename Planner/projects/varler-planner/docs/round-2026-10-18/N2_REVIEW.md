# N2 — room suggestion table, for review (⏸ before N3)

Built in `src/08q-req.js` (`REQ_SUGGEST`). A suggestion is only applied when the user takes it (N6 A).
Switch "auto" = from the room's kapcsolási kör count (k) and its door count:
1 door → 101 (k 1) / 105 (k 2) / 105 + 101 (k 3); 2 doors → 106 pair (k 1) / 108 pair (k 2+);
3+ doors → 106 + 107 × (doors − 2) + 106. Világítási kör default = 1 per room. Redőny = the windows tagged redőny / árnyékoló.

| Room kind | Dugalj (ebből dupla) | Készülék dugalj | Lámpa / kapcsolási kör | Kapcsolók | Dedikált |
|---|---|---|---|---|---|
| Előszoba | 1 | — | 1 / 1 | auto | — |
| Nappali | 6 (2) | — | 3 / 2 | 105 | — |
| Konyha | 5 | hűtő · mosogatógép · páraelszívó 1900 | 2 / 2 | 105 | sütő 16 A · főzőlap 3 × 16 A |
| Étkező | 2 | — | 1 / 1 | auto | — |
| Háló / szoba | 4 (2) | — | 1 / 1 | 106 + 106 (ajtó + ágy) | — |
| Dolgozó | 4 | — | 1 / 1 | auto | — |
| Fürdő | 0 | borotva 1400 · mosógép | 2 / 2 (tükör külön) | 105 | — |
| WC | 0 | — | 1 / 1 | 101 | — |
| Kamra / tároló | 0 | — | 1 / 1 | 101 | — |
| Közlekedő | 1 | — | 1 per 3 m of the longer side / 1 | auto | — |
| Gépészet / garázs | 2 | — | 1 / 1 | 101 | kazán 10 A |
| Terasz / erkély | 1 (IP44) | — | 1 / 1 | 101 (inside) | — |
| Egyéb | 2 | — | 1 / 1 | auto | — |

Open review questions: R1–R6 in the chat reply of 2026-10-18 (same text below).

- **R1** Are the numbers above right? A yes · B change rows (write them).
- **R2** Háló switches: A 106 + 106 (door + bed) · B auto from the doors (101 for one door) · C 106 + 106 + a 101 bedside for the second side of the bed.
- **R3** Közlekedő lamps: A 1 per 3 m · B 1 per 2.5 m · C always 1, the user adds.
- **R4** Fürdő: A mirror light on its own kapcsolási kör (2 / 2, 105 outside the door) · B 1 / 1, 101.
- **R5** Kitchen worktop sockets: A 5 plain sockets (height from the Standards, 1100) · B count them by worktop length (1 per 600 mm).
- **R6** Rooms with 2+ doors and k = 2: A 108 pair (dupla váltó) · B 106 pair + a 101.

## Answers 2026-10-18

- R1 **B**: Háló switches = one string 106 (door) + 107 (one bed side) + 106 (other bed side). Option at each bedside spot: a socket + a 101 switch + the reading light above it (item `read`, offered with 2 sides, not applied by *Javaslat átvétele*).
- R2–R5: not answered → A.
- R6: left open for the next housekeeping (2+ doors with k = 2 currently gives a 108 pair).
