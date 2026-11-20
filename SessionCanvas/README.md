# VRG Munkavászon (Session Canvas)

A Claude Code work session drawn while it happens. The canvas starts empty. A pen draws the session from left to
right. Every lane fades in the first time it is used, and every mark arrives with a ripple:

| Lane | What appears |
|---|---|
| **Szöveg** (spine) | the prompts (`#n`, a line through every lane), what Claude says (◆ with its first words), where it thinks (dotted circle, size = thinking tokens) |
| **Olvasás · Keresés · Szerkesztés · Parancs · Web · Ügynök · MCP · Terv · Egyéb** | each tool call as a bar from call to result, coloured by kind; a thread ties it to the spine. A running bar has moving stripes, plus a dashed ghost up to its expected end. Errors are red. Edits show `+added −removed` lines |
| **Háttér** | background jobs (`run_in_background`, background subagents) from launch to their `<task-notification>`, ✓ / ✕ at the end |
| **↳ subagent** | one lane per subagent transcript, its calls as ticks, linked to the `Agent` call that started it |
| bottom band | cumulative output tokens (warm) and context fill (ice) |

Idle stretches longer than 90 s, with nothing running, fold into a zigzag gap labelled with its length. A long day
still reads, and the pen rests while you are away.

The side panel shows **Most** (state: thinking / writing, running a tool, background running, asking, done, your
turn; the task in progress; every running call with its elapsed time and ETA), **Feladatok** (the task list from
`TaskCreate` / `TaskUpdate` or `TodoWrite`, with a progress bar and an ETA), **Eszközök** (calls by kind, tokens,
edited lines, errors) and **Napló** (prompts, Claude's texts, thinking, events and errors, newest first; click one to
jump there). Click any mark on the canvas for its details: input, output, duration.

## Run it

- **Live:** START → O → **N**, or `node SessionCanvas/serve.js`, then <http://localhost:8809>. The page follows the
  newest session (untick *mindig a legújabb* to stay on the one you pick). On connect it draws the session's history
  fast, then continues in real time.
- **File:** open `vrg-munkavaszon.html` directly and drop a transcript on it. Drop the main `.jsonl` together with
  its `<session>/subagents/*.jsonl` to get the subagent lanes. A file replays; ▶ / Space, speed, scrub.
- **Demo:** the *Demó* button (or `?demo`) replays a made-up 16-minute session.

Keys: Space play / pause · F fit · L follow · + / − zoom (Ctrl + wheel) · drag to pan · Home / End · D demo ·
O open · Esc close detail. *Kitakarás* masks e-mails, keys, home folders, `jobs\<name>` and phone numbers, for
screenshots.

## Where the data comes from

Claude Code writes every session to `<config>/projects/<project-folder>/<session-id>.jsonl`, one JSON object a line.
The server scans `--dir`, `VRG_CLAUDE_DIRS`, `CLAUDE_CONFIG_DIR`, `~/.claude`, and the second account
`H:\VRG\Full\home\claude-account-b`. It only reads. It listens on 127.0.0.1, answers only to its own `Host`, and
sends no CORS headers.

The page shows what the transcript holds:

- **Thinking:** current models keep only a signature of their thinking in the transcript, not its text. The canvas
  shows where Claude thought, for how long (`thinkingDurationMs`) and how many thinking tokens it used, and says the
  text is not in the log. When a transcript does carry the text, it is shown.
- **ETAs are estimates.** A task's ETA comes from the mean time the finished tasks took. A running call's ETA comes
  from the median of the same tool's finished calls in this session, or else the median of its kind. Until one task
  is done there is no task ETA.
- The transcript format is Claude Code's internal one and changes between versions. Unknown lines are skipped, and a
  broken line is counted, never fatal.

Compared with **Ügynöknyom** (Console, hook-based): that view needs the hooks installed, scrubs at the source and
can answer permission gates. The Munkavászon needs nothing installed, reads the transcript Claude Code writes anyway,
and draws the timeline.

## Files

| File | What |
|---|---|
| `vrg-munkavaszon.html` | the whole app, offline, no library. The model sits between `model:begin` / `model:end`; Mélyvíz between `melyviz:begin` / `melyviz:end` (`node tools/melyviz-sync.js`) |
| `serve.js` | the live server: session list, SSE tail of the transcript and its subagents (polls every 0.6 s) |
| `test/model.test.js` | `node SessionCanvas/test/model.test.js [transcript.jsonl …]`: the model against the demo session, then a summary of any real transcript given |
