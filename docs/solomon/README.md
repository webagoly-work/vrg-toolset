# Solomon: the three-signal check over our knowledge

*Internal name, never for client material. The page is called **Gömb** in the Hungarian UI. Built 2026-11-01 from the
concept on rehoboam.it (MiraiLab, alpha). No code, text or artwork of theirs is used; the site states no licence and we
did not read its scripts. We took the idea and wrote our own. In the show, Solomon is Rehoboam's predecessor.*

## 1. What we took from the concept

| Their idea | Our version |
|---|---|
| Every statement keeps its source | Every signal quotes its file and line. The script does the quoting, so nobody can paraphrase a source into saying something else |
| It warns when two things cannot both be true, and does not decide | The script and the intern raise it; only the Founder rules |
| A ruling is written down with its date | `Solomon/data/rulings.jsonl`, append only |
| A map of knowledge as a sphere of dots grouped by topic | One dot per real document, one island per section |
| It never changes a page without approval | Nothing in Solomon writes to a source file, ever |

We did not take their ingest pipeline, voice questions or chat. Our knowledge is already Markdown and JSON in Git, and
Git gives us something a notes app lacks: the date of every change.

## 2. The three signals

| Signal | Means | Comes from | On the sphere |
|---|---|---|---|
| **Ellentmondás** (contradiction) | Two statements cannot both be true | A value for the same term that differs between documents, the catalogue against the Planner's endpoint table, or the intern's report | The only red: two pulsing dots and an arc. A candidate is a faint outline until the intern confirms it |
| **Sötét zóna** (dark zone) | A gap | An open question nobody answered, a reference to a missing document, unfinished marks, a document with no bridge to the rest, a failing validator | A sand ring |
| **Dermedt** (frozen) | Dormant, not wrong | `alvó`: no change or review in 45 days. `lemaradt`: a document that cites one which changed after it | A dotted ring |

`lemaradt` is our addition and matters most for BRIDGE: a standard changes, and whatever was built on it is now behind.
A frozen page that three or more documents cite is a keystone and is listed first.

## 3. The ladder

```
script finds  →  Caleb judges  →  the Founder rules
 candidate        confirmed         first | second | coexist, why, date
                  dismissed
                  unsure (stays a candidate)
```

- **The script** is free and runs often. It finds and quotes.
- **Caleb** (Gyakornok, worker tier, Haiku, low effort) takes one section per run. He judges up to 12 candidates, reads
  the most-cited documents for clashes the scan cannot see, and reports them by `file:line`.
- **The Founder** rules on the page, or with `node tools/solomon.js rule`. A ruling silences that signal; the sources stay
  as they are. Fixing a document is ordinary work, handed to its department.

## 4. Rules for agents

Every Council agent follows these. The ladder has no shortcut.

1. **Never rule.** Agents flag. "The first holds" belongs to the Founder alone, and an agent's message never counts as
   that ruling (charter, §3).
2. **Never edit a source to clear a signal.** A signal is a reason to look. Clearing it by rewriting the document hides
   the disagreement.
3. **Quote, don't paraphrase.** A report is two `file:line` references. If it cannot be pointed at, it is not a finding.
4. **Red is earned.** Confirm a contradiction only when both lines speak of the same thing, in the same scope, and cannot
   both hold. Variants, ranges, superseded drafts marked as such, and different products are not contradictions.
5. **Frozen is not a fault.** Nobody "fixes" a frozen document by touching it. Reviewing it resets the clock.
6. **Archived material stays.** `docs/go-archive`, old job documents and the DNA material are outside the scan. Note them,
   never correct them.
7. **No client data.** The scan reads tracked files only. Client job folders and the Workflow Kit are not read, so
   `Solomon/data` stays safe to track. `node tools/anonymise.js` runs before any push as usual, and `publish` checks the
   three data files itself before its own push.
8. **Heads read their island.** Before a Head plans work in a department, it runs `node tools/solomon.js next` or reads
   the page for open red and `lemaradt` signals there, and names them in the plan.
9. **Budget.** One section per run, 12 candidates at most. Caleb does not spawn anyone. Anything larger goes to Bernard.

## 5. Commands

```bash
node tools/solomon.js scan
```
```bash
node tools/solomon.js next
```
```bash
node tools/solomon.js intern
```
```bash
node Solomon/serve.js
```
```bash
node tools/solomon.js publish
```

The server, also START → O → T, runs the page at http://localhost:8799, where the ruling buttons save directly. It also
brings in the phone's rulings when it starts. Opened as a file, the page gives you the command to copy. Caleb's own
commands are `flag`, `report` and `done`; see the top of `tools/solomon.js`.

## 6. The routine

Scheduled task **solomon-intern**, Monday at 07:40, runs `node tools/solomon.js intern` on the desktop app: Caleb takes one
section, then the script publishes the results. Sections go oldest review first, so BRIDGE comes round first and with
11 sections the full cycle takes about eleven weeks. If the app is closed, the run happens on the next launch. Its first
run may stop on a permission prompt until the task has been started once with Run now in the app. Each run spends a
small amount of the Pro window: one Haiku pass plus the scheduler's short wrapper session.

## 7. Data

| File | Written by | Tracked |
|---|---|---|
| `Solomon/data/signals.json` | `scan`, regenerated | Yes; this is what the phone and the city read |
| `Solomon/data/reviews.jsonl` | Caleb | Yes |
| `Solomon/data/rulings.jsonl` | The Founder, on the PC or the phone | Yes, append only |
| `Solomon/dist/vrg-solomon.html` | `scan`, from `Solomon/src/index.html` | Yes, as the other tools do |

Signal ids are hashes of what was found. If the text changes, the id changes, and an old ruling stops covering it. That
is on purpose.

**The `solomon-data` branch** (SOL-Q2 = B) is how the results leave this PC. It has a history of its own and holds only
those three `Solomon/data` files, so a push cannot carry anything else. `publish` builds the commit without a checkout
or a branch switch, so it can run while other sessions work on `main`.

- Before each push it takes in any ruling the phone added, rescans, and runs `anonymise.js --check` on the three files.
  A client code stops the push.
- If the phone rules between the fetch and the push, Git rejects the push and `publish` starts again. It never forces.
- Without a link to GitHub the run reports it and the data stays here for the next run.
- A ruling made on the PC reaches the phone with the next run, or with `publish`.

## 8. Using the signals elsewhere

`signals.json` keys every signal to document paths, so another view needs no scanner of its own:

- **Kódváros:** a building's document can pulse red, ring sand or go dotted. Colour stays within Mélyvíz: red already
  means critical. Not built, because the Homeland session is working in `CodeCity/`.
- **VRG Mobile:** the swipe page beside the home screen, `docs/mobile/WP/M14.md`. It reads `solomon-data` and rules on it.

## 9. Decisions

In [DECISIONS.md](DECISIONS.md).
