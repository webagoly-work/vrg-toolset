# Services — server builds, and what running them actually costs

*Everything here needs a service, a database or a container. Nothing here can be vendored into
this repository, and nothing here ships inside a VRG deliverable — these are things VARLER GROUP
would **run**, not things the tools would **contain**. For anything that fits in a single offline
file or runs at build time, see `components-offline.md`.*

Metadata read from the GitHub API on 2026-09-20. "Last push" is `pushed_at` (last code push),
not `updated_at`.

---

## The cost, stated before the list

Adopt three of these and you have quietly taken a second job as a sysadmin — Docker, a database,
updates, TLS certificates, and backups of the backup system — **as one person, alongside the
electrical work**. That is the real constraint on this page, not licence or quality.

So the order matters more than the list:

1. **Start with what adds no service at all.** `restic` (below) and Biome (in
   `components-offline.md`) add zero running infrastructure.
2. **Then one server, and make it Paperless-ngx** — best value-to-effort ratio, and it serves
   work already being done by hand.
3. **Everything else waits** until the first server has survived a few months of real use.

**A licence note that matters here and nowhere else.** Several of these are GPL-3.0 or AGPL-3.0.
That is irrelevant while you self-host them for your own business — which is the only use
contemplated here. It would matter if their code were ever mixed into a VRG deliverable handed
to a customer. Since none of these can be vendored anyway, the practical answer is: run them,
don't absorb them.

---

## Inventory — document handling

### `paperless-ngx/paperless-ngx` — GPL-3.0 — 45,518★ — pushed 2026-09-20 — **priority 2**

Scan, index, OCR and archive documents. Actively developed, very large community.

**Why it matters to us:** `Inventory/tools/` — `eml.js`, `pdf2.js`, `pdfrows.js`, `xlsx.js`,
plus `docs/SOURCES.md` to track provenance — **is a document management system written by hand**.
Paperless-ngx is that job already solved, with OCR, full-text search, tagging and correspondent
tracking. Its OCR has a Hungarian language pack (`hun`), which connects directly to the Latin-2
charset problem documented in `components-offline.md`.

**What it does not do, stated clearly:** it does not replace the extraction pipeline. The
Inventory needs *structured price rows* — `vrg-inventory.json`, `vrg-price-history.csv`,
`vrg-orders.csv` — and Paperless produces searchable text, not rows. The right division is that
Paperless becomes where the **source documents live**, and `tools/` keeps turning them into data.

`astubenbord/paperless-mobile` (1,462★) means a delivery note can be filed from the van, which
is the part that makes it stick.

### `eikek/docspell` — AGPL-3.0 — 2,331★ — pushed 2026-09-19 — **priority 3**

**Why it matters to us:** the alternative to Paperless, built explicitly around **e-mail
sources** — which matches the DANIELLA mail archive more directly than Paperless's
scanner-first design. Smaller community, Scala and Elm rather than Python and Angular.

Worth a look only if Paperless's e-mail ingestion turns out to be the weak point in practice.
Do not evaluate both up front; that is how neither gets adopted.

---

## Operations — the business itself

### `restic/restic` — BSD-2-Clause — 36,153★ — pushed 2026-09-20 — **priority 1**

Fast, encrypted, deduplicating backup. A single binary, **no service to run**.

**Why it matters to us — and this is the most urgent item on the page.** `Inventory/data/`
holds:

- `vrg-id-registry.json` — append-only, and the README says *"never edit by hand"*
- `vrg-price-history.csv` — every price point ever observed, per item per document
- `vrg-orders.csv` — every order line from every source document, the audit trail

That is irreplaceable business history built from an archive that may not be reconstructible,
and **no backup story appears anywhere in the repository**. Git covers the committed state on
GitHub, which is real but partial: it does not cover the working machine, the `*.pdf` source
documents that `.gitignore` deliberately excludes, or `Planner/apps/`.

Per-platform Go binary, so it cannot be vendored — it is a download, pinned by version, not a
repository file.

### `garethgeorge/backrest` — GPL-3.0 — 7,377★ — pushed 2026-09-14 — **priority 3**

Web UI and orchestrator for restic.

**Why it matters to us:** only if the restic command line is the thing stopping backups from
happening. It adds a service to run and **no new capability** — the backups are still restic's.
Take it as a convenience once restic is already working, never as the way to start.

### `frappe/books` — AGPL-3.0 — 4,975★ — pushed 2026-09-20 — **priority 2**

Accounting, inventory and invoicing. **Electron, offline, no server.**

**Why it matters to us:** it is the only business tool on this page that does not cost
operations, which given the constraint at the top makes it the one to evaluate first. Your
`Calculator/` price lists produce quotes, `Inventory/vrg-orders.csv` is a purchase record, and
nothing currently produces the invoice at the end. This closes that loop without a container.

Listed as `helyi-eszkoz` in the manifest rather than `szerver` for exactly this reason.

### `kimai/kimai` — AGPL-3.0 — 5,015★ — pushed 2026-09-17 — **priority 3**

Time tracking that produces invoices. Self-hosted, multilingual (Hungarian included).

**Why it matters to us:** narrow and light. If the missing link turns out to be specifically
"hours on site → invoice" rather than full accounting, this is the smaller tool and the better
fit. If the gap is wider than that, Frappe Books covers more for less operational cost.

---

## Considered and not carried forward

**`Dolibarr/dolibarr`** (7,637★, active since 2011) came up in the broader search as the closest
single system to what `Calculator/` and `Inventory/` are collectively edging toward — quotations,
suppliers, stock, orders, invoices, accounting, heavily multilingual, European. It is not in the
manifest because it is the **largest commitment on the table** and adopting it would mean
deciding that several VRG tools stop being the system of record.

That is a business decision, not a tooling one, and it should be made deliberately rather than
by installing something. Recorded here so it is not rediscovered from scratch.

---

## What would change these recommendations

- **If the backup question gets answered another way** (a NAS with snapshots, an existing
  offsite copy), restic drops off entirely and the page's priority 1 becomes Paperless.
- **If `Inventory/tools/` is retired** in favour of buying rather than extracting, Paperless
  becomes essential rather than useful.
- **If VARLER GROUP grows past one person**, the operational cost argument at the top weakens,
  and Dolibarr stops being disproportionate.
