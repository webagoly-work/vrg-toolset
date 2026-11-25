# VRG Előszűrő (Prefilter)

An offline judgement on a prompt **before** it starts a new Claude Code session. It answers one question:

> Does this prompt lean on the VRG world (an earlier work line, the repo, a job, the Stack), or is it a new, independent request?

Then it **dresses** the prompt: a short header before the user's text and an expected-output line after it, so the session starts
with the right harness: look locally first (VRG Stack, the matching `GO-*.md`, named files) or, for an independent request, do *not*
load VRG context at all. It also suggests a model tier (`haiku` / `sonnet` / `opus`) for economy.

No network, no model call, ~10 ms per prompt once the index is loaded.

## Use

```js
const pf = require('./Prefilter/prefilter.js');
const index = pf.loadIndex({ repo, full });          // cached in Prefilter/.cache/index.json (gitignored), rebuilt when a source is newer
const a = pf.analyze(text, { index, attachments: [{ name: 'Plan_01.vrgp', ext: 'vrgp' }] });
const d = pf.dress(text, a, { mode: 'auto' });       // 'context' | 'independent' | 'unsure' forces a template (the user's override)
// d.prompt is what the new session gets as its first prompt; d.parts.user === text, always verbatim
```

```bash
node Prefilter/cli.js "GO MOBILE folytasd az M16-ot"
node Prefilter/cli.js "nézd át ezt" --attach Plan_01.vrgp --json
node Prefilter/cli.js --stats --rebuild
node --test Prefilter/test/prefilter.test.js
```

### `analyze(text, { index, attachments?, prior?, rules?, now? })`

```
{ verdict: 'context' | 'independent' | 'unsure', score: 0..1, threshold: { context, independent },
  intent: 'build' | 'fix' | 'review' | 'plan' | 'ask' | 'continue' | 'research' | 'other',
  signals: [{ kind, text, weight, ref? }],      // kind: codephrase job branch path file catalog tool feature stack term deictic intent
  anchors: [{ id, title, kind, source }],       // the few things the prompt points at (≤ dress.maxAnchors)
  model: 'haiku' | 'sonnet' | 'opus', reasons: [string], ms }
```

### `dress(text, analysis, { mode? })` → `{ prompt, parts: { before, user, after }, length, overhead, verdict }`

The user's text is never changed and never interrupted: nothing is inserted *inside* it. Everything the filter adds is in `before`
and `after` (≤ `dress.maxOverhead`, 1500 characters).

## How it decides

1. **Index** (`buildIndex`): the VRG world's own vocabulary, read locally.
   | Source | What it gives |
   |---|---|
   | `launcher/vrg-catalog.json` | entities: every item's id, Hungarian and English title (kind `catalog`) |
   | `launcher/vrg-menu.json` | entities: START tools, projects, dev items, servers (kind `tool`) |
   | `CLAUDE.md` | headings, section text, the **old codephrases** (`WIRE → GO ROUTE`, …) |
   | `GO-*.md` | one codephrase each (`GO MOBILE` → `GO-MOBILE.md`), headings, section text |
   | `docs/**/*.md` | file / folder names and headings (no bodies) |
   | `Stack/out/stack.sqlite` (when built) | node titles (entities of 2–6 words) and briefs, read only |
   | `<Full>/notes/features/features.json` (H: only) | feature titles (kind `feature`) |
   | `<Full>/jobs` (H: only) | job codes (`CLA001`). Client-related, so the cache is gitignored |
   | `git ls-files`, `.git/refs` | repo paths and file names, branch names |

   Three word tiers: the **lexicon** (words of entity names, codephrases, top folders), **headings**, and **bodies**.
2. **Words**: accent-folded (`Rétegverem` = `retegverem`), one Hungarian ending stripped (`Plannerben`, `Planner-t` → `planner`;
   `kapuban` → `kapu`), an English plural `-s`. `common-words.json` is the general-language baseline: those words never count.
   `rules.json → genericTech` lists VRG names that are also everyday tech words (`web`, `files`, `terminal`, `mobile`, …): alone
   they never anchor, inside a longer name they do (`VRG Mobile`).
3. **Signals** and their weights (`rules.json → weights`):
   - a codephrase `GO X` (0.95) or an old alias typed in capitals (`WIRE`);
   - a job code typed as is (0.85), a branch name (0.8), a repo path (0.8), a known file name (0.75), an unknown file (0.25);
   - an entity name as a phrase: catalog 0.6, START 0.55, feature 0.5, Stack 0.4 (× 0.6 when it is a single word);
   - a corpus word: lexicon 0.42, heading-only 0.14, body-only 0.08; × 1.25 when it is capitalised inside a sentence ("a Kapu");
     × 0.35 when more than 35 % of the corpus units use it; only the 4 strongest count; words inside a matched path are skipped;
   - continuation words (`folytasd`, `ahol abbahagytuk`, `az előző`, `continue`, `last time`: 0.38; `ezt`, `it`: 0.12);
   - attachments: a file the repo has (0.7), a VRG file type (`vrgExts`, 0.4), anything else (0.12);
   - the intent itself (0.05).
4. **Score** = noisy-or `1 − Π(1 − w)`: one strong signal or several weak ones. `≥ 0.55` context, `< 0.3` independent, between
   unsure.
5. **Intent**: the `rules.json → intents` list with the most hits (Hungarian stems end in `*`: `javit*` matches javítsd, javítás).
6. **Model**: `models.byIntent` (plan / research → opus; build / fix / review / continue → sonnet; ask → haiku); a short independent
   question → haiku; a narrow, anchored build/fix/review never needs opus; a prompt over 900 characters goes up a step.

## The three templates (`rules.json → dress`)

- **context**: intent + model; "ask the VRG Stack first" with a ready query built from the strongest signals; the matching
  `GO-*.md` section; the likely anchors with their source; CLAUDE.md; "never read Stack/out/stack.json or whole large files".
  After: the expected output form for that intent.
- **unsure**: the possible anchors and one cheap check (a single Stack search); no hit → treat it as independent.
- **independent**: do not load VRG context, do not search the Stack or the repo unless the request needs it.

All template text is Hungarian and lives in `rules.json`; `{intent_hu} {model} {stack_query} {go_line} {anchor_lines}
{anchor_list}` are filled in. Tune weights, thresholds, word lists and templates there; no code change needed. Run the tests after.

## Negation and work-line memory (2026-11-25)

- **Negation** (`rules.json → negation`): a name within `window` tokens after *ne, nem, sem, nincs, not, no, without, except, never,
  kivéve…*, or just before *nélkül*, stays a signal at `factor` × its weight and is never an anchor. "ne a Plannerről, hanem a napelem
  inverterről" → independent.
- **Prior** (`analyze(text, { prior: { text?, title?, anchors? } })`, `rules.json → prior`): a prompt with a continuation word and no
  signal of its own (≥ `ownMin`) takes up to `maxAnchors` anchors of the previous session as one `prior` signal (`weights.prior`). The
  Vezérlő passes the most recent local session's first prompt; the hook passes the anchors the session has collected so far.

## The hook: every session, not only the Vezérlő's (`hook.js`)

A Claude Code `UserPromptSubmit` hook. The first prompt of a session gets its verdict's dressing as `additionalContext` (the prompt
itself is never changed or blocked); later prompts are quiet unless they bring a new named thing (catalog, codephrase, job, path,
branch; the prompt judged context) or turn an independent session towards VRG: then a two-line "új horgony" note with one Stack search.
Skipped: prompts the Vezérlő already dressed, slash commands, `VRG_PREFILTER_OFF=1`. State: `.cache/hook/<session>.json`; log:
`.cache/log.jsonl` (metadata and a hash, never the text). Any error → no output, exit 0.

```bash
node Prefilter/hook.js --test "GO MOBILE hol tartunk?"      # what the hook would add
node Prefilter/hook.js --install --dry                      # the settings entry (absolute node + script paths)
node Prefilter/hook.js --install                            # into this repo's .claude/settings.json (--user: ~/.claude/settings.json)
```

Installed in the repo's settings it runs for every session started in this repo; `--user` makes it run everywhere. Not installed yet:
the Founder decides (handoff `docs/handoff/2026-11-24_munkamenetek-H.md`).

## Evaluation (`eval.js`)

```bash
node Prefilter/eval.js run --set seed --misses   # the committed, made-up set (eval/seed.jsonl, 44 prompts)
node Prefilter/eval.js extract                   # the first prompt of every local session → .cache/eval/candidates.jsonl
node Prefilter/eval.js label                     # label them: c / i / s / q → .cache/eval/labels.jsonl
node Prefilter/eval.js fit --set all             # the thresholds with the lowest weighted cost (--write to save them)
```

Weighted cost: a context prompt judged independent costs 3 (a failed first turn without the rules), the reverse 1 (tokens), unsure
0.3 / 0.7. A route forced in the Vezérlő against the verdict is saved as a label too. Your own prompts stay in the gitignored cache.
Seed set today: 0.886 accuracy, no context → independent mistake; `fit` on it alone suggests context ≥ 0.35, which is NOT applied:
44 made-up prompts are too few to move a threshold; fit on your own labels.

## Known limits

- Negation is a window rule, not syntax: "nem csak a Plannerről" (not only about the Planner) is read as a negation too.
- The stemmer is a single suffix strip; irregular stems (`lépés` / `lépését`) and compounds (`routertervező`) can miss.
- A file name that exists in several folders points at the first (`sessions.js`).
- The prior is the most recent session, which may not be the line you mean; the Vezérlő's preview shows which one it took.
- Without the Stack DB and the H: sources (the cloud), the vocabulary is the repo's documents only.
