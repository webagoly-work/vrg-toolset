# Mentés (BACKUP · kapszula) — agent init
*For a Claude Code session that will work on backups. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab · **Indító:** GO MAIN

## 1. What it is
What protects the work: BACKUP pushes every repo to a bare copy and mirrors the work folders, with
nothing lost on overwrite. The DNA capsule is a second, separate backup in one text file. Both protect
what exists; neither replaces a commit.

## 2. Where
- `launcher/backup.ps1`, settings in the `backup` block of `launcher/vrg-menu.json`. Menu `H:\VRG\BACKUP.cmd`.
- `H:\VRG\Backup\code\<name>.git`: bare repos. `H:\VRG\Backup\code\work`: mirrored work folders.
- `H:\VRG\Backup\archive`: overwritten or dropped files, per stamp. `H:\VRG\Backup\logs`: manifest, sync logs.
- `H:\VRG\Backup\capsule`: the capsule file. `tools/capsule.js` is on branch `docs/go-tnt` only.

## 3. Read first
1. `CLAUDE.md` (root) — the BACKUP paragraph, "Nothing is lost"
2. `launcher/backup.ps1`
3. `GO-MAIN.md` §6

## 4. Build / test / check
```bash
powershell -NoProfile -ExecutionPolicy Bypass -File launcher\test\backup-selftest.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File launcher\test\backup-e2e.ps1       # throwaway folders only
```
Menu: 1 sync, 2 integrity (`git fsck` + re-hash), 3 newest log, 4 restore, 5 installers.

## 5. Rules and traps
- A file the backup would overwrite or drop goes to the archive first; an emptied or missing source
  folder is skipped, never wiped (root CLAUDE.md).
- A diverged branch is reported, never forced (root CLAUDE.md).
- Restore overwrites but never deletes, and saves the current copy first (root CLAUDE.md).
- Piping strings into git adds a BOM in PowerShell 5.1: pass lists through files (root CLAUDE.md).
- A BOM-less test script misreads accented literals: match an ASCII part (root CLAUDE.md).
- The capsule holds no client data (DNA session, 2026-10-30).

## 6. Current state
- git 2026-10-30 e654103 GO files consolidated, new GO MAIN, CLAUDE.md codephrases; anonymiser re-run
- git 2026-10-30 aeca63a START launcher: one menu, shims and the portable-path scripts
- The capsule has one build, 2026-10-30. `tools/capsule.js` reaches `main` with the GO TNT merge
  (COUNCIL-Q6 B). DNA material stays out of working context (Council charter §4).
- Backups cover commits and the mirrored folders: uncommitted repo work is not in the git backup.

## 7. Do not touch
- `H:\VRG\Backup\code\*.git` as a workspace: BACKUP pushes to it, never work from it (root CLAUDE.md).

Forrás: CLAUDE.md, launcher/vrg-menu.json, docs/council/DECISIONS.md, git log main, 2026-10-31
