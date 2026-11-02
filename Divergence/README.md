# Divergence board (Divergencia · jelzőtábla)

The original divergence ring from `shared/varler-logo` (form `ring`), turned into a notification board. Every open
signal is one divergence on the ring: it builds a peak, and a callout names it. Click a peak or its label to open the
signal. The panel then offers three ways out:

| Action | What it does | Where it goes |
|---|---|---|
| **Belépés** (enter) | Builds the hand-off text for another session, copies it to the clipboard and saves it to `data/handoff/<id>.md`. The signal stays on the ring, marked BELÉPVE. | The log on main |
| **Fejlesztői jegyzet** (dev note) | Leaves a note on the signal's topic and takes the signal off the ring. | `data/outbox.jsonl` until **Push**, then `devnotes/<topic>.md` on branch `vrg-devnotes` |
| **Mellőzés** (ignore) | Takes the signal off the ring, with an optional reason. | The log on main, so the next ordinary push carries it regardless. Also every dev-notes push. |

The session that was handed a signal closes it itself: `node tools/divergence.js close <id> "<what changed>"`.

Run it with START → O → J, or `node Divergence/serve.js`, then open <http://localhost:8801>.

## Files

| File | What | Tracked |
|---|---|---|
| `config.json` | Board settings, **kinds**, target types, action labels, **prompt templates**, the dev-notes branch | yes |
| `signals.json` | The signals: the input. Add by hand, with `add`, or later from a feeder | yes |
| `data/log.jsonl` | Every action, one line each. **The log is the state**: the last action on a signal says where it stands | yes |
| `data/outbox.jsonl` | Notes waiting for the next push | no |
| `data/sent.jsonl` | What each push carried | no |
| `data/handoff/` | The generated hand-off texts | no |
| `index.html` | The board: ring, callouts, panel. No build step | yes |
| `serve.js` | `:8801`, this PC only. It serves the page and `/divergence.js` (the engine), plus the API below | yes |
| `../tools/divergence.js` | Everything else, as a CLI and as a module (the server uses it) | yes |

## A signal

```json
{
  "id": "council-gate",            // a-z 0-9 -, unique
  "kind": "reminder",              // a key of config.kinds
  "title": "Költségkapu: még mindig kikapcsolva",   // the callout's line (Hungarian, on screen)
  "why": "COUNCIL-Q5 = C ...",     // the reason it signals (goes into the hand-off)
  "level": 0.55,                   // 0..1: how high the peak builds
  "topic": "council",              // dev notes land in devnotes/<topic>.md; default = the kind's topic
  "target": { "type": "doc", "path": "docs/council/DECISIONS.md", "line": 25 },  // doc | folder | go | brief
  "readFirst": ["docs/council/README.md"],
  "done": "The Founder decides ...",   // what done looks like
  "source": "manual",              // who raised it: manual, solomon, ...
  "created": "2026-10-31",
  "angle": -60                     // optional: a fixed place on the ring (degrees clockwise from the top)
}
```

Without `angle`, the signals on the ring are spread evenly in file order. At most `board.maxOnRing` of them are
shown (the strongest); the rest wait.

## Configuring it later

- **A new kind of signal:** add it under `kinds` with a label, a default topic and a prompt template name.
- **A different hand-off for a kind:** add a template under `prompts` (an array of lines) and point the kind at it.
  The placeholders are `{id} {title} {why} {kindLabel} {levelPct} {repo} {branch} {topic} {target} {readFirst} {done}`.
- **A new target type:** add it under `targets` (key → its Hungarian label).
- **Pushing signals from elsewhere** (Solomon, Kódváros, a scheduled check): a feeder calls
  `node tools/divergence.js add --kind K --title T --why W [--level 0.6] [--topic X] [--target doc:path:line]
  [--read a,b] [--done D] [--source S] [--id ID]`, or `require('tools/divergence.js').add({...})`.
  `check` validates everything and fails on a target that does not exist.
- **A new action:** it needs a name in `ACTIONS` (and in `GONE`, if it takes the signal off the ring) in `tools/divergence.js`,
  a label under `config.actions`, and a button in the panel.

## CLI

```bash
node tools/divergence.js list
node tools/divergence.js prompt <id>
node tools/divergence.js enter <id>
node tools/divergence.js note <id> "<text>"
node tools/divergence.js ignore <id> ["<why>"]
node tools/divergence.js close <id> "<summary>"
node tools/divergence.js reopen <id>
node tools/divergence.js push
node tools/divergence.js check
```

The server's API: `GET /api/state`, `GET /api/handoff/<id>`, `POST /api/act {id, action, text}`, `POST /api/push`.

## The dev-notes branch

`vrg-devnotes` works like `solomon-data`. It has a history of its own and holds only `devnotes/<topic>.md` (notes
added, newest last) and `devnotes/log.jsonl` (the whole action log, ignores included).

- **Built with plumbing:** a temporary index on top of the branch tip. No checkout and no branch switch, so a push
  can run while other sessions work on main.
- **Checked first:** every file goes through `tools/anonymise.js --check` before it leaves the PC.
- **Never forced:** a push that loses a race fetches the new tip and tries again, three times at most.
- **Mirrored locally:** a local branch of the same name is moved too, so BACKUP's `push --all` carries it.

## The ring

The board passes its signals to the engine as `events` (see `shared/varler-logo/README.md`). Each event is
`{ rc: angle, s: 9 + 13·level, a: 0.35 + 0.65·level, hold: true }`. An entered signal sits lower; the selected one
sits higher. `api.points()` returns each peak's tip and base in CSS pixels, and the callouts follow them every frame.
