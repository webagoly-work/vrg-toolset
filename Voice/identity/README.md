# Hangazonosítás: offline speaker verification (WP-59)

Phase 4b of the voice work (`docs/research/2026-11-25_voice-roadmap.md`). It checks whether the person speaking is the enrolled
owner, using the same sherpa-onnx addon the spoken answers use, a 28 MB model, and about 40 ms per check. It is fully offline.

## What it is for, and what it is not

- **It is a convenience at the Dev level only.** A match may replace the confirm click for reversible and confirm-class actions while
  the Desktop is at the Dev level.
- **It is never an authorisation:**
  - the All level always needs a keypress or a PIN;
  - blocked actions stay blocked;
  - a match alone never starts anything risky.
- **Known attacks it does NOT stop:**
  - **replay:** a recording of the owner's voice;
  - **synthetic voices:** TTS / voice cloning. The cloud test below enrolled a *synthetic* voice without complaint and verified it
    perfectly. That proves the plumbing, and shows how easily a cloned voice would pass.

  The UI must say this wherever the feature is offered.
- There is no liveness check and no anti-spoofing model. The research found no offline, permissively licensed one that we could
  verify (`docs/research/2026-11-25_voice-phases-research.md` § 4).

## The API (`identity.js`)

```js
const { createIdentity, cosine, MIN_SECONDS } = require('<repo>/Voice/identity/identity.js');
const id = createIdentity({ loadAddon, modelPath, store: { get, set }, log?, threads?, threshold? });
await id.status()        → { ok, ready, enrolled, need, threshold, model, reason? }
await id.enroll(pcm16)   → { ok:true, enrolled, need } | { ok:false, err:'too-short'|'noisy'|'inconsistent'|'unavailable', hu }
await id.verify(pcm16)   → { ok:true, score, match, threshold, ms } | { ok:false, err:'not-enrolled'|'too-short'|'noisy'|'unavailable', hu }
id.reset()               → { ok:true }      // forget the voice: store.set(null)
id.setThreshold(x)       → { ok:true, threshold } | { ok:false, err:'bad-threshold', hu }   // 0.3 … 0.9
```

- **Input:** `pcm16` is an `Int16Array` or a Buffer of little-endian int16, at 16 kHz mono, which is what WP-54's page already sends to
  main. A `Float32Array` in [-1, 1] is accepted too.
- **Audio checks:**
  - An energy trim on 20 ms frames cuts the leading and trailing silence and keeps 100 ms on each side.
  - **`too-short`:** under `MIN_SECONDS` (1.5 s) of detected speech.
  - **`noisy`:** sound all through with no speech standing out of it (steady noise, or speech buried in noise).
  - **`inconsistent`:** an enrolment sample whose cosine to the samples so far is under 0.25, which means another speaker or a bad
    take.
- **Scoring:** the cosine of the new embedding against the mean of the enrolment embeddings (each normalised, averaged, normalised
  again). It is a `match` when the score is at or above the threshold.
- **Enrolment:** 3 samples are needed; the newest 10 are kept.
- **Threshold:** the default comes from the model (CAM++ 0.5). `setThreshold` stores it with the profile.
- **Errors:** every `ok:false` carries a Hungarian `hu` for the overlay.

## Privacy

- An embedding is biometric data, so:
  - **the store holds only embeddings:** 512 numbers each, rounded to 4 decimals, at most 10, plus the model id, the dates and the
    threshold. That is about 4 KB per sample. **Never audio.** Audio is passed in memory and dropped after the call.
  - **this module never writes a file.** It gets a `store { get, set }`; main keeps the blob encrypted with Electron `safeStorage`,
    like the other secrets.
- **Deleting it:** one command ("felejtsd el a hangom", or a settings button) calls `id.reset()` → `store.set(null)`.
- **Network:** nothing leaves the PC. The model is fetched once; after that, no network is used.
- **Changing the model** makes the stored embeddings incomparable, so `status()` reports it and asks for a fresh enrolment.

## The model

| | |
|---|---|
| File | `3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` (28.2 MB, 512-dim embeddings, 16 kHz) |
| Source | sherpa-onnx GitHub release [`speaker-recongition-models`](https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-recongition-models) (the upstream spelling); pinned by sha256 in `Voice/voice-manifest.json → identity` |
| Origin | [3D-Speaker](https://github.com/modelscope/3D-Speaker) CAM++, trained on VoxCeleb2-dev (5,994 speakers) |
| Licence | 3D-Speaker code: Apache-2.0 ([LICENSE](https://github.com/modelscope/3D-Speaker/blob/main/LICENSE)); VoxCeleb data: CC BY 4.0 |
| Reported EER | 0.73 % on VoxCeleb1-O, 0.65 % with large-margin fine-tuning ([egs/voxceleb/sv-cam++](https://github.com/modelscope/3D-Speaker/tree/main/egs/voxceleb/sv-cam++)) |
| Why | The best separation of three candidates on the cloud test, and the fastest (≈ 35–40 ms a check on 2 cores; 0.34 s to load) |

The alternative is pinned as well: WeSpeaker ResNet34 (`wespeaker-resnet34`, 25 MB, 256-dim). Its VoxCeleb models follow CC BY 4.0
([docs/pretrained.md](https://github.com/wenet-e2e/wespeaker/blob/master/docs/pretrained.md)). Its default threshold is 0.7, because
its impostor scores run higher.

**Language:** VoxCeleb is mostly English-speaking celebrities. Speaker embeddings are largely language-independent, but the
Founder's Hungarian accuracy is unmeasured. That is the reason for calibrating.

## The cloud test (synthetic voices: plumbing, not accuracy)

Piper voices were synthesised with the same addon (anna, berta and imre in Hungarian, amy in English) and resampled from 22.05 to 16 kHz.
Enrolment used 3 sentences; the rest were verified. Each sentence was a different text at 0.9–1.08× speed.

| Model | Owner anna (5 others) | berta | imre | amy | Owner imre (5 others) | Max other |
|---|---|---|---|---|---|---|
| **CAM++ VoxCeleb** | **0.808–0.886** | 0.319–0.409 | 0.116–0.186 | 0.216–0.350 | **0.770–0.837** | 0.206 |
| WeSpeaker ResNet34 | 0.798–0.915 | 0.531–0.689 | 0.366–0.472 | 0.544–0.644 | 0.834–0.864 | 0.481 |
| ERes2Net-base (zh-cn) | 0.789–0.885 | 0.329–0.449 | 0.152–0.299 | 0.373–0.507 | 0.635–0.751 | 0.293 |

- The hardest pair is anna vs berta, two Hungarian female voices from one training recipe. Even there, CAM++ leaves a gap of 0.4.
- Real voices score lower and spread wider: microphone, room, distance, a cold.
- `calibrate.js` on the WAVs suggested 0.38 at zero false accepts; on real recordings expect something between 0.4 and 0.6.
- The store for 3 samples was about 11.6 KB.

## Enrolment (UX for the main session)

1. **What to say:** three takes of about 3 s each. The authorisation phrase itself ("VRG, fejlesztői szint. Jogosult vagyok."), then
   two ordinary sentences of the person's choosing, at the desk, in a normal voice.
2. **After each take:** show "1/3, 2/3, 3/3". On `too-short`, `noisy` or `inconsistent`, show its `hu` and ask again.
3. **More samples:** later takes (up to 10) steady the mean. Offer "+1 minta" now and then, never silently.

## For the local session (H:)

1. **Fetch:**
   - `node Voice/tts/fetch-tts.js addon` (if not done; the same sherpa-onnx-node 1.13.8);
   - `node Voice/identity/fetch-identity.js` (`--list` shows the state).
2. **Tests:**
   - `node --test Voice/identity/test/identity.test.js`: 7 pass, 1 skipped.
   - The real test: `VRG_IDENTITY_REAL=H:\VRG\Full VRG_IDENTITY_WAVS=<a folder of owner-*.wav and other-*.wav>`.
3. **Record:** ≥ 10 owner utterances of 2–4 s (the phrase and ordinary commands; near and a bit further from the mic), plus a few other
   voices if anyone is around.
4. **Calibrate:**
   - `node Voice/identity/calibrate.js --owner owner-*.wav --others other-*.wav --far 0.01`;
   - set the suggested threshold with `setThreshold`;
   - report the genuine and impostor ranges.
5. **Check:** a recording of the owner played from a phone into the mic. It will very likely pass. That confirms the replay caveat,
   and that the All level must never accept the voice alone.
6. **Electron:** check the addon loads inside Electron, and the time per check.
