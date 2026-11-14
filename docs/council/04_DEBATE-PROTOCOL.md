# Seat debate — Vita a székek között

*2026-11-14. Bernard runs it. The idea comes from 0xNyk/council-of-high-intelligence (MIT): a fixed round budget and evidence
tags. We read its README only and wrote this from scratch. Checked by `tools/council-debate.js`.*

A debate is for **one decision where two or three seats see it differently**: a trade-off between departments, a choice the Founder
wants argued before choosing. It produces a recommendation and an A/B/C row in `DECISIONS.md`. The decision stays the Founder's
(charter §3).

**Don't debate** a question that has a test, a measurement, a price list or a standard behind it: look it up (Akecheta, Teddy) or
measure it. Don't debate a question that only one seat's domain touches: that Head decides and reports.

## 1. Cost and approval

| Debate | Calls | Class |
|---|---|---|
| 2 seats | 6 seat calls (Opus, high) | **G3 until COUNCIL-Q9 is answered**, then as decided |
| 3 seats | 9 seat calls | same |
| + counter-case | 1 Theresa call (Sonnet) | included |
| 4+ seats, or a second cross-examination | | always G3 |

Bernard checks `get_usage` first. Each seat answers in at most 15 lines, so most of the cost is the seats' own reading. Point them
at line ranges, `vrg-ctx` and the Stack.

## 2. Evidence tags — bizonyíték-címkék

Every claim in rounds 2–4 is a bullet that carries one of these:

| Tag | Magyarul | Means | Must say |
|---|---|---|---|
| `[FACT: source]` | tény | Checked in this session | Where: `path/file.md:12`, a URL, a command and its output, a measurement with its date |
| `[INFERENCE: from …]` | következtetés | Follows from named claims | What it follows from |
| `[ASSUMPTION]` | feltevés | Taken as true without a check | Nothing; being named is the point |
| `[UNKNOWN: how to find out]` | ismeretlen | Needed and not known | Who or what would answer it |

A FACT from memory is an ASSUMPTION. A FACT whose source is a repo path must point at a file that exists, and at a line inside it;
the checker opens it. Words like *clearly*, *always*, *nyilvánvaló*, *biztosan* on anything but a FACT get a warning: certainty
has to come from evidence, not from tone.

## 3. The five rounds

Record: `docs/council/debates/<date>_<slug>.md`. Start it with:

```bash
node tools/council-debate.js new pairing-code --seats elsie,charlotte --question "One pairing code or two?"
```

| Round | Who | What |
|---|---|---|
| **R1 Restate** | Bernard | `Question:`, `Options:` (A/B/C), `Out of scope:`, `Done when:`. If the request came in loosely, show R1 to the Founder before spending anything |
| **R2 Positions** | each seat, **in parallel, as fresh subagents** | `Stance:` plus 2–6 tagged claims. No seat sees another's position |
| **R3 Cross-examination** | each seat, **resumed with `SendMessage`** | At least one `- Challenge → <other seat>: [TAG] …` against the weakest claim of another seat. New evidence only |
| *counter-case* | Theresa | **Only when R2 was unanimous:** the strongest case for another option, under `### counter-case (theresa)` |
| **R4 Final stances** | each seat, resumed again | `Stance:` and either `Kept because:` or `Changed because:`, plus any new tagged claims |
| **R5 Verdict** | Bernard alone | `Decision:`, `Dissent:`, `Rests on assumptions:`, `Unknowns:`, `Kill criteria:`. No new claims |

Then:

```bash
node tools/council-debate.js check docs/council/debates/<file>.md
```

and the A/B/C row in `DECISIONS.md` (§5). Close the round with Clementine as usual.

### Prompts

**R2**, the same text to every seat, each in its own call:

```text
Seat debate, round 2 of 5: your independent position. The other seats answer separately and you will see their positions next round.
Question: <R1 Question>   Options: <R1 Options>   Out of scope: <…>   Done when: <…>
Answer in at most 15 lines, exactly this form:
Stance: <one option letter>
- [FACT: path:line | URL | command and output] a claim you checked in this session
- [INFERENCE: from which claim] what follows
- [ASSUMPTION] what you take as true without checking
- [UNKNOWN: how to find out] what you would need to know
2 to 6 bullets, one tag each. Something you remember but did not check is an ASSUMPTION. Do not move toward the stance you expect
the others to take. Read only what you need: line ranges, vrg-ctx, the Stack.
```

**R3**, with `SendMessage` to the same seat, so it keeps its own reading:

```text
Round 3: cross-examination. The other positions: <paste each seat's R2 verbatim>.
Attack the weakest claim of at least one other seat: "- Challenge → <seat>: [TAG] why it fails". A wrong tag is a fair target
(an ASSUMPTION written as a FACT). Bring new evidence; do not repeat your round 2 claims. At most 8 lines.
```

**Counter-case**, to Theresa, only when every R2 stance was the same:

```text
Every seat chose <X> for: <R1 Question>. Their positions: <paste>. Argue the strongest honest case for <the best other option>,
with the same four tags, at most 8 lines. You are not asked whether X is right; you are asked what X's supporters are missing.
```

**R4**, with `SendMessage` again:

```text
Round 4: your final stance. The challenges to you: <paste>. <The counter-case: paste.>
Stance: <letter>
Kept because: <one line>   or   Changed because: <one line>
Then only new tagged claims, if any. Changing your stance is a result, not a loss.
```

## 4. What the checker holds

`tools/council-debate.js check` fails a record when:

- the rounds are not R1–R5 in order, there are fewer than two seats, or `class:` (who approved the cost) is missing;
- a claim is untagged, or a FACT has no source, an INFERENCE no basis, an UNKNOWN no way to find out;
- a FACT path does not exist, or its line is past the end of the file;
- a seat in R3 challenges nobody, itself, or someone outside the debate;
- **R2 was unanimous and there is no counter-case** (agreeing too early);
- a seat changed its stance without `Changed because:`, or kept it without `Kept because:`;
- the verdict has no `Dissent:`, leaves out a seat that ended on another stance, has no kill criterion, or the debate used
  ASSUMPTION / UNKNOWN claims and the verdict lists none of them;
- `decides: COUNCIL-Qn` names a question that `DECISIONS.md` does not mention.

It warns (`--strict` fails on these too) about a stance with no FACT behind it, a claim repeated word for word from R2, sure-sounding
words on a non-FACT, "Dissent: none" with no reason, and a section over 15 lines. The tests are in
`tools/test/council-debate.test.js`.

## 5. Into DECISIONS

A question that came out of a debate gets its row as usual, plus three short lines under the table:

```text
COUNCIL-Qn rests on: ASSUMPTION nobody pairs more than two phones. Reverse if: a third phone gets paired.
Record: debates/2026-11-14_pairing-code.md
```

So a later reader sees which premises were never checked and when the answer stops holding. Any decision can carry the same lines,
debate or not.
