# Voice in the VRG Asztal: four phases

*2026-11-25, cloud session. Phases 1–2 are built (WP-54, WP-55). Phases 3–4 are proposals. Sources: `Voice/README.md` (the engine
choice, with links) and `2026-11-25_voice-phases-research.md` (phases 3–4, with links).*

The aim, in the Founder's words, is the Westworld S1E5 "control assist" shell. You push a key and speak; words appear at once.
Short commands and questions get answers of a few words. The shell drives the desktop and understands what is on screen. And
spoken text never goes straight into someone else's text box: it fills our own boxes, then the Előszűrő, then a session.

## Phase 1: Diktálás (built, WP-54)

- **Push-to-talk:** hold F9 (setting `voice.key`). In a text field of the Desktop page you dictate; anywhere else, or with Shift+F9,
  you give a command. The Vezérlő has a hold-to-talk 🎤 button.
- **Start time:** the microphone stays open while the feature is on, with a 300 ms pre-roll ring buffer. Key-down to the first
  audio sent measured **13–14 ms** in Chromium, and the word you start with is never cut. The model stays loaded.
- **The engine:** whisper.cpp `whisper-server` (MIT), offline, on 127.0.0.1.
  - Model: large-v3-turbo q5_0 (~547 MB), with `small` as the fallback.
  - Live words: the growing buffer is re-decoded every 400 ms, and a word is fixed once two decodes agree on it.
  - Biasing: a per-request prompt built from our own vocabulary (Előszűrő names, catalog titles, codephrases, the command phrases,
    `Voice/vocab/extra.txt`).
  - "Trainable online": a Hungarian fine-tune converted to ggml drops in as a model file.
- **Where text may go:** only into the Desktop page's own text fields. Never into a browser tab, an in-shell app view, a password
  field, or another program. Speaking never sends anything: the Vezérlő's text still passes the Előszűrő.
- **Privacy:** audio never leaves the PC and is not written to disk; transcripts are not logged.

## Phase 2: Parancs-héj (built, WP-55)

- **Commands:** 34 commands as data (`Voice/command/commands.json`, Hungarian and English), parsed with accent folding, Hungarian
  suffix stripping, edit distance and a phonetic key. So "nyisd meg a planert" still opens the Planner.
- **When it is unsure:** two close matches give "Melyik: X vagy Y?"; low confidence gives "Úgy érted: …?".
- **What it covers:** tools, Laps, windows, the session board, Munkamenetek, the Vezérlő (fill always; send only after "igen"),
  window labels, the level switch with a phrase gate ("VRG, fejlesztői szint. Jogosult vagyok."), and questions answered from the
  Desktop's own state.
- **The overlay:** a HUD that shows the live words, then the answer in about six words. It acts only through the Desktop's page
  APIs. Closing and sending always ask first.
- **Without a microphone:** a typed command line (Ctrl+Shift+Space) runs the same parser.
- **For phase 3:** `VRGVoiceCmd.providers` is the extension point for "what is on screen".

## Phase 3: Szem és hang ("eyes and voice"): read the whole screen, answer aloud (built 2026-11-25: WP-56, WP-57; not yet run on Windows)

- **Reading the screen**, read-only, offline:
  - First, a small helper process that reads the focused window's Windows UI Automation tree. No maintained npm wrapper exists, so
    the helper is ours.
  - Then OCR when that tree is thin: Windows OCR if it has Hungarian, otherwise Tesseract `hun` + `eng`.
  - Screenshots through Electron's `desktopCapturer`, kept in memory only.
- **Answering aloud:** spoken answers offline with sherpa-onnx and a Piper Hungarian voice (anna, berta or imre). Check each voice's
  licence first; Piper's upstream moved to GPL-3.0.
- **Safety:**
  - No input is injected in this phase.
  - A visible "reading" indicator while it captures.
  - Off by default per app, with an allowlist and a redaction list (password managers, banking, client folders); redaction runs
    before anything is spoken or logged.
  - Screen text is shown and quoted, never executed.
- **How it fits:** each reader plugs into phase 2 as a `describe()` provider. "mi van a képernyőn?" then also covers other programs.

## Phase 4: Kéz ("hands"): act on the desktop, with gates (built 2026-11-25: WP-58, WP-59; not yet run on Windows)

- **Actions:** through UI Automation patterns (invoke, set value, focus), only on an allowlist of programs and verbs. Every
  registry command gets a risk class: `read`, `reversible` (a short countdown), `confirm` or `blocked`.
- **Who is speaking** ("Bernard, Lowe. I'm authorized" made real): an offline speaker check with sherpa-onnx, enrolled on your
  voice. It is a convenience, not an authorisation:
  - at Dev it can replace the confirm click for reversible actions;
  - the All level still needs a keypress or PIN;
  - replay and synthetic voices are not defended by these tools.
- **Spoken tasks:** a spoken task goes to a Claude Code session through the Vezérlő and the Előszűrő. It carries text and quoted
  screen excerpts only, needs your consent each time, and runs under the session's own permission mode.
- **Anthropic's computer use:** only in a sandbox (a VM or a separate window), never on the work desktop, because screenshots go to
  the cloud.
- **Safety:** an "agent acting" red frame, a kill switch (a global key and a spoken "stop"), default deny, no input to elevated
  windows, and an action log you can read. Text read from the screen can never choose an action by itself, which blocks prompt
  injection through the screen.
- **Optional:** the phone (VRG Mobile) as a remote push-to-talk microphone over the LAN.
- **No wake word:** Hungarian is not covered, and the open models are non-commercial.

## What decides the order

Phase 3 is cheap and safe (read-only), and it makes phase 2's questions useful outside our own window. Phase 4 changes the risk
class of the whole shell, so it waits until phases 1–3 have run on H: for a few weeks:
- measured Hungarian accuracy and first-partial latency (phase 1);
- the command phrases you actually use (phase 2's history);
- the redaction list (phase 3).
