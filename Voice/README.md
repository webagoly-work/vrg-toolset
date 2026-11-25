# Voice: Diktálás (WP-54), offline push-to-talk speech to text

Hold a key, speak Hungarian or English, and the words appear live in a text box of the VRG Asztal. The finished text stays there to be
edited. In the Vezérlő it goes through the Előszűrő only when you press Küldés. Everything runs on this machine. The text only ever
goes into the VRG Asztal's own text boxes: never into a web page, a browser tab, an in-shell app view or another program.

Layer 2 (WP-55, the voice command overlay) uses the same recordings in **command** mode. Its files are `Voice/command/`,
`Dashboard/page/voicecmd.*` and `Dashboard/test/wp-55.test.js`.

## The engine: whisper.cpp, as a resident `whisper-server`

| | whisper.cpp **(chosen)** | sherpa-onnx | Vosk | faster-whisper |
|---|---|---|---|---|
| Hungarian | yes: Whisper large-v3-turbo / medium / small; Hungarian fine-tunes exist and can be converted later | streaming transducers: none found for Hungarian; its Whisper support is non-streaming | no Hungarian model in the lists checked | yes (Whisper) |
| live words | pseudo-streaming: re-decode the growing buffer, stable-prefix rule | true streaming, but only for its own transducer languages | true streaming | pseudo-streaming |
| vocabulary bias | `prompt` (initial prompt) per request | hotwords only for transducer models, not for Whisper | grammar lists | initial prompt |
| Windows, portable | official release zip with `whisper-server.exe` (CPU, ~4 MB), MIT | prebuilt and a Node addon, Apache-2.0 | yes | Python + CTranslate2: a Python install, out |
| fine-tuning later | any Whisper fine-tune (Hugging Face) → convert to ggml → same server | — | — | — |

Sources:
- [whisper.cpp server README (mirror of `examples/server`)](https://sources.debian.org/src/whisper.cpp/1.8.3%2Bdfsg-2/examples/server/README.md). The flags and fields were also checked in `examples/server/server.cpp` at the pinned tag v1.8.3 (raw.githubusercontent.com):
  - per request, `prompt`, `language`, `no_timestamps` and `temperature_inc`;
  - `GET /health` answers 200 once the model is loaded;
  - verbose_json's `language` is a full name;
  - without `--convert` the upload is decoded in memory, with no temp audio file.
- [sherpa-onnx hotwords: transducer models only](https://csukuangfj.github.io/sherpa/onnx/hotwords/index.html).
- [Vosk model list](https://alphacephei.com/vosk/models) and [the Rhasspy mirror](https://huggingface.co/rhasspy/vosk-models): no `hu` folder.
- Hungarian Whisper fine-tunes, for later:
  - [sarpba/whisper-hu-large-v3-turbo-finetuned](https://huggingface.co/sarpba/whisper-hu-large-v3-turbo-finetuned): its card reports WER ≈ 7.5 % on its own evaluation set (dataset not named);
  - [BuzzASR/hungarian](https://huggingface.co/BuzzASR/hungarian): large-v3, FLEURS WER 14.7;
  - [Hungarians/whisper-medium-cv16-hu](https://huggingface.co/Hungarians/whisper-medium-cv16-hu/blob/main/README.md);
  - [SubZtep/whisper-small-hu](https://huggingface.co/SubZtep/whisper-small-hu): small, 46.8 → 15.6 WER after fine-tuning.

  These figures come from different test sets and are not comparable with each other.

**Not verified here:** Hugging Face was not reachable from the cloud session, so no model was downloaded, no Hungarian accuracy
was measured and no CPU timing was taken. These are the first checks on H: (below).

**Default model:** `ggml-large-v3-turbo-q5_0.bin` (~547 MB). `small` (~190 MB) is there for a slow machine, `medium` only to compare.
Choose with the setting `voice.model`.

## How it is fast

- **The 0.5 s start.** While the feature is on (setting `voice.enabled`), the microphone stays open. The page keeps the last
  300 ms of audio in a ring buffer, so a key press sends those 300 ms first: the first word is never cut. Measured in Chromium with a
  fake microphone, key-down → first audio sent to main took **13–14 ms**. That is an IPC call, no "speak now" wait.
- **The first words.** The model is loaded once and stays resident in `whisper-server` (127.0.0.1, a free port). Every 400 ms of
  held key, the whole buffer is decoded again, never queued. A word is fixed once two decodes agree on it (`engine/stable.js`).
  Language `auto` is detected once and then kept for the recording. The final decode on key-up replaces the live text.
- **Long speech.** A recording over 25 s is cut into segments (Whisper's window is 30 s); 5 minutes is the limit.

## Files

| File | What |
|---|---|
| `engine/host.js` | sessions, pseudo-streaming, the final, segments, the language lock (runs in Electron main) |
| `engine/whisper-server.js` | the real adapter: spawns `whisper-server` (`-m -t -nt -nlp --host 127.0.0.1 --port`), POST /inference |
| `engine/fake.js` | a deterministic engine for tests and the selftest (`VRG_VOICE_ENGINE=fake`) |
| `engine/stable.js`, `engine/wav.js` | the stable-prefix rule; PCM16 → WAV in memory |
| `vocab/build.js`, `vocab/extra.txt` | the bias prompt (≤ 600 chars). The sources, in order: the hand-written words, then the GO codephrases and the catalog titles, then (when asked) the job codes, then the first 20 command phrases of `command/commands.json`, then the START tool names. Job codes only go to the gitignored `Voice/.cache` |
| `fetch.js`, `voice-manifest.json` | download the engine and models into `<Full>\tools\voice`, sha256-pinned; the engine is pinned (tag v1.8.3) |
| `../Dashboard/shell/lib/voice.js` | main: the engine lifecycle, IPC `voice.status / enable / start / chunk / stop / cancel` |
| `../Dashboard/page/voice.js`, `voice-worklet.js`, `voice.css` | the page: the microphone, the key, the mode rule, live insertion, the indicator, `window.VRGVoice` |

## The page API (the contract with the command layer)

```
window.VRGVoice = {
  on(type, cb) → off()        start {id, mode, lang?} · partial {id, mode, text} · final {id, mode, text, lang?, ms} · stop {id, mode} · error {id?, mode?, hu}
  state() → { ready, engine, recording, mode, key, enabled, mic, capture, hint, timing }
  simulate(text, mode) → Promise   a fake utterance through the same pipeline (partial words, then the final)
  _emit(type, data)                for tests and probes
  hold(target) → release()         the 🎤 button's press-and-hold
  enable(on) / refresh() / cancel()
}
```

The mode is decided when the key goes down:
- **dictate:** the focus is in a text field of the frame page (textarea, input text or search, or contenteditable). Fields that are
  password, read-only or disabled don't count.
- **command:** anywhere else, and always with **Shift** + the key.

**Esc** cancels and restores the field. A browser tab or an in-shell app view never gets the key, because it is a native view with its
own keyboard focus.

## Privacy

- The audio lives in memory and is dropped at stop or cancel; whisper-server, started without `--convert`, writes no temp file.
- No transcript is logged, only lengths and timings.
- Text reaches only the frame page that asked for it.

## On H: (the first run)

```bash
node Voice/fetch.js --list
```

```bash
node Voice/fetch.js engine
```

```bash
node Voice/fetch.js --pin turbo
```

- **`engine`:** the sha256 is pinned already (checked in the cloud: the zip holds `Release/whisper-server.exe`).
- **`--pin turbo`:** about 547 MB. Its sha256 is not pinned yet: check the source, then pin it and commit the manifest.

Then switch it on: right-click the Vezérlő's 🎤 (or set `voice.enabled`), wait for the model to load, and hold F9 in the Vezérlő's
box. Check these first:
- Hungarian and English accuracy on 10 sentences of your own;
- the time to the first partial and the CPU load during a 20 s dictation;
- that `state().capture` is `worklet` (from `file://` Electron may refuse the module fetch; then `script`, a ScriptProcessor fallback
  on the main thread);
- the probe: `node Dashboard/test/run.js WP-54`.

## Later: training online, staying offline

- **Vocabulary first, free and immediate:** add to `vocab/extra.txt`, rebuild with `node Voice/vocab/build.js`; the prompt is reloaded
  at the next start.
- **A Hungarian fine-tune of turbo**, converted with whisper.cpp's `models/convert-h5-to-ggml.py` and added to the manifest as a new
  model id. Training and conversion run online once; the result runs offline like any other model.
- **Our own voice:** later, keep (opt-in, a setting) the audio and the corrected final text of dictations as pairs, and fine-tune a
  LoRA on them. Nothing of this is built: audio is never kept today.
