# Varler Workflow Kit — agent init
*For a Claude Code session that will work on the quote workflow. Read this, then the files in §3.*
**Felelős:** Charlotte, Finance and Contracts

## 1. What it is
The portable quote workflow built from the NV4 job: question funnel, takeoff, pricing, document build
and a post-hoc market measurement. It produces a Költségvetési Tervezet and an Árajánlat. Its final
target is other Claude sessions and other users' Claude Code, so the finished kit carries no H:\ paths.

## 2. Where
- `H:\VRG\Full\Varler_Workflow_Kit`: outside the repo and **not a git folder**. BACKUP mirrors it.
- `01_nv4_build/pipeline/nv4/`: `takeoff.js` → `price.js` → `offer.js` → `build.js` → `offerdoc.js`.
- `01_nv4_build/02_golden_nv4/`: the 12 golden PDFs, spec, protected text, variation rules.
- `02_question_funnel/`: `funnel.json` (rules), `02_question_funnel/tools/funnel.js`, `FUNNEL_BRIEF.md`.
- `market/`: `market.js`, `MARKET_BRIEF.md`, dated `providers_*.json`.
- `agents/vrg-piacmero.md` is the agent's source. No START entry.

## 3. Read first
1. `README.md`
2. `01_nv4_build/RULES_CODEWORK.md` — §8 is the pricing rules
3. `02_question_funnel/FUNNEL_BRIEF.md` for a job, `market/MARKET_BRIEF.md` for market work
4. `DEV_LIST.md`, `DECISIONS_L1-L18.md`
5. `ADDENDUM_ar-es-ado_2026-10-31.md` — early pricing against the current rules, open wording gaps

## 4. Build / test / check
```bash
node market/market.js compare          # also: structure, calc-block
node agents/install.js <dir>/.claude/agents --check
```
The funnel steps and their commands are in `FUNNEL_BRIEF.md`. Do not re-run Monte Carlo to read a number:
read `price.json` or `offer.json` (`RULES_CODEWORK.md` §7).

## 5. Rules and traps
- Offer level is Monte Carlo P50; a band may clamp it; 5 000 Ft step; clean unit prices (RULES_CODEWORK §8).
- Materials: gross price + 10 % handling, expected ±10 %, settled by invoices; deposit 80–100 %
  10 workdays before the first site day (RULES_CODEWORK §8).
- Never "improve" protected text; propose, don't apply (RULES_CODEWORK).
- Never invent questions or defaults outside `funnel.json` (FUNNEL_BRIEF).
- Market results stay internal and never change the quote (MARKET_BRIEF).
- User-facing kit text: Hungarian first, English in italics below (memory, DL-1).

## 6. Current state
- Steps 1–4 done; step 5 in progress (funnel rules v1.2, L-1…L-18); step 6 packaging not started;
  step 7 later. Market measurement done 2026-10-25 (README).
- The pipeline still uses absolute H:\ paths (README). Decision files: `DECISIONS_L1-L18.md`.

## 7. Do not touch
- `01_nv4_build/02_golden_nv4/`: the reference for every check.
- `00_precursors/calculator` holds other clients' named quotes: exclude or anonymise before the kit
  leaves this machine (README).

Forrás: Varler_Workflow_Kit/README.md, 01_nv4_build/RULES_CODEWORK.md, 02_question_funnel/FUNNEL_BRIEF.md, market/MARKET_BRIEF.md, 2026-10-31
