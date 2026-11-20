# VRG Munkavászon (Session Canvas)

A Claude Code work session drawn while it happens. The canvas starts empty. A pen draws the session from left to
right. Every lane fades in the first time it is used, and every mark arrives with a ripple:

| Lane | What appears |
|---|---|
| **Parancs** | slash commands (`/deep-research`, `/batch`, `/code-review`, `/compact`, …), skills Claude calls, `GO …` codephrases, plan mode and workflows, each a band from start to end with its icon, colour by kind, its calls or agents done and an ETA. A faint tint runs through the lanes below while it lasts |
| **Szöveg** (spine) | the prompts (`#n`, a line through every lane), what Claude says (◆ with its first words), where it thinks (dotted circle, size = thinking tokens) |
| **Olvasás · Keresés · Szerkesztés · Parancs · Web · Ügynök · MCP · Terv · Egyéb** | each tool call as a bar from call to result, coloured by kind; a thread ties it to the spine. A running bar has moving stripes, plus a dashed ghost up to its expected end. Errors are red. Edits show `+added −removed` lines |
| **Háttér** | background jobs (`run_in_background`, background subagents) from launch to their `<task-notification>`, ✓ / ✕ at the end |
| **Képek** | every image the session saw: screenshots a tool returned (Read of a .png, browser screenshots), images pasted into a prompt, and image files a tool saved or sent (live only). A thumbnail sits over its moment, tied by a leader to the call or researcher that brought it; click for full size |
| **⑂ group** + **↳ subagent** | a parallel group: the `Agent` calls of one message (a deep-research fan-out), or a `Workflow` with the subagents that ran in it. The header has the fork, one box per member (filled when done), `2/4 kész`, the ETA and the join. Curves fan out to each member lane and back in. Each member lane has its calls as ticks, a dashed track for the expected time (the median of its finished siblings; warm once past it), what it has done (`◎` searches, `⇣` pages, `▤` reads, `✎` writes) and, when done, ✓ and its last words |
| **↳ subagent** (alone) | a subagent outside any command or fan-out, linked to the `Agent` call that started it |
| bottom band | cumulative output tokens (warm) and context fill (ice) |

Idle stretches longer than 90 s, with nothing running, fold into a zigzag gap labelled with its length. A long day
still reads, and the pen rests while you are away.

Command kinds (first match wins): `GO …` codephrase ➜ · research ◎ (`research`, `deep-research`, `akecheta`,
`piacmero`, …) · batch / workflow ☰ (`batch`, `workflow`, `loop`, `ultracode`) · plan ▦ (plan mode, `/plan`) ·
review ✔ (`review`, `simplify`, `security`, `check`) · context ↺ (`compact`, `clear`, `resume`) · settings ⚙
(`config`, `model`, `mcp`, `agents`, `init`, …) · run ▶ (`run`, `build`, `test`, `debug`, `deploy`) · other skills ✦ ·
other commands `/`. A skill Claude calls inside a running command joins that command's band. Plan mode comes from
the `permissionMode` of your prompts and from `EnterPlanMode` / `ExitPlanMode`; the approved plan is in the band's
detail. A `Workflow` band lists the phases from its script's `meta`, read as text, never run.

The side panel shows **Most** (state: thinking / writing, running a tool, background running, asking, done, your
turn; the task in progress; every running call with its elapsed time and ETA), **Párhuzamos munka** (the running parallel group, else the
latest: each member with ✓ / ▸, its work and its time, the phase ETA), **Feladatok** (the task list from
`TaskCreate` / `TaskUpdate` or `TodoWrite`, with a progress bar and an ETA), **Eszközök** (calls by kind, tokens,
edited lines, errors) and **Napló** (prompts, Claude's texts, thinking, events and errors, newest first; click one to
jump there). Click any mark on the canvas for its details: input, output, duration.

## Run it

- **Live:** START → O → **N**, or `node SessionCanvas/serve.js`, then <http://localhost:8810>. The page follows the
  newest session (untick *mindig a legújabb* to stay on the one you pick). On connect it draws the session's history
  fast, then continues in real time.
- **File:** open `vrg-munkavaszon.html` directly and drop a transcript on it. Drop the main `.jsonl` together with
  its `<session>/subagents/*.jsonl` to get the subagent lanes. A file replays; ▶ / Space, speed, scrub.
- **Demo:** the *Demó* button (or `?demo`) replays a made-up session: plan mode, a feature with a failing test,
  a background build and agent, a UI screenshot, then `/deep-research` with four parallel researchers (one reads a
  chart) and a report writer, then a commit.

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
- **Parallel ETAs:** a group's ETA is the slowest running member's: the median time of the finished siblings minus
  its elapsed time. A member already past that gets a quarter of its elapsed time (at least 5 s) and *(csúszik)*.
- **Images** a tool returned are in the transcript (base64), so they work from a file too. An image a tool only
  saved to disk is fetched from the live server, which serves an image only if its exact path is written in that
  session's transcript. *Kitakarás* hides every image.
- **Workflows:** the session transcript has the `Workflow` call, its script and its end. The agents inside are
  grouped under it by time; which phase each belongs to is not in the transcript.
- The transcript format is Claude Code's internal one and changes between versions. Unknown lines are skipped, and a
  broken line is counted, never fatal.

Compared with **Ügynöknyom** (Console, hook-based): that view needs the hooks installed, scrubs at the source and
can answer permission gates. The Munkavászon needs nothing installed, reads the transcript Claude Code writes anyway,
and draws the timeline.

## Files

| File | What |
|---|---|
| `vrg-munkavaszon.html` | the whole app, offline, no library. The model sits between `model:begin` / `model:end`; Mélyvíz between `melyviz:begin` / `melyviz:end` (`node tools/melyviz-sync.js`) |
| `serve.js` | the live server: session list, SSE tail of the transcript and its subagents (polls every 0.6 s), image files named in the transcript |
| `test/model.test.js` | `node SessionCanvas/test/model.test.js [transcript.jsonl …]`: the model against the demo session, then a summary of any real transcript given |
