# Munkamenet-tábla, Vezérlő, Előszűrő: the choices made and where to take them

*2026-11-24, cloud session. Builds on the sourced notes in `2026-11-24_prompt-prefilter-research.md` (read that for the links).
What was built: WP-50 Munkamenetek, WP-51 the board labels, WP-52 the Vezérlő + `Prefilter/`, and `shared/sidepanel/`.*

## 1. The board: a separate board, or a Desktop Lap?

| | A. A separate board inside the Munkamenetek pane (looks like the Lap) | B. A Desktop Lap with board labels (**taken**) |
|---|---|---|
| Terminals | a second host for xterm panes inside a pane; the term pane would need a nested mount | the existing term pane, unchanged; `adoptTerm` already lands a resumed session on the Lap |
| claude.ai/code windows | native WebContentsViews placed inside a pane inside the grid: a second rect-reporting layer | the browser pane as it is; the frame already places its views by the tile's rect |
| Layout ops | re-implement open / tile / resize / swap / max | all of WP-46 for free (4 × 4, swap, max, move to another Lap, presets) |
| Persistence | a second doc format | `desk.sheets`, one optional key per window (`deco`) and per sheet (`board`), strictly validated |
| Reach | only inside Munkamenetek | **any** Lap can turn its labels on (sheet tab → Tábla-címkék): a DevLap with labelled windows, a client Lap with notes |
| Cost | weeks, and two layouts to keep in step | ~300 lines (model + page + CSS) |

What B needed was small. Labels are data on the window, not a new layout: `label(sheet, win, auto)` merges three layers.
1. The board's four switches: Eredet (origin), Színkeret (colour frame), Cím (title), Megjegyzés (note).
2. The window's own values and overrides, set from its right-click menu.
3. What the pane reports:
   - a `claude-a`/`claude-b` terminal is **Helyi · A/B** (local, account A/B), titled with the title Claude Code sets;
   - a browser on claude.ai/code is **Felhő** (cloud);
   - **Gép: \<név\>** (another machine, by name) is set by hand for a Remote Control session on another computer.

The Munkamenetek **Tábla** button opens (or makes once) the session board: the Vezérlő across the top row, the list on the left,
the sessions filling the rest.

**What A would still be good for:** a read-only "wall" of many sessions at once (more than 16, thumbnails, no input). That is a view,
not a workspace, and it fits better as a Munkavászon mode than as a second grid.

## 2. The Vezérlő and the Előszűrő as built (v0)

`prompt → Előszűrő (offline, ~10 ms) → verdict + dressing → a NEW Claude Code session` (`claude --model <tier>` in a folder chosen by the verdict).

- **Signals:** VRG names weighted by how specific they are to this corpus: the catalog, START, codephrases, Stack titles, doc headings, folders. Also file names and paths, job codes, branches, continuation words ("folytasd", "az előző") and attachments. A light Hungarian suffix stripper lets "Plannerben" match "Planner". The signals combine as `1 − Π(1 − w)`.
- **Verdict:** context (score ≥ 0.55) · unsure · independent (score < 0.3). All rules, weights and templates are in `Prefilter/rules.json`.
- **Dressing:** everything goes before or after the user's text, never inside it.
  - A context prompt gets where to start: one Stack search, the matching GO file section, the likely anchors, and "do not read whole large files".
  - An independent prompt gets "no VRG context".
  - An unsure prompt gets the candidate anchors plus "one cheap Stack search first".
- **Economy that is real today, not just text:**
  - An independent request starts in `Full\home\claude-free`, a folder with no CLAUDE.md, so Claude Code does not load the repo's rules at all.
  - `--model haiku|sonnet|opus` follows the intent: plans go to opus, narrow fixes to sonnet, short questions to haiku.
- **Override:** in Részletes mode the user can force the route (VRG-kontextussal / Önálló) and the model; the live preview shows exactly what will be added.

## 3. Where it can go: a pipeline, not a gate

The gate is stage 1 of five. Each later stage reuses the same index and rules:

| Stage | When | What it decides | Mechanism |
|---|---|---|---|
| 1. Gate (built) | before the first prompt | context or not, model, start folder | the Vezérlő → `Prefilter/` |
| 2. Hook | every prompt, every session | the same verdict for sessions not started from the Vezérlő (the CLI, the Claude app, the phone) | a `UserPromptSubmit` hook running `Prefilter/cli.js --hook` (`additionalContext`, ≤ 10 000 chars; it cannot switch the model, as far as the docs say) |
| 3. Drift | mid-session | "this prompt now needs the Stack" / "this one left VRG" | the same hook comparing the prompt's anchors with the session's so far |
| 4. Outcome | session end | was the verdict right? | a label from what happened: overridden in the Vezérlő, a model escalation, the session's token count, the user's 👍/👎 in Munkamenetek |
| 5. Learning | weekly, offline | thresholds and weights | refit the two thresholds on the labels (one dial, as RouteLLM does), report drift |

### Vectors, by value over effort

*Status 2026-11-25 (WP-53): 1 built, not installed (`Prefilter/hook.js`); 2 kept as the rule; 3 built (`prior`); 4 the tooling and a
44-prompt seed set built, the Founder's own labels still to come; 7 built (Munkamenetek → Erősebb modellel); negation built.*

1. **The hook (stage 2).** This brings the economy to every session, not only to the ones started from the Vezérlő. Ship the hook in a disabled state and turn it on per account. *Effort: small. `cli.js` already prints the dressing.*
2. **Pointers, not content.** Keep dressing with ids and paths, never pasted Stack text. Pasted text arrives with system-reminder authority, which makes it an injection risk, and it leaks client data online. *Rule now; the templates already follow it.*
3. **Workline memory for "folytasd".** A lone continuation word is the weakest case. Pass the last session's anchors (Munkamenetek knows them: its title, branch and folder) as a prior, so "folytasd" resolves to that line. *Small: one field in `analyze()`.*
4. **A labelled evaluation set.** 60–100 real prompts in Hungarian and English, taken from the transcripts Munkamenetek already reads (the first prompt of each session). Have the Founder label them once and run them in `Prefilter/test` on every change. *Medium. Without it, every weight change is guesswork.*
5. **FTS5/BM25 against the Stack** as the specificity measure, instead of tiered word lists, on H: where the Stack's SQLite exists. *Medium. Better recall on job names and decisions.*
6. **Intent templates for the output form** (fix: change + test run; plan: options + decision; review: findings ranked). These templates exist now; measure whether they shorten sessions.
7. **A model cascade.** Start at the suggested tier; when the first turn fails or the user takes over, offer "folytatás erősebb modellel" (continue with a stronger model) as a Munkamenetek action: `--resume` with `--model opus`. *Small, and it is the FrugalGPT idea without any learning.*
8. **Session ↔ workline linker.** Tag every session with the anchors of its first prompt, so the Munkamenetek list can group sessions by work line and the Vonaltérkép can show the sessions on each line. *Medium.*
9. **A local embedding fallback** (model2vec, a ~30 MB static multilingual model, CPU only) for prompts that hit no word at all yet are about VRG ("az a lámpás dolog a nappaliban"). Test it on Hungarian first. *Medium–large.*
10. **Budget prediction.** Log the prompt length, the verdict and the session's tokens (all already in the transcripts) and see whether the verdict predicts cost. If it does, show "≈ kis / közepes / nagy munka" (small / medium / large job) before Küldés. *Logging is small; the model is unknown.*
11. **The second Vezérlő section** (yours): a natural home for stage 4's 👍/👎, the cascade button and the running sessions' budget.

### Risks to keep in view

- **Misrouting cost is asymmetric.**
  - A wrong "independent" verdict costs a failed turn on a weak model.
  - A wrong "context" verdict only costs tokens.
  - So the thresholds lean towards context, and "unsure" starts in the repo.
- **Over-harnessing.** Templates say "kezdd" (start with) and "javasolt" (suggested), not "csak" (only); the session can still decide otherwise. Watch the eval set for answers that got worse.
- **Negation.** "ne a Plannerről" ("not about the Planner") still anchors on the Planner. Negation needs a rule pass before the stemmer.
- **Silent failure.** A hook that times out lets the prompt through bare. Log every timeout, and keep the index cached (113 ms to load) so the hook stays far under its 30 s limit.
