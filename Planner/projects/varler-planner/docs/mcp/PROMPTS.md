# Planner MCP — prompts

Paste into a fresh Claude Code session started in `H:\Dev-VRG\VRG-DE\Planner_VRG_U100`.

## BUILD-ONE

```
Build WP-MCP-<n> of the Planner MCP pack.
Read, in order: Planner/projects/varler-planner/docs/PRIMER.md, Planner/projects/varler-planner/docs/mcp/00_CONTRACT.md,
Planner/projects/varler-planner/docs/mcp/README.md (§2 findings, §5 answers), Planner/projects/varler-planner/docs/mcp/WP-MCP-<n>_*.md.
DECISIONS.md: build option A unless README §5 records another answer.
Run the full suite once before your first edit and note what is already red.
Other sessions share this checkout: never git add -A, commit nothing unless I say so.
Stop at the README §3 checkpoint if this WP has one. Finish with the CONTRACT §9 report and set the
WP's line in README §4.
```

## VERIFY

```
Verify WP-MCP-<n> of the Planner MCP pack as a reviewer, not the builder.
Read Planner/projects/varler-planner/docs/mcp/00_CONTRACT.md and the WP's "Tests", "Verifier focus" and "Live check" sections.
Re-run its spec and the full suite; check golden 70/70 and check-globals. Then do the live check the WP
owes (planner-serve on port 8131, P33-teszt_v2), measuring rather than eyeballing. Report what holds,
what does not, and what you could not check. Change nothing unless I ask.
```

## RESOLVE

```
Here are my answers to Planner/projects/varler-planner/docs/mcp/DECISIONS.md: <paste, e.g. Q01 A, Q03 B, …>.
Write them into DECISIONS.md "Answers" and README §5 (Id · answer · where it changed the pack), then
edit every WP section the non-A answers affect. Build nothing.
```

## STATUS

```
Read Planner/projects/varler-planner/docs/mcp/README.md §4 and §5 and git status in the main checkout; tell me in five lines what of the
Planner MCP is built, what is uncommitted, and what the next step is.
```
