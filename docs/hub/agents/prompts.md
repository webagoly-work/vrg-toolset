# Prompt könyvtár — agent init
*For a Claude Code session that will work on Prompt könyvtár. Read this, then the files in §3.*

## 1. What it is
Ready-made opening texts for Claude Code sessions: new feature, debugging, phasing a big task,
bringing in an outside library, session start, review, adding a tool, data and backward compatibility.

## 2. Where
- `tools/prompts/01-uj-funkcio.txt` … `08-adat-es-mentes.txt`.
- Reached from VRG-DE.cmd **K** (Prompt konyvtar).

## 3. Read first
1. `tools/prompts/05-munkamenet-inditas.txt`
2. The other `tools/prompts/*.txt`, as needed

## 4. Build / test / check
No build — plain text files.

## 5. Rules and traps
- Plain ASCII text, no accents (the files themselves).
- Point prompts at the working copy `H:\VRG\Full\Planner_VRG_U100`, never at
  `H:\VRG\Backup\code\Planner_VRG_U100-mirror`, which is the backup (root CLAUDE.md).

## 6. Current state
- 2026-09-21 VRG-DE: one umbrella launcher over the whole environment
- Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: tools/prompts/*.txt, CLAUDE.md, VRG-DE.cmd, git log main, 2026-10-22
