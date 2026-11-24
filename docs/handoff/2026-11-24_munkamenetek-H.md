# Prompt for the local H: session: the VRG Asztal's Munkamenetek window (WP-50), the local half

*Paste everything between the two lines into a Claude Code session started in `H:\VRG\Full\Planner_VRG_U100`.*

---

A cloud session built **WP-50 Munkamenetek** (Sessions) for the VRG Asztal on branch `claude/charming-goodall-dc1ol8`:
a pane that lists the local Claude Code sessions of account A and B and opens them in an embedded terminal
(continue, fork, with Remote Control), opens the Munkavászon on one, pulls a cloud session down (`--teleport`) and
opens claude.ai/code in the browser pane. It wrote and ran the unit tests on Linux, but it had no Electron, no real
`claude` binary and no H: drive. The local half is yours. Do this step by step and stop to ask me before any commit,
push or merge:

1. **Where you are.** `git rev-parse --show-toplevel` must print `H:/VRG/Full/Planner_VRG_U100` (never the bare
   `Backup\code` repo). Run `git fetch origin claude/charming-goodall-dc1ol8` and check it out into a worktree or a
   local branch, unless it is already merged into `main` (then `git pull --ff-only` on `main`). Read
   `docs/desktop/LOG.md` § WP-50 and `Dashboard/shell/lib/sessions.js` first.

2. **The checks the cloud could not run.** Show me each result:
   - `node Dashboard/test/run.js WP-50`, `WP-35`, `WP-46` and `WP-24`. The WP-50 probe `Dashboard/shell/selftest/wp-50.js` has
     never run anywhere: fix it until it is green, and tell me what you changed.
   - `node Dashboard/test/run.js --all`: compare with `main` before the branch, and list only the new failures.
   - `node tools/check-start.js` and `node tools/check-catalog.js` (both exit 0).

3. **The Claude Code behaviour WP-50 relies on.** The cloud wrote these from the documentation and did not run them. Try each
   one in a throwaway session (not in a session that matters), first with account A, then with B
   (`CLAUDE_CONFIG_DIR=H:\VRG\Full\home\claude-account-b`):
   - `claude --resume <id>`, started in the session's own folder (the transcript's `cwd`), comes back with its history.
   - `claude --resume <id> --fork-session` makes a **new** session ID and leaves the old transcript untouched.
   - `claude --resume <id> "/remote-control"`: does a slash command given as the first prompt run, or does Claude get it as
     text? Does the session then show up at claude.ai/code? If the slash command does not run, find the right way (a flag, or
     typing it) and change the `remote` option in `sessions.js` and its test to match.
   - `claude --teleport` from the repo folder: does it list my cloud sessions and pull one down? What does it need (a
     clean working tree, the same branch)?
   - **Is a session running right now?** WP-50 guesses this from the file's age (written in the last 2 minutes = live), so
     Folytatás refuses and offers Másolat. Look in the config folder for a reliable marker of a running session (a pid
     file or a lock). Tell me what you find before you change the guess.

4. **The window in the real app.** Rebuild with START → F, start the VRG Asztal (START → D) at the Dev level and open
   Munkamenetek from the Irányítópult's Ügynökök section and from a free cell's picker. Check:
   - both accounts' sessions are listed, newest first, with title, project and branch; the filter works;
   - Folytatás on an idle session opens a Claude terminal in the right folder; on a live one it refuses and Másolat
     works;
   - Munkavászon opens the canvas **on that session** (not the newest one);
   - Felhő opens claude.ai/code in a Böngésző pane. Sign in there once (use the email code if Google refuses
     sign-in in an embedded browser), open one cloud session, paste a file into it, and tell me which permission questions
     the pane asked.
   Take one screenshot of the window and save it in `Full\_share`.

5. **Then report:** what passed, what you fixed and what is still open. Make no commit or push unless I ask; when I do,
   first run `node Dashboard/tools/inventory.js` and `node Dashboard/tools/classify.js` (the cloud could not refresh the
   inventory: no anonymise map), then commit on the branch above and add the results to `docs/desktop/LOG.md` § WP-50.
   START did not change, so the Kapu needs no rebuild.

---
