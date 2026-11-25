# Voice phases 3 and 4: research notes

Read 2026-11-25. Question: what should follow Phase 1 (offline push-to-talk dictation, HU/EN, own text boxes) and Phase 2 (in-app voice command overlay, own state only) for the VRG Asztal (Electron, Windows 10/11)?

Convention: "Source says" is what the page said. "Conclusion" is mine. Unlinked statements are labelled *unsourced*.

Not reachable from this session (not in the allowed network domains): huggingface.co, arxiv.org, learn.microsoft.com, www.electronjs.org. Those hosts must be allowed before the gaps below can be closed. The project index (`node tools/vrg-ctx.js`) has no index yet, so nothing from it was used.

## 1. Screen understanding, offline-first

**Windows UI Automation (UIA) from Node.**
- Source says (a web-search result, secondary): `@bright-fish/node-ui-automation` is a NAPI/COM addon and dead since 2022. NodeRT's `windows.ui.uiautomation` projects WinRT, not Win32 `IUIAutomation`, and is also dead since 2022 ([Socket.dev on umbriel](https://socket.dev/npm/package/umbriel)). `node-winautomation` needs Visual Studio C++ to build ([pkgstats](https://www.pkgstats.com/pkg:node-winautomation)). FlaUI.js wraps the .NET FlaUI library ([npm](https://www.npmjs.com/package/@vavanya/flaui-js)). Microsoft's WinApp CLI v0.5.0 (22 July 2026) adds JS/TS bindings for Windows Runtime APIs without native addons ([devblog](https://devblogs.microsoft.com/ifdef-windows/windows-app-development-cli-v0-5-0-expanded-ui-automation-js-ts-bindings-and-more/)).
- Conclusion: no npm UIA wrapper is confirmed maintained. The lowest-risk route is a small helper that Electron spawns, either PowerShell or a tiny .NET console exe that uses `System.Windows.Automation` or `UIAutomationClient` and prints the control tree as JSON. The repo already ships a portable `dotnet` (CLAUDE.md "tools\ dotnet"). I did not verify that `UIAutomationClient` works from PowerShell 5.1 on a current Windows 11 build. Test it before committing to it.

**Windows OCR.**
- Source says: `OcrEngine.TryCreateFromLanguage` returns null when the language pack is absent. `IsLanguageSupported` and `AvailableRecognizerLanguages` exist to check first ([search summary of the OcrEngine docs](https://learn.microsoft.com/uwp/api/windows.media.ocr.ocrengine)). I could not confirm that Hungarian is among the OCR languages, because learn.microsoft.com was unreachable.
- Tesseract: `hun.traineddata` exists in tessdata_fast, and the data is Apache-2.0. The "fast" models are 8-bit integer and cannot be fine-tuned ([tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast)).
- Conclusion: OCR is the fallback for apps that expose no UIA tree. Probe `hu` on the target PC at runtime, and fall back to Tesseract with the `hun` pack.

**Local vision-language models.**
- OmniParser (Microsoft): README is inconsistent, with CC-BY-4.0 listed for the repo and an MIT badge. The page says `icon_detect_v3` is built on an MIT YOLOv9 implementation, older Ultralytics-based detectors stay AGPL, and the caption models are MIT. The newest news item is 2026/7. No hardware requirements are stated ([repo](https://github.com/microsoft/OmniParser)). Conclusion: check the licence file per weight before bundling. Hardware needs are unconfirmed.
- Qwen: the repo now lists Qwen3-VL (dense 2B, 4B, 8B, 32B), has a "Visual Agent" for PC GUIs, and is Apache-2.0 at repo level. The README's serving example needs NVIDIA H100-class GPUs. Quantisations are listed for Qwen2.5-VL, not clearly for Qwen3-VL. Per-size licences were not stated ([repo](https://github.com/QwenLM/Qwen2.5-VL)). Conclusion: the 2B and 4B sizes are the only plausible ones on a work PC. Their CPU/GPU cost and licence per size are unconfirmed.
- Moondream: Apache-2.0, 2B and 0.5B, "can be run locally". It lists detection and VQA. Hardware figures are not given ([repo](https://github.com/vikhyat/moondream)).
- Florence-2: not checked. huggingface.co was unreachable, and I will not cite a licence from memory.
- Conclusion: a VLM is a Phase 4 optional extra. UIA plus OCR answers most "what is on screen" questions at near-zero cost.

**Electron `desktopCapturer`.**
- Source says: `desktopCapturer.getSources({types:['screen','window']})` runs in the main process. `thumbnailSize` defaults to 150x150, so set it to the real size. The macOS and Linux notes do not apply to Windows ([Electron API doc on GitHub](https://github.com/electron/electron/blob/main/docs/api/desktop-capturer.md)). The official page (electronjs.org) was unreachable.
- Conclusion: use it for screenshots of the app's own window and of the screen. Windows-specific limits (for example, protected or DRM windows) are unconfirmed.

## 2. Desktop control

**Anthropic computer use tool.**
- Source says: the tool lets Claude control a desktop through screenshots, mouse and keyboard. The app runs each action "in an environment you control, such as a VM or container". The current version is the `computer_toolset_20260801` entry with 17 member tools and no beta header. It is available on Sonnet 5.5, Opus 5.5 and Haiku 5.5. Coordinates are in screenshot pixels. Each screenshot costs about 1,000-1,800 input tokens. 1024x768 or 1280x720 is recommended ([docs, read 2026-11-25](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)).
- Safety, per the same page: use a dedicated VM or container with minimal privileges. Avoid sensitive data and credentials. Limit internet access to an allowlist. Ask a human to confirm consequential decisions, and do that before each action runs, because a batch can finish a multi-step action in one turn. "In some circumstances, Claude follows commands found in content even when they conflict with your instructions." Classifiers scan screenshots for prompt injection, and you must obtain end-user consent before enabling it in your own product. The last 16k characters of the page were not read.
- Conclusion: it is a cloud-model loop that sends screenshots to the API. It is not offline, and not a fit for the real work desktop (client files, credentials, OneDrive). It suits only a sandbox, such as a throwaway VM or a dedicated Electron window. For the real desktop, prefer UIA actions on an allowlist.

**UIA actions and Windows input injection.**
- *Unsourced (from memory, learn.microsoft.com was unreachable):* UIPI blocks synthetic input from a lower-integrity process into an elevated window. The same applies to UIA calls from a non-elevated process. The helper therefore cannot drive elevated apps unless it is itself elevated. Verify before relying on it.
- Conclusion: design for "cannot act on elevated windows" and report that to the user in the HUD. Do not run the helper elevated.

**Safety patterns (conclusions, based on the computer-use guidance above):**
- Every action has a risk class. Read-only runs directly. Reversible actions run after a short on-screen "doing X" with a cancel window. Irreversible or external actions need an explicit confirm.
- An allowlist covers apps and actions. The default is deny.
- The HUD shows a persistent "agent acting" state with a red border.
- A kill switch: a global hotkey and a "stop" voice command that abort the queue.
- Log every action.

## 3. Spoken answers (TTS), offline

- Piper (rhasspy) has three Hungarian medium voices: `anna`, `berta`, `imre` ([VOICES.md](https://github.com/rhasspy/piper/blob/master/VOICES.md)). The code is MIT, but the repo was archived on 2025-10-06 and development moved to [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) (GPL-3.0). The per-voice dataset licences are not on those pages, and they live on the voices' Hugging Face cards, which were unreachable. Open question: the licence of each Hungarian voice.
- sherpa-onnx: Apache-2.0. It supports TTS, speaker identification and verification, and keyword spotting. It runs on Windows x64, x86 and arm64 and has a Node addon (`sherpa-onnx-node`). The README does not list TTS languages. It mentions Piper voices running through it ([repo](https://github.com/k2-fsa/sherpa-onnx)).
- Conclusion: the plan is sherpa-onnx with a Piper `hu_HU` voice, since it is one Apache-2.0 runtime that also covers speaker ID and wake words. Latency is unmeasured and no source gives figures. Measure on the target PC.
- SAPI / OneCore Hungarian voices: no source read, so installed-voice availability and latency are unconfirmed. Keep them as an offline fallback.

## 4. Identity and authorisation by voice

- SpeechBrain: Apache-2.0, lists ECAPA-TDNN under speaker recognition (paper arXiv 2005.07143, unreachable, so the EER is unconfirmed). The README does not list EER ([repo](https://github.com/speechbrain/speechbrain)).
- Resemblyzer: Apache-2.0, makes a voice profile from 5-30 s of speech and rejects scores below a threshold. It reports no EER, only a 0% result on a 100-utterance, 10-speaker demo. It says it "works best on English language only" ([repo](https://github.com/resemble-ai/Resemblyzer)).
- sherpa-onnx has speaker verification (see section 3).
- Anti-spoofing and replay: nothing was read on this. *Unsourced assumption:* a plain speaker embedding does not stop a recording or a synthetic voice.
- Conclusion: voice is a **convenience** factor only. Map it as follows.
  - **User level** (read-only questions): no voice check.
  - **Dev level** (run, build, commit): a matching voice may skip the confirm for reversible actions.
  - **All / risky** (delete, send, push, spend): a voice match is never enough. It needs a spoken passphrase *and* a keypress or a PIN on the keyboard. A challenge phrase with random words gives some replay resistance, but that is untested.
- Hungarian speaker-verification accuracy is unknown, because the models read about are English-centred. Enrolment and a threshold test on his own voice are required.

## 5. Hands-free and proactive

- openWakeWord: code Apache-2.0, but the pretrained models are CC BY-NC-SA 4.0. It supports English only. Custom words are trained from synthetic English-based TTS clips, so a Hungarian wake word is doubtful. The last release shown is v0.6.0 (2024-02-11) ([repo](https://github.com/dscripka/openWakeWord)).
- Porcupine: Apache-2.0 repo, but every example needs an AccessKey from the Picovoice Console. Languages listed are English, Mandarin, French, German, Italian, Japanese, Korean, Portuguese and Spanish. Hungarian is not listed. Other languages are offered to commercial customers case by case. Whether the key needs the network at runtime is not stated ([repo](https://github.com/Picovoice/porcupine), [licence](https://github.com/Picovoice/porcupine/blob/master/LICENSE)).
- sherpa-onnx keyword spotting exists (see section 3). Its Hungarian support is unconfirmed.
- Conclusion: skip wake words in Phase 3 and 4. Use push-to-talk (a hotkey, or the phone as a button). An English wake word such as "Computer" would work, but it makes wake-word false triggers a safety issue.
- Phone as remote mic: no source read. It is a plain LAN audio stream into the same `VRGVoice` bus (design, not researched). It needs a pairing token and a local-only bind.

## 6. Agentic multi-step tasks

- Source says: the computer use page warns that Claude may follow commands found in screen content and says to isolate it from sensitive data and actions (see section 2). That is the main risk when a screenshot goes to a model.
- I did not read the Claude Agent SDK or Claude Code docs in this session. Conclusion: hand a spoken task to a Claude Code session as *text plus an optional OCR/UIA description*, with the session's own permission mode as the gate. Screen text goes in as quoted data, never as instructions.

## Proposed Phase 3 and Phase 4

### Phase 3: "Eyes and voice" (screen understanding, spoken answers, still offline)

**Goal.** Ask "what is on screen?", "which window has the build error?" or "read the title of this tab", and get a terse text and spoken answer. No desktop control yet. Read-only across the whole desktop.

**Components.**
- UIA helper: a small spawned .NET or PowerShell process that dumps the focused window's control tree as JSON. Chosen because no maintained npm wrapper was confirmed (section 1). It is registered as a `describe()` provider named `desktop.uia`.
- OCR fallback: Windows OCR if `hu` and `en` are available at runtime, otherwise Tesseract `hun`+`eng`. Provider `desktop.ocr`. Triggered only when the UIA tree is thin.
- `desktopCapturer` for screenshots (own window and screen), kept in memory, never written to disk by default.
- TTS: sherpa-onnx with Piper `hu_HU` (Hungarian) and an English voice, in the main process, driven by the overlay's answer text. Voice licences need checking first.
- No VLM yet.

**Offline vs online.** All offline. The command grammar and answers come from the registry, as in Phase 2. Nothing leaves the PC.

**Safety design.**
- Read-only: no input injection at all.
- The HUD shows a camera-style indicator when capture or OCR runs. Screen text is displayed, never executed as a command.
- Providers are off by default per app and have an allowlist and a title-redaction list (for example password managers, banking, client folders). Redaction runs before anything is spoken or logged.

**Effort.** About 2-3 weeks solo. UIA helper about 1 week, OCR probe about 2-3 days, TTS wiring and voice choice about 1 week.

**Reuse.** Providers plug into the Phase 2 `describe()` list. Commands such as "mi van a képernyőn" go into the command registry. Events (`stt.final`, `answer.text`, `tts.start`, `tts.end`) go on the `VRGVoice` bus. The overlay HUD gets a speaking indicator and a "show source" toggle that displays the exact text the answer came from.

### Phase 4: "Hands" (controlled desktop actions, speaker gate, agent handoff)

**Goal.** Short spoken commands that act, for example "open the planner", "click Save", "start the build" and "ask a session to...", with confirm rules by risk and an optional voice check.

**Components.**
- Actions through UIA patterns (invoke, set value, focus) from the Phase 3 helper, on an allowlist of apps and verbs. Chosen over computer use because it works with no cloud and no screenshot.
- Risk classes `read`, `reversible`, `confirm`, `blocked`, stored with each registry command.
- Speaker verification: sherpa-onnx speaker verification, enrolled on his voice, used only as a convenience for the Dev level (section 4). The All level also needs a keypress or PIN.
- Handoff to a Claude Code session or the Agent SDK for open-ended tasks: text and quoted UIA/OCR excerpts only, with the session's permission mode as the gate. Online (the Anthropic API). Needs his explicit consent each time.
- Optional, behind a flag: the Anthropic computer use tool in a sandbox VM or separate Electron window only. Not on the real desktop (section 2).
- Optional: phone as remote push-to-talk over the LAN. No wake word.

**Offline vs online.** Local actions and speaker check are offline. Only the handoff and the optional sandboxed computer-use mode are online.

**Safety design.**
- Persistent "agent acting" HUD with a red border, and a global-hotkey kill switch plus a spoken "stop" that cancels the queue.
- Confirm before each risky action, and a visible countdown for reversible ones.
- Default deny, with an allowlist of apps and verbs.
- No input into elevated windows (UIPI, section 2). Say so in the HUD.
- Prompt injection: text read from the screen is data, wrapped and labelled when passed to a model, and never allowed to select an action by itself. Actions come only from the registry or from a confirmed user request.
- An action log that he can read.

**Effort.** About 4-6 weeks solo. The action layer and risk classes are about 2 weeks, speaker enrolment and threshold tests about 1 week, the agent handoff about 1 week, and testing and tuning the rest.

**Reuse.** The registry gains `risk` and `verb` fields. `VRGVoice` gains `action.proposed`, `action.confirmed`, `action.done` and `action.aborted` events. The HUD's confirm panel reuses the Phase 2 answer panel. `describe()` providers tell the model what it may touch.

## Risks and open questions

1. Hungarian OCR in Windows.Media.Ocr, and the licence of each Piper Hungarian voice, are both unconfirmed. Check both first.
2. No maintained npm UIA wrapper was confirmed. The helper process is something he would own and maintain.
3. Speaker verification: no EER figures were read, and Hungarian accuracy is unknown. Replay and synthetic-voice attacks are not addressed by the tools read. Keep voice out of the All level.
4. Wake words: Hungarian is not supported by the tools read, and openWakeWord's models are non-commercial. Hence push-to-talk only.
5. Piper's upstream moved to a GPL-3.0 fork. Check how that interacts with shipping it, or use the MIT archived code through sherpa-onnx.
6. VLM hardware needs, and OmniParser per-weight licences, are unconfirmed. Florence-2 was not checked.
7. UIPI behaviour, the SAPI/OneCore Hungarian voices, and TTS latency figures are unsourced here. Measure on his PC.
8. Screen content sent to any cloud model can carry client data and injected instructions. Keep it text-only and redacted, and ask for consent each time.
