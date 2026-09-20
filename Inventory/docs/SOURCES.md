# Sources and extraction rules

All source documents live in `H:\_inbox\database_emails` (not committed —
they contain customer addresses and tax numbers).

## 1. E-mails (53 × `.eml`)

Sender: `kozpont@daniella.hu` / `monika.szeles@daniella.hu`.
Body is a single `text/html` part, **base64** encoded, UTF-8, with HTML
entities (`&aacute;` etc.) mixed with literal accented characters.

| Subject | Count | What it contributes |
|---|---:|---|
| `Rendelés visszaigazolás (Hefler Tamás)` | 39 | article no., name, pack, qty, net unit price, net total, gross total |
| `FIGYELEM! A rendelés módosult!` | 12 | same columns; a later revision of an existing order |
| `Rendelése megérkezett` | 1 | article no., name, unit, ordered/arrived/backordered — **no prices** |
| `RE: Anyagok Forgáchba` | 1 | free-text list of article numbers, no prices |

Item rows match `/<tr height="18px"[^>]*>/`. Cell order:

```
Cikkszám | Megnevezés | Kiszerelés | Rendelt | Kiadható | Egységár | Nettó | Bruttó | Határidő
```

Gotchas that are handled in `tools/build.js`:

* In modification mails every name carries a leading `( ) ` marker — stripped.
* Changed lines are marked with `bgcolor="lightgreen"` on the `<tr>` — the row
  regex must therefore not assume the tag ends right after `height="18px"`.
* The arrival mail reuses the same `<tr height="18px">` shape but its columns
  are `Rendelt / Beérkezett / Később érkezik`; treating column 6 as a price
  would produce a bogus `0.00 Ft`. That mail type is detected by subject and
  its price columns are discarded.
* One order number can appear in up to 8 mails. For quantity totals only the
  newest mail per order number is counted; **all** mails stay in
  `vrg-orders.csv` and in the price history.

## 2. PDFs (3)

| File | Document | Extra columns |
|---|---|---|
| `14408_26VRD1_Hefler_Tamás (1).pdf` | Megrendelés visszaigazolás | **Listaár + Eng.% + Nettó egys.ár** |
| `58530_26VA_Hefler_Tamás.pdf` | Ajánlat | Nettó egys.ár only |
| `72377_26VA_Hefler_Tamás.pdf` | Ajánlat | Nettó egys.ár only |

Extraction (`tools/pdfrows.js`): inflate the content streams, collect
`Td` positions and `Tj` strings, group fragments by rounded *y*, sort by *x*.
A row starts at a cell matching `/^\d+\.$/`; the lines below it at the same *x*
as the `Saját cikkszám` header are its description, which is why the PDFs give
much longer product names than the e-mails.

The embedded subset font maps two glyphs outside the Latin-1 range; the
`ToUnicode` CMap in the file states `<0118> → U+0151 (ő)` and
`<0126> → U+0171 (ű)`. Without that mapping names come out as
`Manyag doboz` instead of `Műanyag doboz`.

The two layouts are distinguished by whether the header row contains `Listaár`.

## 3. Spreadsheets (4 × `.xlsx`)

`anyagar_sablon50_garázs földelés.xlsx`, `anyagar_sablon_Laci.xlsx`,
`daniella rendelés 1.xlsx`, `deseo2 másolata.xlsx`.

These are the user's own working request lists: partially filled article
numbers, rough own price guesses, free-text notes ("mit mivel kötnél össze?").
Only the **article numbers and short names** were taken from them, as
`tools/hints.json` — they add 9 items that never appeared in a priced
document. Their price columns were deliberately **not** imported: they are
estimates typed by hand, not vendor prices.

`Downloads.zip` / `Downloads.7z` are byte-identical copies of the same folder
and were ignored.

## 4. What was intentionally not derived

* **Website gross price.** The order documents carry a partner-specific
  *discounted net* price. It is not the webshop's gross price and must not be
  written into `daniella_aktualis_brutto_ar_huf`.
* **Stock levels.** Nowhere in the sources.
* **Product URLs.** Nowhere in the sources. No URL was guessed from a pattern.
* **Weights.** Nowhere in the sources.
* **Official categories.** Nowhere in the sources.

## 5. Derived fields and their confidence

| Field | Rule | Confidence |
|---|---|---|
| `vrg_id` | append-only assignment from `data/vrg-id-registry.json` | exact — never derived from the data |
| `megnevezes` | longest name variant seen across all sources | high (all variants kept in `nev_valtozatok`); 17 names still embed the vendor article number |
| `marka_gyarto` | brand token found in the name; else the DANIELLA code prefix | high; 40 rows left empty (house cable codes `KAB*`/`VEZ*` etc.) |
| `gyartoi_cikkszam` | vendor code minus the brand prefix, **kept only if that remainder also occurs in the product name** (normalised, case- and punctuation-insensitive) | high by construction; 52 rows left empty rather than guessed |
| `becsult_brutto_ar_huf` | net × 1.27 | arithmetic only — VAT rate assumed 27% |
| `kategoria_javaslat_*` | ordered keyword rules over the product name | **provisional**, 220/221 assigned, 1 unclassified (`WEI9037330000`, name unknown) |
