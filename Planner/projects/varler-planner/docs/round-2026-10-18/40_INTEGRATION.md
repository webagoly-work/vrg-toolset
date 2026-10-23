# Igénylista — how the other layers join later (suggestions)

The Erősáram items (WP-N2) set the pattern: **an item = a role + an endpoint code + what is counted + a few spec
fields**. Every other layer joins by adding rows to `REQ_ITEMS` and columns to `REQ_SUGGEST`; the dialog, status and
overview need no new code. Ordered by value for a typical CLA/CLANV4 job:

1. **Adat / PoE** — `eth` RJ45 db (dupla?), `ap` WiFi AP (mennyezet), `cam` kamera, `tv` TV-pont (ETH + koax). With no house list (N3 B),
   building-wide points (*adatbelépés*, *rack*) are items of the room that holds them (usually Gépészet). Fulfilment = 05s ETH/ACP/CAM counts.
2. **Rádió** — not counted: an item *lefedettség kell (wifi / thread / uwb)*, status from `rfRoomCover ≥ 0.9` (already
   how 05t does it).
3. **Kezelőfelületek** — `pan` panel, `thr` termosztát; spec: magasság, mely ajtónál. Feeds the SmartFrame portal
   slots (06a) the same way switches feed door slots.
4. **Érzékelők + Biztonságtechnika** — `mot`, `smk`, `dwc` per opening (derived from Jelölés tags as 05t does), `kpd`.
   Count = derived default, the user can only add.
5. **Média és hang** — `spk` n, `scr` képernyő; a room with *Házimozi* ticked offers *Mozi réteg indítása* (C2 wizard)
   instead of free counts.
6. **Törpefeszültség / B busz / USB** — `lnr` LED szalag (m, not db), `uep`, `usb`; spec in metres → the fill reads
   the length.
7. **Gépészet requests that are not ours but drive ours** (fűtés zónák, redőnyök, szellőzés): items of the room
   that holds the equipment, whose only effect is a DED / CONTROL endpoint suggestion.
8. **Extrák** — the CLA extras and SmartFrame ideas are already a checklist (06b xtr); their rows become req items of
   role `sys:EXTRA`, so one dialog shows everything a room was promised.

Cross-cutting ideas:
- **Ajánlat / takeoff link:** a request with no device yet can be priced as *előkészítés* — the Workflow Kit quote can
  read `kell − van` per item.
- **Client view:** the room lists + the Ház összesítő are the client-facing *igényfelmérés* sheet (HU first, EN italics under it);
  export from the overview as a printable table.
- **Templates:** save a room's list as a named template (*„Háló standard"*) next to the room-kind suggestions.
- **Survey on the phone (07-link):** the checklist is small and form-like — the phone link page can fill it on site.
