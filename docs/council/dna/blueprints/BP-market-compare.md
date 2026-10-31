# Blueprint: market comparison of a finished quote

*Level L3, worked example. Rebuilds `compare` in `Varler_Workflow_Kit/market/market.js`, read 2026-10-31. A rebuild is faithful when it
passes §6 in any language. Competitor names and client data are not in this file, and a report built from it stays internal.*

## 1. Purpose

Take a finished job's labour lines and price the same work with published price lists, so the owner can see whether the labour
total sits inside the market. It never changes the quote.

## 2. Inputs

```text
offer:     O.A.labour.lines[]    { model, name, qty, unit, unitPrice, h }   h = norm hours
           O.A.labour.total      our labour total
           O.A.material.lines[]  { name, qty }
           O.A_M2                floor area
providers: vat, hourFallback, items{}, pointRates[], m2Bands[]
           providers[] { id, basis, prices{item: price}, point?, m2?, m2Material? }
```

`basis` is `gross`, `net`, `kata`, `aam` or `unknown`. All money is compared **as the client pays it**: `paid(v) = v × vat` only when
the basis is `net`, otherwise `v`.

## 3. Algorithm

1. **Price table.** Convert every provider price with `paid`.
2. **Band.** For each item, over the providers that list it: `lo`, `median`, `hi`, `n`. The median of an even count is the mean of the middle two.
3. **Map lines to items.** Walk an ordered rule list; the first regex matching `line.model` wins. A rule gives: `item` or none, `incl`
   (priced inside another item), `point` (counts as a kiállás point), `cover` (covered by a kiállás price), `basic` (covered by an m²
   price), `fam` (chase family), `minus` (a family to subtract), `qty` override. No matching rule means the line has no market item.
4. **Quantity fixes.**
   - A `klt` line whose name ends `(<n> m)` uses `n` as its quantity, when it has an item.
   - For each family, `power` and `data`: sum the quantities of chase lines, then subtract that sum from every line with `minus` of that
     family, floored at 0. Reason: the market chase price already includes one pipe.
5. **Price one line for one provider**, in this order:

   | Case | Value | Mark |
   |---|---|---|
   | `incl` is set | 0 | `=` |
   | no item | `h × hourFallback` | `•` |
   | provider lists the item | `price × qty` | none |
   | another provider lists it | `band.median × qty` | `◦` |
   | nobody lists it | `h × hourFallback` | `•` |

6. **Three model families.**
   - **Itemised (R1), one per provider:** sum all lines. `cover = own / total`, where `own` is the unmarked part.
   - **Point (R2):** `points × rate + notPoint`, where `points` is the sum of `qty` over `point` lines, and `notPoint` is the median-provider
     value of lines that are neither `cover` nor `point`. One row per provider with a `point` price and per `pointRates` entry.
   - **Area (R3):** `area × m2 + notBasic`, where `notBasic` is the median-provider value of the lines that are not `basic`.
7. **Result.** Take R1 models with `cover ≥ 0.5`, plus all of R2 and R3. Report their median, min, max and count. A provider under 50 %
   own prices is shown but does not count.

## 4. Constants that matter

| Constant | Value | Why |
|---|---|---|
| Itemised model cut-off | `cover ≥ 0.5` | Below that a model is mostly filled-in gaps |
| Rule order | first match wins | `^Adathorony` must come before the general chase rule, and `Kábelbehúzás (NYM-J)` before `Kábelbehúzás` |
| Data freshness | offer a refresh past 60 days | Brief §3 |

## 5. Rules of use

- Numbers come from this algorithm, never from a model's head.
- A missing or wrong mapping rule is proposed, never silently fixed.
- `offer.json` is never overwritten, and the result never goes into a client document.

## 6. Test vectors

Provider A, basis `net`, lists `socket = 1000`. Provider B, basis `gross`, lists `socket = 1500`. `vat = 1.27`, `hourFallback = 10000`.

| # | Case | Expected |
|---|---|---|
| 1 | `paid` for A's socket | 1270 |
| 2 | Band of `socket` | lo 1270, median 1385, hi 1500, n 2 |
| 3 | 10 socket points, provider A | 12 700, no mark |
| 4 | Same line, a provider without `socket` | 13 850, mark `◦` |
| 5 | A line with no rule and `h = 2` | 20 000, mark `•` |
| 6 | A line with `incl` | 0, mark `=` |
| 7 | Power chase 5 m + `Védőcső` 12 m with `minus: power` | conduit quantity 7 |
| 8 | Power chase 15 m + `Védőcső` 12 m | conduit quantity 0, never negative |
| 9 | `klt` line named `... (6,5 m)` with an item | quantity 6.5 |
| 10 | Provider with own 40 and gap 60 | `cover = 0.4`, excluded from the median |

*Checked 2026-10-31: vectors 1–4 were computed with the same median and VAT formula as `market.js`, and the rules behind vectors 5–10 were found
in its source. `market.js` itself was not run on these inputs, and no one has yet rebuilt the feature from this page. That rebuild is the real test.*
