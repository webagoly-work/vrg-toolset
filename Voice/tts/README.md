# Hang: spoken answers, offline (WP-57, phase 3 of the voice work)

The command overlay's terse answers (WP-55) said aloud, in Hungarian and English, without the internet. This folder is the engine
side only: `tts.js` turns an answer into speech. The Desktop wiring (settings, IPC, playing the PCM in the page, barge-in when the
push-to-talk key goes down) is the main session's.

## The choice

| | Hungarian | Offline | First audio, 6 words | Licence | Verdict |
|---|---|---|---|---|---|
| **sherpa-onnx 1.13.8** (`sherpa-onnx-node`) + **Piper VITS voices** | 3 voices (anna, berta, imre) | yes | **64–157 ms** on 4 CPU cores, measured | Apache-2.0 code; voices: see below | **default** |
| Windows SAPI (`System.Speech`) in one PowerShell helper | only with the Hungarian language pack's speech voice | yes | not measured here (Windows only) | part of Windows | **fallback** |
| sherpa-onnx 2.x | Piper voices fail | — | — | — | not usable as is |

- **sherpa-onnx** ([repo](https://github.com/k2-fsa/sherpa-onnx), Apache-2.0) ships `sherpa-onnx-node`, an N-API addon with
  prebuilt binaries per platform (`sherpa-onnx-win-x64`, `sherpa-onnx-linux-x64`, … as optional npm dependencies). It needs no
  compiler. `OfflineTts.generateAsync({ text, sid, speed, onProgress })` returns `{ samples: Float32Array, sampleRate }`;
  returning `0` from `onProgress` aborts after the current sentence, which is how `stop()` works.
- **Stay on 1.13.x.** 2.0.0 (2026-10-23) removed the built-in espeak-ng phonemizer for VITS / Piper models. A Piper voice then
  fails with "phoneme_codepoints is empty, no lexicon, and no frontend available … Failed to convert … to token IDs" unless an
  external phonemizer feeds it. 1.13.8 (2026-09-10) still has espeak-ng inside; that is the pinned version (tested here on
  linux-x64, 2026-11-25).
- **The voices** come from sherpa-onnx's `tts-models` release as `vits-piper-<voice>.tar.bz2`: the Piper `.onnx`, `tokens.txt`
  and `espeak-ng-data/`, about 64 MB each, 22 050 Hz.
- **SAPI** is the fallback for a PC without the addon. Hungarian SAPI / OneCore voices exist only when the Hungarian language pack
  with its speech feature is installed (Settings → Time and language → Speech). Without one, the helper speaks English and
  `status()` says why.

### Measured here (linux-x64, 4 cores, sherpa-onnx-node 1.13.8, 2 threads)

| Voice | Text | Load (once) | Generation | Audio | RTF |
|---|---|---|---|---|---|
| hu anna | "Hiba a fordításban, két teszt elbukott." | 561 ms | 120 ms | 2.65 s | 0.045 |
| hu anna | "Megnyitottam a Plannert." | (loaded) | 64 ms | 1.57 s | 0.041 |
| hu imre | "Megnyitottam a Plannert." | 542 ms | 86 ms | 1.49 s | 0.058 |
| en amy | "Opened the Planner." | 839 ms | 60 ms | 1.22 s | 0.049 |
| via `createSpeaker`, warm | 3 Hungarian answers | — | 61–157 ms | 1.6–3.5 s | — |

The 300 ms target for the first audio holds once the voice is loaded, so `warm(['hu', 'en'])` loads the voices when the feature
is switched on. The load takes about 0.5–0.9 s once per voice.

## Voices and licences: decide before any use outside your own PC

| Voice | Dataset | Model card says | Flag |
|---|---|---|---|
| `hu_HU-anna-medium` (female, default) | NabuCasa voice-datasets, **CC0** | "Finetuned from U.S. English lessac voice (medium quality)" | **unclear** |
| `hu_HU-berta-medium` (female) | NabuCasa voice-datasets, **CC0** | same | **unclear** |
| `hu_HU-imre-medium` (male) | NabuCasa voice-datasets, **CC0** | same | **unclear** |
| `en_US-amy-medium` (female, default) | MycroftAI mimic3-voices, "License: See URL" | fine-tuned from lessac | **unclear** |

The Hungarian recordings themselves are CC0. Every one of these voices was fine-tuned from the Piper **lessac** voice, though,
and lessac was trained on the Blizzard Challenge 2013 data. That dataset's terms are widely reported as non-commercial research
use. I could **not** read them from here (cstr.ed.ac.uk is blocked in this session), so that part is unverified. For speaking
answers to you on your own PC this is unlikely to matter. For anything you ship or sell, read the terms first, or pick a voice
trained from scratch on a permissive dataset. The manifest marks every voice `UNCLEAR` until you decide.

## The API (`tts.js`)

```js
const { createSpeaker, speakable, ENGINES, addonLoader } = require('<repo>/Voice/tts/tts.js');
const dirs = { models: '<Full>/tools/voice/tts', node: '<Full>/tools/voice/tts/node' };
const sp = createSpeaker({ engine: 'sherpa' | 'sapi' | 'none', dirs, loadAddon: addonLoader(dirs),
  spawn: require('child_process').spawn, powershell: '<SystemRoot>/System32/WindowsPowerShell/v1.0/powershell.exe',
  voices: { hu: 'hu_HU-anna-medium', en: 'en_US-amy-medium' }, threads: 2, log });
await sp.status()                       // { ok, engine, ready, voices: [{ id, lang, name }], reason? }
sp.warm(['hu', 'en'])                   // load the default voices now (once ~0.5–0.9 s each)
await sp.say(text, { lang: 'hu' | 'en' | 'auto', voice, rate })
//   sherpa → { ok: true, id, pcm: { sampleRate, samples: Float32Array }, ms, chars, lang, voice }   the page plays it
//   sapi   → { ok: true, id, played: true, ms, chars, lang, voice }                                 the helper plays it
//   else   → { ok: false, err: 'off' | 'empty' | 'not-ready' | 'stopped' | 'replaced' | 'error', hu }
sp.stop()                               // barge-in: the waiting answer is dropped, the current one ends (sherpa: after its sentence)
sp.close()
speakable(text, lang)                   // pure: the text the voice will say
```

- **One answer at a time.** A `say()` during another waits; a third replaces the waiting one, which resolves `'replaced'`.
- **`stop()`** also drops an answer that is still picking its voice. The page must stop its own playback of a PCM it already got.
- **`rate`** is 0.5–2. sherpa passes it as `speed`; SAPI maps it to its −10…10 scale.

### `speakable()`: what the voice actually says

Markdown, code, emoji, links, brackets and ellipses go. Paths become their last part ("voice pont js"). Answers are capped at two
sentences and 240 characters. A line break becomes a short pause. From `lexicon.json`, which you can extend:
- **phrases:** "GO MOBILE" → "gó mobil", "Claude Code" → "klód kód";
- **words:** VRG → "vé-er-gé", PR → "pí-ár", Planner → "plenner"; a capitalised word also keeps a Hungarian ending (Plannert →
  "plennert");
- **acronyms** that are not in the lexicon are spelled out (CPU → "cé-pé-ú");
- **codes:** "M16" → "em tizenhat", "WP-54" → "dupla vé-pé ötvennégy";
- **symbols:** "%" → "százalék", with "40%-on" → "negyven százalékon".

Hungarian numbers are spelled out up to 999 999: 2026 → "kétezer-huszonhat", and "kettő" becomes "két" before a noun ("két
teszt"). English keeps digits, which the English voice reads.

### The SAPI helper protocol (`sapi-host.ps1`)

- **One** long-running `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File sapi-host.ps1`, started on first use
  and restarted after a crash. It is one process because Avast was seen blocking freshly started script processes (CLAUDE.md).
  The first start may still be blocked: test it.
- The script is **ASCII only**, because PowerShell 5.1 misreads accents in a BOM-less script. The text travels **base64 UTF-8**.
- In: `{"op":"voices"}`, `{"op":"speak","id","text","voice","rate"}`, `{"op":"stop"}`, `{"op":"quit"}`.
- Out: `{"ev":"ready"}`, `{"ev":"voices","voices":[{name,culture}]}`, `{"ev":"done","id","ok","cancelled?"}`, `{"ev":"error","msg"}`.
- `stop` → `SpeakAsyncCancelAll()`.

## Fetching (`fetch-tts.js`)

```bash
node Voice/tts/fetch-tts.js --list
node Voice/tts/fetch-tts.js                          # the addon for this platform + hu anna + en amy
node Voice/tts/fetch-tts.js hu_HU-imre-medium        # one more voice
```

- **Layout:** everything goes to `<Full>/tools/voice/tts` (`node/node_modules/…`, `vits-piper-*/`, `installed.json`). Nothing
  goes into the repo.
- **Checks:** npm tarballs against the manifest's sha512 integrity (the repo's npm rule: exact version); voice archives against
  sha256. The pins are in `Voice/voice-manifest.json` → `tts`, and were all fetched and checked here on 2026-11-25.
- **Unpacking:** archives open with Windows' own `System32\tar.exe` (bsdtar reads `.tar.bz2`).

## Tests

`node --test Voice/tts/test/tts.test.js` covers:
- `speakable()`, 35 cases in Hungarian and English;
- the Hungarian numbers;
- status when nothing is installed;
- the sherpa adapter on a fake addon (voices, PCM shape, language and voice pick, rate);
- the queue, replace and stop semantics;
- the SAPI protocol on a fake spawn (voices, base64 text, rate, stop → cancel, crash → restart, no Hungarian voice);
- the manifest pins, and that the `.ps1` is ASCII.

With `VRG_TTS_REAL=<Full>/tools/voice/tts` it also synthesises a real Hungarian answer and checks that it takes under 300 ms and
is not silence.

## For the local session (Windows)

1. Run `node Voice/tts/fetch-tts.js`, then
   `VRG_TTS_REAL=H:\VRG\Full\tools\voice\tts node --test Voice/tts/test/tts.test.js` (the real test must pass on win-x64).
2. In Electron, check that `addonLoader(dirs)()` loads. It is an N-API addon, so it should; say if it does not.
3. Listen to anna, berta and imre saying 10 typical overlay answers, and let the Founder pick the voice (the `voices.hu` option).
   Extend `lexicon.json` with any word that sounds wrong.
4. Measure warm answer time and CPU on his PC.
5. SAPI:
   - start the helper once, and see whether Avast blocks it;
   - list the voices;
   - is there a Hungarian one? Without the Hungarian speech pack there is not.
6. Ask the Founder about the voice licences (above) before the voices are used for anything but his own answers.
