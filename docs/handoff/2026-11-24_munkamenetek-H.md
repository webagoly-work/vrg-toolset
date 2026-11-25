# Prompt for the local H: session: Munkamenetek, the session board, the Vezérlő, the Előszűrő and voice (WP-50 … WP-57), the local half

*Paste everything between the two lines into a Claude Code session started in `H:\VRG\Full\Planner_VRG_U100`.*
*Updated 2026-11-25: covers everything on the branch (PR webagoly-work/vrg-toolset#13), WP-50 … WP-57.*

---

A cloud session built four work packages for the VRG Asztal on branch `claude/charming-goodall-dc1ol8`. It wrote and ran the unit
tests on Linux, and drew the panes in Chromium with stub data. It had no Electron, no real `claude` binary, no H: drive and no VRG
Stack database. The local half is yours.

What is on the branch (details: `docs/desktop/LOG.md` § WP-50 … WP-53, decisions DESKU-Q25 … Q27):
- **WP-50 Munkamenetek** (pane `sessions`): lists the local Claude Code sessions of account A and B, newest first. Its buttons:
  - Folytatás: continue a session (`--resume`);
  - Erősebb modellel: continue it on opus (`--resume --model opus`);
  - Másolat: continue a copy (`--fork-session`);
  - Távvezérlés: continue it with `/remote-control`;
  - Vászon: open the Munkavászon at `#s=<id>`.

  The bar's Felhő button opens claude.ai/code in a browser pane, and Áthozás pulls a cloud session down (`--teleport`).
  The Gyors elérés side panel links 14 related tools.
- **WP-51 the session board:** board labels on any Lap:
  - the origin chip and colour frame: Helyi · A/B (ice), Felhő (violet), Gép: \<név\> (warm);
  - the session title above the window, a note below it.

  The four are switched per Lap (sheet tab → Tábla-címkék…) and overridden per window by right-click. Munkamenetek → Tábla opens
  the board: the Vezérlő across the top, the list on the left.
- **`shared/sidepanel/`:** the Planner's side panel as a reusable plug-in.
- **WP-52 Vezérlő** (pane `controller`): one prompt box in Egyszerű (simple) or Részletes (detailed) mode. Its attach options:
  browse, recent, preset folder, gallery, photo and QR. Every prompt goes through the **Előszűrő** (`Prefilter/`, offline), which
  judges it context / unsure / independent and dresses it. A new session then starts with `--model`:
  - an independent prompt starts in `Full\home\claude-free` (no CLAUDE.md);
  - anything else starts in the repo.
- **WP-53:**
  - the Előszűrő as a Claude Code `UserPromptSubmit` hook (`Prefilter/hook.js`, **not installed**);
  - negation ("ne a Plannerről");
  - work-line memory: a bare "folytasd" takes the latest session's anchors;
  - an evaluation tool (`Prefilter/eval.js`) with a 44-prompt seed set: 0.886 accuracy, no context → independent mistake;
  - forced routes in the Vezérlő are saved as labels.
- **WP-54 Diktálás:** offline push-to-talk dictation (hold F9) in Hungarian and English, through whisper.cpp `whisper-server` on
  127.0.0.1 with large-v3-turbo. It writes only into the Desktop page's own text fields, and the Vezérlő has a hold-to-talk 🎤. The
  microphone stays warm with a 300 ms pre-roll; key-down to the first audio was 13–14 ms in Chromium. Off by default (`voice.enabled`).
- **WP-55 Parancs-héj:** the voice command overlay. It handles 34 commands from `Voice/command/commands.json`, tolerates
  misrecognitions, answers in a few words, asks before closing or sending, has a phrase-gated level switch, and a typed command line
  (Ctrl+Shift+Space).
- **WP-56 Szem / WP-57 Hang (voice phase 3):**
  - an optional global push-to-talk key (Ctrl+Alt+V) that works while another program is in front;
  - read-only screen reading (a UI Automation helper in PowerShell, Hungarian OCR as the fallback, redaction, an allow / deny list);
  - spoken answers offline (sherpa-onnx + a Piper Hungarian voice, or SAPI);
  - a small always-on-top answer window;
  - new commands (melyik program ez, mi a hiba, olvasd fel, csend, ne beszélj …).

  All off by default (`screen.enabled`, `speak.enabled`, `voice.global`).
- Voice roadmap (phase 3 built, phase 4 proposed): `docs/research/2026-11-25_voice-roadmap.md`.

Work step by step, show me each result, and stop to ask me before any commit, push, merge, settings change or hook install.

1. **Where you are.**
   - `git rev-parse --show-toplevel` must print `H:/VRG/Full/Planner_VRG_U100`. Never work in the bare `Backup\code` repo.
   - Run `git fetch origin claude/charming-goodall-dc1ol8`. Check the branch out into a worktree or a local branch, unless it is
     already merged into `main`; then `git pull --ff-only` on `main`.
   - Read `docs/desktop/LOG.md` § WP-50 … WP-53, then `Dashboard/shell/lib/sessions.js`, `gate.js` and `Prefilter/README.md`.

2. **The automated checks the cloud could not run.**
   - `node Dashboard/test/run.js WP-50`, `WP-51`, `WP-52`, `WP-35`, `WP-46` and `WP-24`. The Electron probe
     `Dashboard/shell/selftest/wp-50.js` has never run anywhere. It now expects the idle row's buttons as
     `resume,stronger,fork,remote,canvas`. Fix it until it is green, and tell me what you changed.
   - `node --test Prefilter/test/prefilter.test.js Prefilter/test/next.test.js shared/sidepanel/test/sidepanel.test.js` (18 in
     the cloud).
   - `node Dashboard/test/run.js --all`: compare with `main` before the branch, and list only the new failures. In the cloud the
     unit suite gave 321 pass and the same 68 failures as before; all 68 came from the missing H: and Electron.
   - `node tools/check-start.js` and `node tools/check-catalog.js` must both exit 0. The catalog gained `sessions` and
     `controller`; START did not change.

3. **The Claude Code behaviour all this relies on.** The cloud wrote these from the documentation and did not run them. Try each
   one in a throwaway session, not one that matters. Use account A first, then B
   (`CLAUDE_CONFIG_DIR=H:\VRG\Full\home\claude-account-b`).
   - `claude --resume <id>`, started in the session's own folder (the transcript's `cwd`), comes back with its history.
   - `claude --resume <id> --fork-session` makes a **new** session ID and leaves the old transcript untouched.
   - `claude --resume <id> --model opus` continues the same session on opus. This is what Erősebb modellel does.
   - `claude --resume <id> "/remote-control"`:
     - does a slash command given as the first prompt run, or does Claude get it as text?
     - does the session then show up at claude.ai/code?
     - if it doesn't run, find the right way (a flag, or typing it) and change the `remote` option in `sessions.js` and its test.
   - `claude --teleport` from the repo folder: does it list my cloud sessions and pull one down? What does it need: a clean
     working tree, the same branch?
   - `claude --model haiku "<about 2 000 characters>"`: confirm that a dressed first prompt of that length works as one argument on
     Windows, with the accents intact.
   - **Is a session running right now?** WP-50 guesses this from the file's age (written in the last 2 minutes = live). Look in
     the config folder for a reliable marker (a pid file or a lock), and tell me what you find before you change the guess.

4. **Munkamenetek in the real app.** Rebuild with START → F, start the VRG Asztal (START → D) at the Dev level, and open
   Munkamenetek from the Irányítópult's Ügynökök section and from a free cell's picker. Check:
   - the list:
     - both accounts' sessions are listed, newest first, with title, project and branch;
     - the filter works;
   - the buttons:
     - Folytatás on an idle session opens a Claude terminal in the right folder;
     - on a live one Folytatás is missing, and Másolat works;
     - Erősebb modellel starts the session on opus;
     - Vászon opens the canvas **on that session**, not the newest one;
   - Felhő and the browser pane:
     - Felhő opens claude.ai/code in a Böngésző pane;
     - sign in there once (use the email code if Google refuses sign-in in an embedded browser);
     - open one cloud session, paste a file into it, and tell me which permission questions the pane asked;
   - Gyors elérés: the six links of the simple mode open their tools, and Részletes shows 14;
   - in a narrow column the panel starts folded to its icon rail.

5. **The session board.** Munkamenetek → Tábla. Check:
   - **The board itself:** a Lap called Munkamenetek opens with the Vezérlő across the top and the list on the left; the button now
     says Lista and takes you back.
   - **Automatic labels:** a session opened from the list lands on the board with Helyi · A (or B), its title above, and an ice
     frame.
   - **Cloud windows:** a claude.ai/code tab in a browser window there shows Felhő and a violet frame.
   - **The right-click label menu:** Cím…, Megjegyzés…, Eredet → Másik gép… (type "Laptop"; the frame turns warm), Szín, and Ennél
     az ablaknál (cycle one item: tábla szerint → mindig → soha).
   - **The sheet tab:** Tábla-címkék… switches each of the four labels for the whole Lap.
   - **Native views:** the browser window's page moves when a label bar appears or disappears, and never covers the bar.
   - Take one screenshot of the board and save it in `Full\_share`.

6. **The Vezérlő and the Előszűrő.**
   - Rebuild the index with the H: sources: `node Prefilter/cli.js --rebuild --stats "GO MOBILE folytasd"`. With the Stack, the jobs
     and the features it should be much bigger than the cloud's 445 entities. If `node:sqlite` is missing in this Node or in
     Electron, tell me: the Stack source is then silently skipped.
   - Run `node Prefilter/eval.js run --set seed --misses`. The cloud got 0.886, with the 5 misses all on unsure. Then try 10 of my
     real first prompts from the Munkamenetek list with `node Prefilter/cli.js "<prompt>"`. Show me the verdicts. Propose
     threshold changes but do not make them.
   - In the app, on the board:
     - Send "írj egy verset a télről": it must start in `Full\home\claude-free` with `--model haiku`, labelled "Előszűrő: önálló".
     - Send "GO MOBILE hol tartunk?": it must start in the repo with sonnet.
     - Send "folytasd": the Részletes preview must say which earlier session it took ("folytatás → az előző munkamenet: …").
     - Force Önálló on a context prompt and check that a line appeared in `Prefilter/.cache/eval/labels.jsonl` with source
       `override`.
   - The attach options:
     - Tallózás, Legutóbbiak (after one attach), Mappa (the roots.json folders) and Galéria;
     - the attached paths appear only at the end of the started session's first prompt, never in the pane.

7. **Camera, QR and the frame page's permissions.**
   - Fotó: it must ask nothing and work, because the frame page has no permission handler and Electron allows by default. The
     photo lands in `Full\inbox\vezerlo` and is attached.
   - Tell me whether that same default also lets the frame page use the microphone, notifications, geolocation or other
     permissions. Then propose a handler that allows only video, and only for the Vezérlő. Do not change it without asking.
   - QR: say whether `BarcodeDetector` exists in this Electron. If it doesn't, the pane says so and points to VRG Mobile.

8. **The hook and my own labels. I decide these two.**
   - Run `node Prefilter/hook.js --test "GO MOBILE hol tartunk?"`, once from the repo and once from `Full\home\claude-free`.
     Then try a short sequence with `--session t1`:
     - "GO MOBILE hol tartunk?" must get the full dressing;
     - "folytasd" must add nothing;
     - "nézzük a Kapu belépést" must add a two-line "új horgony" note;
     - the next mention of Kapu must add nothing.
   - Run `node Prefilter/eval.js extract`. Then start `node Prefilter/eval.js label` for me in a terminal and leave it to me
     (c = context, i = independent, s = skip, q = quit). Afterwards run `node Prefilter/eval.js fit --set all` and show me the
     suggestion; on the seed set alone it was context ≥ 0.35. Do not `--write` it.
   - Show me `node Prefilter/hook.js --install --dry`. Install it, in the repo or with `--user`, only when I say so. Then:
     - send one prompt in a new session and check that the added context arrived (`Prefilter/.cache/log.jsonl` has a `first`
       line);
     - check that a prompt still goes through with `VRG_PREFILTER_OFF=1`;
     - check that a broken index (rename `Prefilter/.cache` for a moment) never blocks a prompt.

9. **Voice (WP-54, WP-55).** Read `Voice/README.md` and `docs/research/2026-11-25_voice-roadmap.md`.
   - `node --test Voice/test/voice.test.js Voice/command/test/parse.test.js`, then `node Dashboard/test/run.js WP-54` and `WP-55`.
     The WP-54 Electron probe (`Dashboard/shell/selftest/wp-54.js`) has never run: fix it until it is green.
   - Fetch the engine: `node Voice/fetch.js engine` (already pinned, sha256 checked).
   - Fetch the model: `node Voice/fetch.js --pin turbo` (about 547 MB). Show me where it comes from and the hash before you commit
     the manifest change.
   - Turn dictation on (right-click the 🎤 in the Vezérlő, or the `voice.enabled` setting). Then measure, and show me:
     - hold F9 and speak at once: the first word must not be cut;
     - the time to the first partial word on screen;
     - the CPU load during 20 s of dictation;
     - Hungarian and English accuracy on 10 of my sentences each, including VRG words (Planner, Kapu, Rétegverem, GO MOBILE,
       Munkavászon);
     - whether `VRGVoice.state().capture` is `worklet` or `script` in Electron.
     If the first partial takes more than about a second, try the `small` model or a GPU build, and tell me.
   - Check the boundaries:
     - nothing is dictated into a browser tab, a password field or another program;
     - Shift+F9 in a text field gives a command;
     - Esc cancels and restores the field;
     - silence never produces copied vocabulary text.
   - The command overlay, by voice and with Ctrl+Shift+Space:
     - "nyisd meg a Plannert";
     - "menj a Munkamenetek lapra";
     - "zárd be a böngészőt" (it must ask);
     - "írd a vezérlőbe: GO MOBILE hol tartunk" (it fills the box, nothing is sent);
     - "küldd el", then "igen";
     - "mi van a képernyőn?";
     - the level phrase.
     Note every command it misheard or did not know, so I can add phrases.
   - The microphone works only because the frame page has no permission handler (the same finding as the camera, step 7).
     Include the microphone in the handler you propose there.

10. **Voice phase 3: screen reading and spoken answers (WP-56, WP-57).** Read `Voice/screen/README.md`, `Voice/tts/README.md` and
    `docs/desktop/LOG.md` § WP-56 + WP-57.
    - **Tests:** `node --test Voice/screen/test/screen.test.js Voice/tts/test/tts.test.js`, then `node Dashboard/test/run.js WP-56`
      and `WP-57`.
    - **Fetch:** `node Voice/screen/fetch-ocr.js --npm` (the Hungarian and English OCR data and tesseract.js) and
      `node Voice/tts/fetch-tts.js` (the speech addon, anna and amy). Run the tests again with `VRG_TESSDATA` / `VRG_TTS_REAL` set, so
      the two skipped real tests run.
    - **The voice licences:** every Piper voice is marked UNCLEAR (fine-tuned from "lessac", reportedly non-commercial). Tell me
      before anything is shipped beyond my own PC.
    - **The PowerShell helpers** have never run.
      - Check that `uia-host.ps1` and `sapi-host.ps1` start once and stay up, and whether Avast blocks their first start.
      - Check whether Windows has a Hungarian SAPI voice.
    - **Screen reading:** turn on `screen.enabled`, `speak.enabled`, `voice.enabled` and `voice.global`, and restart the Asztal (the
      global key is registered at start). Then, with Chrome, VS Code, Total Commander and Explorer in front, press Ctrl+Alt+V, ask, and
      press it again:
      - "melyik program ez?" and "milyen ablakok vannak nyitva?";
      - "mi a hiba?" (use a VS Code window with a red build error);
      - "olvasd fel" (select a paragraph first).

      Tell me what was read through UI Automation and what through OCR. Do Chrome and VS Code expose their content without
      `--force-renderer-accessibility`?
    - **Timings:** the time from the second key press to the spoken answer, and the CPU load.
    - **Safety:**
      - nothing is read from KeePassXC, an OTP Bank tab or an InPrivate window (the default deny lists);
      - client job folders: Explorer shows only a folder's name, so no default rule covers them. Propose how to keep a `jobs\` window
        out (for example its folder names in `screen.denyTitles`, kept local), and ask me;
      - an elevated window gives "elevated" and never hangs;
      - the answer window never takes the focus;
      - "csend", or any new push-to-talk, stops the voice at once;
      - "ne beszélj" keeps the answers on screen only.
    - **Permissions:** the screen capture, the microphone and the camera all ride on Electron's allow-by-default (step 7). Include
      screen capture (`desktopCapturer`) in the permission handler you propose.

11. **Then report** what passed, what you fixed and what is still open. Make no commit or push unless I ask. When I do:
   - first run `node Dashboard/tools/inventory.js` and `node Dashboard/tools/classify.js` (the cloud could not refresh the
     inventory: it had no anonymise map);
   - commit on the branch above;
   - add the results to `docs/desktop/LOG.md` under the WP they belong to.

   Never commit `Prefilter/.cache/` or `Voice/.cache/`: they are gitignored and hold my prompts, labels, job codes and vocabulary. Never commit a model file. START did not change, so the
   Kapu needs no rebuild.

---
