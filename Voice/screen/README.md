# Szem — the screen reader of the voice overlay (WP-56, phase 3a)

Phase 3 of `docs/research/2026-11-25_voice-roadmap.md`: "mi van a képernyőn?", "melyik ablakban van hiba?", "olvasd fel" for the
**whole desktop**, not only the VRG Asztal. It is **read-only and offline**. The answer is terse Hungarian text: `say` is at most 8
words, for the HUD and for speech (WP-57); `detail` is at most 200 characters; `lines` are the text found, at most 40.

## What it never does

- **No input:** it never clicks, types, invokes, sets a value or moves the focus. `uia-host.ps1` only reads `Current.*` properties,
  `ValuePattern.Current.Value` and the TextPattern selection. A test fails if `InvokePattern`, `SetValue`, `SetFocus`, `SendKeys`,
  `SendInput` or a file write appears in it.
- **No passwords:** a password field's value is never read (`IsPassword`).
- **Not on disk:** screenshots stay in memory, and nothing is logged except error codes and timings.
- **Not denied windows:** no denied window is described, and its title is not even said.
- **Not elevated windows:** a window that runs as administrator answers `elevated`. UIPI forbids reading it, and we do not work
  around that.
- **No cloud:** nothing is sent anywhere.

## The API (Electron main uses it; no Electron import here)

```js
const { createScreen, summarize, redact, policyCheck, DEFAULT_POLICY } = require('<repo>/Voice/screen/screen.js');
const scr = createScreen({
  spawn,        // child_process.spawn
  powershell,   // e.g. path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  capture,      // async () => ({ png: Buffer, width, height } | null): desktopCapturer, the primary screen (or the focused window)
  ocr,          // createOcr({ dataDir: <Full>/tools/voice/tessdata }) from ./ocr.js, or null
  policy,       // () => ({ enabled, allow: [proc…], deny: [proc…], denyTitles: [regex source…], redact }); missing keys = DEFAULT_POLICY
  ownPids,      // () => [pid…] of the VRG Asztal (app.getAppMetrics().map(m => m.pid)): its windows come back own:true, no text
  log,          // optional
  // optional: script (another uia-host.ps1), timeoutMs (default 3000)
});
await scr.describe({ what: 'focused' | 'windows' | 'error' | 'read', maxNodes? })
//  → { ok:true, source:'uia'|'ocr'|'uia+ocr', app, title, own, say, detail, lines, redacted, ms }
//  | { ok:false, err:'denied'|'disabled'|'no-window'|'unavailable'|'error'|'elevated', hu }
scr.close();    // stops the helper ("quit", then kill)
```

Also exported for tests and for other callers: `appName`, `cleanTitle`, `createHost`, `luhn`, `THIN`.

- **`focused`:** the app and the title ("Chrome: Pull request #13 · webagoly-work/vrg-toolset"), the focused element
  ("Fókusz: szerkesztőmező „Keresés”"), and the visible texts in tree order. Offscreen nodes, the title bar and scroll bars are left
  out.
- **`windows`:** "4 ablak: Chrome, VS Code, Total Commander és mások". Denied windows are counted ("+1 rejtett") but never named; the
  VRG Asztal is named as itself.
- **`error`:** texts that look like errors: error / failed / exception / cannot / not found / hiba / sikertelen / elbukott / nem
  sikerült. "0 errors" and "nincs hiba" do not count. Text colour (a red status) is not visible to UIA; only OCR could see it, and it
  does not read colours yet.
- **`read`:** the selected text (TextPattern), else the focused field's value, else the largest document or edit value, else the
  sentence-like texts.
- **OCR fallback:** when the tree has fewer than `THIN` (5) named visible nodes — a canvas, a game, a remote desktop, a PDF viewer
  without a11y — or when `read` finds nothing, it takes `capture()` → `ocr.recognize()`. The source becomes `ocr` or `uia+ocr`.

## Policy and redaction

- **`DEFAULT_POLICY`:**
  - denies password managers (KeePass, KeePassXC, 1Password, Bitwarden, LastPass, Dashlane, Enpass), the Windows credential and UAC
    prompts, and AnyDesk / TeamViewer;
  - denies by title: banking (OTP, K&H, Erste, Raiffeisen, UniCredit, CIB, Revolut, Wise, PayPal, "netbank", "internetbank"),
    "jelszó" / "password", Ügyfélkapu, and the client folders (`jobs\`, `Planner_projektek`);
  - a non-empty `allow` means only those processes.
- **`redact()`** runs on the title, every line, `say` and `detail` before anything leaves `describe()`. It replaces:
  - e-mails;
  - phone numbers (+36 / 06 forms, international);
  - IBANs and HU bank accounts (8-8 / 8-8-8);
  - card numbers (only when the Luhn check passes);
  - adószám (8-1-2), adóazonosító (8 + 9 digits) and TAJ (3-3-3);
  - token, key, signature and `vrg_s` URL parameters;
  - `password:` / `jelszó:` / `token=` values;
  - GitHub, AWS, `sk-` keys, JWTs, and long mixed base64.

  Ordinary numbers stay: "2 teszt", "M16", "v1.8.3", dates, "32 A", PR numbers, repo paths. `policy.redact === false` turns it off,
  for your own debugging only.

## The helper protocol (`uia-host.ps1`)

One Windows PowerShell 5.1 process, started once (`-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File uia-host.ps1`,
no window) and kept. A request that hangs past `timeoutMs` gets the process killed and **one** restart; a crash gets one restart
too. JSON lines:

```
→ {"id":"1","op":"ping"}                                   ← {"id":"1","ok":true,"pong":true,"ps":"5.1.19041.4648"}
→ {"id":"2","op":"focused","maxNodes":400,"budgetMs":1500} ← {"id":"2","ok":true,"win":{"hwnd":..,"pid":..,"process":"chrome","title":"..","cls":".."},
                                                              "focus":{node}|null,"selection":"..."|null,"nodes":[{node}…],"truncated":false,"ms":120}
→ {"id":"3","op":"windows"}                                ← {"id":"3","ok":true,"windows":[{"hwnd":..,"pid":..,"process":"..","title":"..","cls":"..","min":false}]}
                                                           ← {"id":"2","ok":false,"err":"elevated"|"no-window"|"bad-request"|"error","msg":".."}
node = {"role":"Edit","name":"..","value":".."|null,"aid":"..","cls":"..","off":false,"focus":true,"pw":false,"depth":3,"rect":[x,y,w,h]}
```

- **Walking the tree:** depth-first over the control view, within a node budget (400 by default, at most 1500) and a time budget
  (1.5 s, at most 5 s). An offscreen container below depth 1 is not entered.
- **Encoding:** the script is pure ASCII, because Windows PowerShell 5.1 misreads a BOM-less script with accents (CLAUDE.md). Every
  non-ASCII character is written as `\uXXXX`, and stdout is UTF-8 without a BOM.

## OCR: tesseract.js + tessdata_fast

- **Engine:** [tesseract.js](https://github.com/naptha/tesseract.js) 7.0.0 (Apache-2.0, WebAssembly, runs in Node with no network
  once the language data is local). It is installed only in this folder: `npm ci --ignore-scripts`, with every package and its
  sha512 in `package-lock.json`. `node_modules/` is gitignored.
- **Language data:** [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) tag 4.1.0 (Apache-2.0), `hun` (5.1 MB) and
  `eng` (4.0 MB), pinned by sha256 in `Voice/voice-manifest.json → ocr`. They come from `raw.githubusercontent.com`, because
  `github.com/…/raw` was refused by this environment's proxy.

```bash
node Voice/screen/fetch-ocr.js --npm      # traineddata into <Full>/tools/voice/tessdata (sha256 checked) + npm ci here
node Voice/screen/fetch-ocr.js --list
```

- **Measured in the cloud container** on a rendered line, "Hiba: a fordítás sikertelen — 2 teszt elbukott / Munkamenetek · Vezérlő ·
  Előszűrő · Kapu belépés / Build failed: 3 errors in Dashboard/shell/main.js":
  - every word and every accent was right;
  - only the `·` separators came back as `:` / `-`;
  - confidence 93;
  - the first call took 485 ms (it loads the languages), later calls 194 ms.
- **`engine: 'windows'`** (Windows.Media.Ocr) is a stub: see the TODO in `ocr.js`.

## What the local session must verify on Windows (it never ran there)

1. **The helper starts.** Start it by hand:
   `powershell -NoProfile -ExecutionPolicy Bypass -File Voice\screen\uia-host.ps1`, type `{"id":"1","op":"ping"}`, then
   `{"id":"2","op":"windows"}` and `{"id":"3","op":"focused"}` (it describes the console itself).
   - Check that Avast lets it start: it is one start per Desktop run, not per request.
   - If `-File` is blocked, run it in-process instead (`-Command ". 'path\uia-host.ps1'"`).
2. **Chrome / Edge.**
   - Chromium builds its accessibility tree only when it detects an assistive client. Check whether a UIA client like this one
     wakes it: does `focused` on a GitHub page give the page texts, or only the frame?
   - If only the frame, the OCR fallback answers anyway (a thin tree). Starting the browser with `--force-renderer-accessibility`
     gives the full tree; `chrome://accessibility` shows the state.
   - Note what you find here.
3. **VS Code** (Electron; same question as Chrome — check the Problems panel texts with `error`), **Explorer**, **Total Commander**,
   a **PDF** in the browser and in SumatraPDF, a **game** or **canvas** (it must fall back to OCR).
4. **An elevated window** (Task Manager or an admin PowerShell): `elevated` or a thin tree, never a hang.
5. **Hungarian OCR on real screens** (ClearType, 125 % / 150 % scaling): accuracy on 5 screenshots, and the time per call.
   - If it is slow on a 4K screen, crop to the focused window: pass its rect to `ocr.recognize(png, { rect })`.
   - Check whether Windows OCR has Hungarian (`Get-WindowsCapability -Online -Name 'Language.OCR~~~hu-HU*'`). If it does, it is
     worth comparing.
6. **Timings:**
   - `focused` on a heavy page (GitHub, a long VS Code file): it must stay under the 1.5 s budget and report `truncated` when cut;
   - the first `describe()` (the helper's start plus the UIA assembly load);
   - the first OCR.
7. **The policy:** a KeePassXC window, an OTP Bank tab and a `jobs\` folder in Explorer must all answer `denied`, with no title said.
