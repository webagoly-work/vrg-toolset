# VRG Mobile: decisions

Answered ones stay here with the date. Open ones are asked in the session's reply as numbered A/B/C
options as well (the user answers like "A, A, B"), and the answer is recorded here.

## Answered

- **D-1 · App identity** (2026-10-29: **A**). New app id `hu.vrg.mobile`, installed beside the old
  `hu.vrg.legeger`. Légegér's settings do not carry over (it is a different app sandbox).
- **D-2 · GitHub sign-in** (2026-10-29: **A**). The GitHub **device flow**: the phone shows a code, and the
  user enters it at github.com/login/device. No client secret in the app. Needs a GitHub OAuth App with
  device flow enabled (a user step in M3). QR-from-the-PC is not the sign-in path. M2's QR pairs the
  phone with the relay, not with GitHub.
- **D-3 · Where the updater gets new versions** (2026-10-29: **A**). **GitHub Releases**, created by Actions,
  with a stable signing key held in a repo secret (user step in M9). Actions artifacts stay as
  the per-push test builds.
- **D-4 · Folder and launcher** (2026-10-29). `AirDeck/` became `Mobile/`, and `legeger.cmd` became
  `mobile.cmd`. START opens VRG Mobile on key **L** (launcher/vrg-menu.json; A is Programok since 2026-10-27).
- **D-5 · Start screen** (2026-10-29). The app reopens the feature that was on screen last, and Back goes
  home. So a Légegér user lands on the deck, as before.

- **M1 · Where the look is set** (2026-10-29, no question needed). Palette and size are the shell's
  (`ShellSettings` in kit), applied by `ShellActivity` around every screen. Légegér's ⚙ keeps a Megjelenés
  line that shows the current look and opens Beállítások; it has no palette of its own. Its stored look is
  handed over once on the first M1 start (`ShellPrefs.adoptLook`), then removed from Légegér's store.

- **M2 · How pairing is built** (2026-10-29, no question needed). The relay link became the app's (`kit: Relay`),
  so the relay address moved from Légegér to `ShellSettings.relayUrl` (handed over once, like the look). The scanner
  is ML Kit's **bundled** model (no Play-services download). The relay's `/pair` QR is drawn with the Planner's own
  encoder (`src/05f-qr.js`, Nayuki, MIT), read from that file rather than copied. `--shots` now needs a paired
  phone, so the old `hu.vrg.legeger` APK (which cannot pair) no longer gets screenshots.

- **M3 · Which GitHub app** (2026-10-30, the WP default). A classic **OAuth App** with Device Flow, scopes
  `repo notifications`; the Client ID goes in `Mobile/android/kit/src/main/res/values/github.xml`. A GitHub App with
  fine-grained permissions (contents + notifications on this one repo) would be narrower; it can replace the OAuth App
  later without touching the features, since they all go through `kit: GitHub`.

- **D-6 · Chat-log branch (M6)** (2026-10-30: **A**). One branch `mobile-log`, one file per day
  `log/YYYY-MM-DD.md`. The branch name is a constant and the client writes no other branch.

- **M12 · File board** (2026-10-30, the user's request). Transfers go through a shared two-way board in
  `H:\VRG\Full\inbox\board\`, shown at `localhost:47291/board` on the PC and in the app, instead of the one-way
  `POST /drop` first planned. The Planner and Inventory routes stay as targets of a board file. In M12 only the PC's
  browser and the paired app use it; a phone browser would need its own one-time QR and is left for later.

- **M13 · Live screen** (2026-10-31, the user's request). A refresh loop of JPEG frames from one long-running capture
  process, not a video stream: no new tool (`ffmpeg` is not in the toolchain) and no video player in the app. It is
  viewing plus Légegér's existing pointer, with no new way of controlling the PC. A video stream can replace the loop
  later if the measured frame rate is not enough.

- **D-8 · Which branches are "active" (M4)** (2026-10-31: **A, reworded**). `main` first (its commits, CI, the tools changed
  in 7 days), then only a branch ahead of `main` with a commit in the last 14 days. `mobile-log` is left out. Asked with the
  facts of that day: every line of work lands on `main`, and 7 of the 8 other branches had nothing unmerged.

- **M14 · Gömb** (2026-11-01, the Founder's SOL-Q1 = A, SOL-Q2 = B). Built out of the table's order, on the Founder's word.
  The phone reads and rules on `solomon-data`, a data-only branch the PC makes; `Contents.putBody` now accepts that branch
  as well as `mobile-log`. Its own tabs change by tapping, so a sideways swipe on that page always means the home screen.

- **M16 · Kit** (2026-11-04, the user's `1A 2A 3A 4A 5A`). The VRG UI Kit (`shared/vrg-ui-kit`) comes to the phone as
  Compose tokens, not HTML. **1A:** the kit's four themes (Éj, Papír, Kontraszt, Mélyvíz-kit) join the six palettes; the
  default palette stays. **2A:** one source: a kit generator writes `KitTokens.kt` from the kit's token files, with a drift
  check. **3A:** Inter, Barlow Condensed and JetBrains Mono ship as `res/font` (OFL, licences beside them). **4A:** a
  `Mini` composable (icon = button = progress) on the home tiles and for sync / export. **5A:** the WP file is written in the
  cloud session; it is built on H: after M8, where Gradle and the phone are.

- **D-10 · Localhost on the phone (M8)** (2026-11-05: **C**). Both: "A PC-n" opens a server in its own desktop window
  for any paired phone; "Itt" shows it on the phone through the relay's `/p/<port>/` proxy, paired phones only, and only
  while the relay runs with `--ports` (off by default, like `--shots`).

- **M8 · How Localhost is built** (2026-11-05, no question needed). Windows reads `netstat -ano` + `tasklist`
  (not Get-NetTCPConnection: ~100 ms instead of a PowerShell start; listening rows found by the zero foreign
  port, since the state word is localised). "📱 Itt" is a Custom Tab through `/p/<port>/`, not a WebView; the
  proxy token is one per pairing for 12 hours, made a cookie on the first request, revoked with the pairing.
  `Mobile/catalogue/ports.json` is generated from START's servers (`ports-gen.js`). `mobile.cmd relay` starts
  the relay with `--shots --ports`; START's bare relay (O → 7) with neither. Details: `WP/M8.md`.

- **M11 · How Indítópult is built** (2026-11-06, no question needed; each choice follows M8's pattern). Every START
  tool is listed (a START tool is already something the user starts with one key); servers and tool extras only when
  `Mobile/catalogue/launch.json` names them, by registry id, so a renamed registry entry drops out rather than
  pointing somewhere new. Ids are `tool:<key>` / `server:<id>` / `extra:<tool>.<key>`, keys exactly as START has them
  (servers shown as `O<key>`). Pages open in the portable Chrome first (Windows here has no default browser), as
  START's `OpenUrl`. A server the phone starts runs detached **without a console window**, its output in
  `%TEMP%\VRG\launch\<id>.log`: that is what makes "the tail of its log" possible, and the phone can stop it
  (only what this relay started, by pid). The running state is M8's netstat scan; the phone asks again every 5 s
  while the screen is open. "Megnyitás a telefonon" reuses M8's proxy token, so it needs the relay's `--ports`.
  Details: `WP/M11.md`.

- **M12 · How Átadás is built** (2026-11-06, no question asked; the WP left one real gap, settled the M8/M11 way).
  - *Routing.* The WP routes `planner` through "the existing `07b-phone-camera.js` photo path" and `inventory` into
    "the import queue". Neither exists: `07b` is the gyro camera control, the Inventory has no queue. Chosen: the
    target is stored on the entry, and the relay's `board` event (with `target` and the file's `url`) reaches every
    app on this PC, so the Planner tab hears it; the upload answer counts the clients of that role (`delivered`).
    Taking the photo into the open job / an Inventory queue is left to "Planner site mode" and "Inventory scan"
    (README, Later), where the Planner's data model gets a photo collection. Building a Planner photo store inside
    M12 would have meant a new top-level collection (UKEYS, IDPRE, golden renders) for a WP about transfer.
  - *No relay flag.* Like M11 (not like `--shots` / `--ports`), the board is behind the M2 trust only; `/board` itself
    answers this PC only. Architecture rule 4's flag is for abilities that are not paired; this one always is.
  - *Messages.* `board.list` → `board.listed`, `board.ticket`, `board.remove` → `board.removed`, `clip.get` /
    `clip.set` → `clip`, and the event `board`. Tickets are bound to the pairing, as M8's proxy token is.
  - *Files are always octet-stream* (not a type guessed from the name): the phone picks the MediaStore type from
    the extension itself (`Drop.mimeOf`), and HTML is saved as a plain file.
  - *ShotStore → kit `FileStore`*, with the FileProvider moved to the kit's manifest, since both features use it.
  Details: `WP/M12.md`.

- **M13 · How Képernyő is built** (2026-11-06, no question asked; the WP has no open decision, these are the gaps
  it left, settled the M8/M11/M12 way).
  - *`-Command`, not `-EncodedCommand`.* Measured first, as the WP asks: every `-EncodedCommand` PowerShell child was
    killed after ~9.8 s with exit 0 on this PC (a plain sleep loop too), the same loop under `-Command` was not. The
    capture is one line under `-Command`; its C# source and every setting go through the environment, nothing from
    the phone is on a command line.
  - *The whole scaled frame is compared, not a small thumbnail.* A thumbnail misses a few typed characters (one
    letter is under a pixel at 64 px wide); a byte compare of the ≤1280 px frame costs about a millisecond. A still
    screen still costs little: after 1 s unchanged the loop looks 4 times a second (12 % of one core, 3.6 KB/s).
  - *Steering through a kit `Pointer`* that Légegér fills with its existing sender (Bluetooth HID mouse + the gyro
    clutch), so Képernyő never touches the Légegér feature (architecture rule 2) and adds no new way to control the PC.
    It therefore needs Légegér's Bluetooth link; without it the strip says so.
  - *Refusals at the upgrade* (403 / 404 / 409 before any frame), like M12's ticket check, rather than accepting the
    socket and closing it. Ends after that are a `screen.end` note plus a close code (4000 PC, 4408 limit, 4410
    unpaired, 4500 capture).
  - *Coming back from Home resumes*, since the view is on screen again and the PC shows its window again; leaving the
    view or an unpairing does not. The PC's window has no close box: Leállítás is the one way to stop it there.
  - *Quality* is two steps: "Éles" 1280 px / q 60 and "Kíméletes" 960 px / q 45; frames are capped at 10 a second.
  Details and the measurements: `WP/M13.md`.

- **D-7 · Kódváros online (M5)** (2026-11-06: **A**). Actions runs `CodeCity/scan.js` on each push and publishes
  the city to a `city-pages` branch; the phone loads it into a WebView. (Not chosen: B, the phone builds the city
  from the GitHub tree API; C, A now and B later.)
- **D-9 · Phone as the relay (M7)** (2026-11-06: **A**). The phone runs a small relay itself, speaking the
  `phone-relay-server.js` envelope; the PC apps can be pointed at it over the phone's WiFi or hotspot, for sites
  without a PC relay. (Not chosen: B, bridge only; C, not needed.) The user asked for M5, M7 and M10 to be built as
  one batch, so M7's research file is written first and the build goes on past it without a separate stop.
- **D-11 · Notifications (M10)** (2026-11-06: **C**). A now: GitHub polled every 15 min (WorkManager) plus relay
  events while on the same WiFi. B, a push service (e.g. a GitHub Action calling ntfy.sh), is a later WP.

- **M10 · How Értesítések is built** (2026-11-06, no question asked; D-11 = C settled the direction, these are the
  gaps the WP left).
  - *Five channels, not four:* CI, PR, Relé, Frissítés and **Jegyzet**, so notes from another device can be silenced
    apart. The switches are Android's own; Beállítások lists them and opens Android's page, no second copy in the app.
  - *Repo-scoped notifications* (`/repos/{r}/notifications`, not the user's whole `/notifications`): the app works
    with the one repo, and other repos' threads would ring on a VRG phone.
  - *Four conditional sources per round* (threads, runs, latest release, mobile-log commits), validators kept on disk
    by kit `GitHub.poll`, because the worker usually runs in a fresh process where the in-memory ETag cache is empty.
  - *The first answer of each source only fills the list*; a release newer than the installed build is the exception.
    A green run is listed only after a failure (green after green is noise, not news).
  - *A PC tool can ring the phone:* the relay's `notify` (`POST /notify` from this PC only, an app from this PC over
    the socket, `relay-notify.js` on the command line), kept 30 / a day for `notify.list` after a reconnect. This is
    the relay half of "relay events"; the other two are a board file from the PC and the PC back after 10+ minutes away.
  - *Notes name their device* in the commit message ("… jegyzet (<model>)"), the smallest change to M6 that lets the
    inbox skip the phone's own notes.
  - *D-11 B's slot:* every source goes through `InboxFeature.take`, and a push delivers the poller's ids, so the
    dedupe makes the two interchangeable. Details: `WP/M10.md`.

- **M5 · How Kódváros online is built** (2026-11-06, no question asked; D-7 = A settled the direction, these are the
  gaps the WP left).
  - *Every pushed branch gets a city*, as the WP says (the brief said main): the branch chips need them. Data branches
    (`city-pages`, `mobile-log`, `solomon-data`) are skipped; a deleted branch's city is removed.
  - *city-pages is one root commit, replaced on every publish* with `--force-with-lease` on that branch alone. A
    history of 1.4 MB pages would grow every clone and fetch. It is the toolset's only forced push, of a generated
    branch, by the workflow; the lease turns a race into a retry instead of a lost city.
  - *Branch → folder key* `~xx` (`claude/m5` → `claude~2fm5`): one URL-safe segment per branch, reversible, the same
    in Node and Kotlin (one fixture tests both).
  - *The chips list the published branches* (the listing of `city/`), not M4's active list, which hides main and old
    branches and may name branches without a city yet.
  - *The phone keeps its copies in `filesDir`*, not the cache: the offline open is the point. Four cities are kept.
  - *Touch through an injected adapter* (`assets/city-touch.js`), not a change to `CodeCity/src`: another session has
    uncommitted work in `03-scene.js`, and the PC's mouse behaviour stays exactly as it was.
  - *The WebView answers one file per key* from an `https://appassets.androidplatform.net` origin and refuses every
    other request: no file access, working `localStorage`, nothing leaves the phone.
  Details: `WP/M5.md`.

- **D-12 · Rétegverem on the phone (M17), 2026-11-07.** The user asked for the stack views in the app with proper
  touch. Decided without a question (the user asked to proceed): **the PC publishes, the phone reads GitHub**, like
  M5. The stack is built from H: (transcripts, git, notes), which no Actions runner has, so
  `Mobile/stack/publish-stack.js --push` (START → R → T) bundles both pages into self-contained HTML and replaces the
  orphan branch `stack-pages` (one root commit, `--force-with-lease` on that branch only). The data on it is ids,
  titles, kinds, sizes, times and links, never file contents; the repo is private. Touch lives in the pages
  (`notes/stack/touch.js`), not in an injected adapter, so the pages work in any phone browser too.
  Details: `WP/M17.md`.

- **M7 · How Hálózat is built** (2026-11-07, no question asked; D-9 = A settled the direction, the research
  `research/M7-network.md` the limits, these are the gaps the WP left).
  - *Every client of the phone relay must be paired*, apps included, not only phones as on the PC relay: on the PC the
    apps are local, on the phone the WiFi or hotspot is the open side. An untrusted client is held (nothing routed
    either way) and closed after 30 s. Never an unauthenticated server.
  - *The PC pairs with a code the phone shows*, typed on the PC (the PC relay's QR needs a camera on the other side):
    10 letters, ≈ 49 bits, 2 min, single use, burnt after 5 wrong tries. The rest is the PC relay's handshake turned
    round: a P-256 key from WebCrypto, `vrg-relay-auth:1:<challenge>:<id>` signed on every connect; P1363 and DER both
    accepted.
  - *The phone's own key is "self"*, so Légegér reaches the phone relay through the unchanged kit `Relay` (one hook,
    `localPairing`), not a second link.
  - *Own WebSocket server* (relay-core `WsServer`, RFC 6455, text only) instead of Ktor / NanoHTTPD: no framework on
    the phone, and the JVM tests run the same server over real sockets.
  - *The same port, 47291*, as the PC relay: `?relay=<phone>` works in Kódváros without a port; `<phone>:<port>` is new.
  - *The PC relay's PC-side abilities* (screenshots, ports, launch, board, notify, screen) are answered
    `{ok:false, unsupported:true}` under their usual answer type, so a feature says "not here" instead of waiting.
  - *One foreground service, `connectedDevice`*, for the relay and the usage watch; started only by a tap,
    `START_NOT_STICKY`. The usage figure is the whole phone's mobile data and is labelled so; the hotspot interface's own
    bytes are added on Android 12+.
  - *Dropped, per the research:* switching any tethering (system-only permission), per-client usage (no API).
  Details: `WP/M7.md`.

- **D-13 · Archívum on the phone (M18), 2026-11-11.** The Founder asked for the Artifact Archive in VRG Desktop and
  VRG Mobile; the Desktop part is WP-47 (DESKU-Q24). Decided without a question (the brief said to follow the pattern
  Mobile already uses and keep the Archive folder as the one source): **the phone reads `Archive/` from `main`
  through the contents API**, like Haladás reads `Mobile/catalogue/tools.json`. Unlike M5 / M17 there is nothing to
  build or bundle: the folder is already in the repo, its viewer already lays itself out for a phone, so no publish
  step, no orphan branch and no APK release is needed for a new entry. Not bundled into the APK assets: a new page
  would then wait for a release. Gaps settled in the same WP:
  - *Only the viewer, `index.js` and `files/<name>.html` are kept and served*; `archive.js`, `index.json` stay on GitHub.
  - *Changed files only*, by git blob sha + size from the two listings; a file gone from main is deleted on the phone.
  - *The artifact CDNs may load* (GET over https to fonts.googleapis.com, fonts.gstatic.com, cdnjs.cloudflare.com,
    cdn.jsdelivr.net, unpkg.com): the saved pages are published artifacts and use them. Every other request is
    refused, outside links open in the phone's browser. The first WebView here that lets anything off the phone.
  - *The one phone fix went into the viewer itself* (44 px touch targets under 760 px or on a coarse pointer), not a
    phone copy, so the PC's page and the phone's are the same file.
  - *Back asks the page* (`ArchiveWeb.BACK_JS` over `window.VRGArchive`): the viewer uses replaceState, so WebView
    history has nothing to step back through.
  Details: `WP/M18.md`.

- **D-14 · Tájolás: what the orientation toggle starts on and covers (M19), 2026-11-12.** Night default (2026-11-12), the user revisits it.
  Chosen: **A** — the stored value starts on **Álló** (the portrait lock every build before M19 had, so nothing turns
  on its own after the update), the toggle cycles Automatikus → Álló → Fekvő and applies to the whole app, and the
  manifest handles rotation itself (`configChanges`) so WebViews and the relay link survive a turn.
  Rejected: **B** start on Automatikus (the phone would start turning for every feature at once, Légegér's gyro
  included, before anyone checked it); **C** a per-feature orientation (more settings than the user asked for; kept
  as a Later item if Légegér needs to stay upright).
- **D-15 · Kezdőlap and the Kommand proof (M19), 2026-11-12.** Night default (2026-11-12), the user revisits it.
  Chosen: **A** — the Asztal is the default home after the update (the user asked for the Desktop on the phone), the
  tile home stays one setting away as Kompakt; the Asztal is a part of the shell, not a `feature-desk` module (it is
  the home, every feature opens from it); the Desktop's catalog reaches the phone as generated Kotlin
  (`Mobile/catalogue/desk-gen.js` → `DeskCatalog.kt`, `--check` in `mobile.cmd test`), and "the same results
  on the same inputs" is proved by a fixture the palette's own `search()` writes and a JVM test replays.
  Rejected: **B** Kompakt stays the default and the Asztal is opt-in (the user would not see what they asked for);
  **C** the JVM test runs Node itself (the core tests would need Node on every machine and in Actions; the fixture
  plus `--check` gives the same proof without it).
- **D-16 · Lapok: the phone's grid (M20), 2026-11-12.** Asked and answered by the user, 2026-11-12.
  Chosen: **A** — the grid is a parameter of the ported model (`SheetRules`): the Desktop 4 × 4, the phone 2 columns ×
  4 rows stored upright, and lying down the same sheet is drawn transposed (4 × 2), so a rotation never changes the
  doc and needs no remapping. Same JSON shape, same ops, the Desktop's tests mirrored on 4 × 4; a Desktop sheet is
  not opened 1:1 on the phone (its presets are fitted with `fitPreset`).
  Rejected: **B** keep 4 × 4 and map it to the screen (narrow cells upright, or a lossy column merge); **C** a separate
  phone grid with its own JSON and a layout per orientation (least sharing).
- **D-17 · PC ablakok: which of the PC's folders the phone sees (M23), 2026-11-12.** Asked and answered by the user, 2026-11-12.
  Chosen: **A** — the work roots only, from the Desktop's own `Dashboard/config/roots.json`: Repó, VRG Full and Közös
  (Shared), narrowed by `Mobile/catalogue/files.json`, read-only. Dot-files and secret names (the Desktop's appscheme
  rule) are never listed, nor a few folders that hold programs or sign-ins (`Full\home`, `Full\tools`, `Full\programs`,
  `Vendor`). The relay is off for this unless started with `--files`.
  Rejected: **B** every Desktop root, Asztal, Dokumentumok, Letöltések and the private OneDrive root included (private
  papers on a phone that can be lost); **C** only the jobs folder (too narrow for the files window the Desktop has).
- **D-18 · PC ablakok: the feed on the phone (M23), 2026-11-12.** Asked and answered by the user, 2026-11-12.
  Chosen: **A** — not on the phone. The feed's presets (drift, git, ports, waiting, inbox, RSS) run inside the Desktop
  on the PC with its cache, so the feed unit is marked `no` like Posta (mail), and Áttekintés on the phone keeps Home and
  the files strip. Belső keresés (search) is `no` for now too: a relay search over the PC's index is a Later item.
  Rejected: **B** the relay re-runs the presets (a second copy of the Desktop's feed engine); **C** the relay asks the
  running Desktop for its cached feed (needs the Desktop open, and a new channel between them).

- **D-19 · Vázlat: where a rough sketch becomes millimetres (M24), 2026-11-17.** Default taken while building (the user
  asked for the feature and was not asked in between); the user revisits it.
  Chosen: **A** — on the phone, in `sketch-core` (`Solver.kt`, pure Kotlin, JVM-tested): the field sees the same
  measured / derived / ≈ guessed sizes live that the Planner later gets, and the Planner only loads its own records
  and marks the guesses (`08ca-sketch-import.js`). Rejected: **B** the solver in the Planner (JS) and the phone sends
  only the raw sketch (no feedback on site, where a missing size can still be measured); **C** both (two copies of
  the same maths to keep equal).
- **D-20 · Vázlat: how the sketch reaches the Planner (M24), 2026-11-17.** Default; the user revisits it.
  Chosen: **A** — one file, `<name>.vsketch.json` (kind `vrg-sketch`: the raw sketch + the plan as Planner records),
  through Android's share sheet (Átadás *PC-re* puts it on the PC board) or saved to Letöltések, opened with the
  Planner's existing *Terv betöltése fájlból*. Rejected: **B** a relay message that drops it into a running Planner
  (needs the PC paired and the Planner open; a Later item on top of A); **C** a push to a GitHub branch (client
  sketches carry names and addresses: they stay off the repo, like `*.pdf`).
- **D-21 · Vázlat: native canvas, not a web page (M24), 2026-11-17.** Default; the user revisits it.
  Chosen: **A** — a Compose canvas with the logic in `sketch-core`: hold timing, the directional wheel and two-finger
  pinch need the touch stream, it works offline from the first start, and every edit is a tested function.
  Rejected: **B** the Planner's own page in M21's WebView (a desktop editor on a phone; its quick build is mouse and
  keyboard); **C** a new HTML sketcher shared with the Desktop (a second front end to keep in step).
- **D-22 · Vázlat: what each sketch record becomes in the Planner (M24), 2026-11-17.** Default; the user revisits it.
  Rooms → Helyiség-toll outline records (inner sizes), so Falak / Padlók létrehozása build them; points → devices at
  standard heights (dugalj 300, kapcsoló 1100, lámpa: mennyezet, on a wall 2000, kötődoboz 2200, Elosztó: the
  Planner's board), 40 mm in front of their wall; *meglévő / tervezett* kept as `sk.st` on the device (not yet moved
  onto the Planner's Meglévő layer: a Later step); nyomvonal → paths at the ceiling with the Planner's default section
  (`sull_gege`), tied ends as device links without glue; memos and loose tags → notes; the preset tags Fürdő / Konyha
  → room kinds, IP44 / Bontás → device flags, Dedikált → the circuit. A guessed edge stays marked (`sk.est`, orange ≈)
  until *Vázlat: méretek ellenőrizve*.
- **D-23 · Vázlat: the photo point is its own WP (M25), 2026-11-17.** The user called it "the second version"; M24
  keeps its data slot (`photos` in the sketch file, the plugin and tool as plans), so M25 adds a tool and a camera
  and changes no file format.

- **D-24 · Fotópont: the direction of a photo (M25), 2026-11-17.** Asked and answered by the user, 2026-11-17.
  Chosen: **A** — the four sides of the room as drawn (É, K, D, Ny of the sketch; 0 / 90 / 180 / 270, a swipe takes the
  90° around a side): four photos map a room, and the Planner's view cones stay tidy. Rejected: **B** eight directions;
  **C** the exact swipe angle.
- **D-25 · Fotópont: how the photos reach the PC (M25), 2026-11-17.** Asked and answered by the user, 2026-11-17.
  Chosen: **A** — each photo is its own file, shared together with the package (Átadás *PC-re* puts every one on the
  board), named `<sketch>_<point>_<side>.jpg`, the names the package lists; the Planner matches attached files by
  name and keeps a ≤ 360 px thumbnail. Rejected: **B** one zip; **C** base64 inside the JSON (15–40 MB a flat).
- **D-26 · Fotópont: the compass (M25), 2026-11-17.** Asked and answered by the user, 2026-11-17.
  Chosen: **A** — no compass: the swipe after the shot is the direction, relative to the sketch. Rejected: **B** the
  heading recorded as well; **C** the compass instead of the swipe.
- **M25 · How Fotópont is built** (2026-11-17, no question asked; the request said the point "opens as a camera
  application"): the phone's own camera app through TakePicture, as Átadás does, writing straight into the sketch's
  photo folder; the plugin starts switched off; a photo point is a hidden note in the Planner (no schema change).

- **D-27 … D-34 · VRG Sketcher (M26–M31), 2026-11-18.** Defaults taken while building the user's brief of that day
  (the brief named the goals; these are the means); the user revisits any of them.
  - **D-27 · One app, fronts inside it.** The Vázlat feature (`sketch`) becomes VRG Sketcher with seven fronts in one
    screen and the ✎ / ◉ buttons over all of them. Rejected: a feature module per front (the home screen would split
    what the user wants as one instrument, and switching would leave the survey).
  - **D-28 · One catalog, two engines, one fixture.** `Sketcher/catalog/fieldkit.json` (data only) is bundled into the
    APK from `Sketcher/` at build time and inlined into the Desktop page; the condition language has a Kotlin engine
    (phone) and a JS one (Desktop), kept equal by `Sketcher/test/fixtures/shadow.json` (written by JS, replayed on the
    JVM). Rejected: the JS engine in a WebView on the phone (the fronts are native); Kotlin only (the Desktop page is
    HTML).
  - **D-29 · Chaos-proof records.** Every capture is a self-standing record; links are optional and late; completeness
    (*Nyitott*) is derived, never stored; drafts are in the file. Rejected: a guided step order (the brief: "the system
    can't expect organized information").
  - **D-30 · Keywords suggest, taps apply.** A note's keyword only suggests (accept / swipe away, remembered); a chip or
    an option the user taps applies at once. Rejected: applying keyword hits silently ("nincs FI relé" would read as
    "FI relé").
  - **D-31 · Online only on a button.** The phone's GPS sends nothing; OSM Nominatim gets the address and only on
    🔎; Overpass gets the coordinates only; VRG Térkép runs on the PC. A generic client name (`VRG-Mobile-Sketcher`).
    Rejected: automatic lookups on typing (a client's address would leave the phone unasked); Google services.
  - **D-32 · The phone's own camera app.** As Átadás and Fotópont: no viewfinder of ours, so no live burst or overlay;
    instead *Sorozat* (the camera comes back), markup as vectors after the shot, burned in only on export. Rejected:
    CameraX now (a large module for what the research ranks "later").
  - **D-33 · Variants are data, made by an agent.** JSON overlays (`Sketcher/variants/`), validated, bundled and
    fetched from main; made through GO VARIANT; the request carries no client data. Rejected: variants that change
    code; a variant made on the phone itself (no agent there).
  - **D-34 · The Desktop button.** The main START screen has no free key, so START P → S (beside the Rajztár Stúdió) and
    the Asztal's catalog unit `sketcher` on the dock; the Desktop page completes a survey and saves it back in the same
    shape. Rejected: taking over a used key.

- **D-35 · Kezdőlap: the home's layout (M32), 2026-11-18.** Asked and answered by the user, 2026-11-18 (four questions,
  all four on the recommended option).
  Chosen: **A, Hero + Gyors** — VRG Sketcher (`sketch`) is a full-width hero card at the top of the home, its plugin
  Fotópont (`photo`) a chip on it; below it one quick row of four (QR beolvasás, which starts the scanner at once,
  Légegér, Átadás, Gyorsjegyzet); then the catalogue's groups without those, each foldable (Alkalmazás folded on a
  fresh install, the choice kept in `ShellPrefs.homeFolded`). **Both homes** get it in the same order (the Asztal's
  home window as 4-column icons, Kompakt as 2-column tiles); **lying down** the hero and the quick row take the left
  40 % and the groups scroll on the right (5 icon / 3 tile columns), from 600 dp wide, so a Lapok cell holding the
  home stays one column. Sketcher also has a dial in the Asztal dock beside ◣, one tap from every sheet. The layout is
  `kit-core/HomeLayout.kt`, tested (every catalogue entry on the home exactly once); ids and routes are unchanged. The hero shows the
  phone's survey count, read from the Sketcher's folder (not its code, which another session owns), names pinned by a test.
  Rejected: **B** Sketcher only as a dock pin with the grid reordered (least change, but not prominent on Kompakt);
  **C** a Terep / Iroda split with big field tiles and an office list (biggest change; kept as a later idea if the
  field use grows past the Sketcher).

- **D-36 · Csipogó: what carries the pager (M33), 2026-11-18.** Chosen in the session (the Founder asked for a
  reimagined Site Pager and left the choices to it). Chosen: **A** — **BLE advertisements for the pager itself and
  LE L2CAP channels for chat and voice**: the pager frame rides in every phone's beacon, so a page needs no
  connection, reaches every phone in range at once and gives the RSSI for the distance for free; the link (Android
  10+) carries what does not fit in 23 bytes. No pairing dialog anywhere. Rejected: **B** Google Nearby Connections
  (needs Play services, an opaque protocol a future ESP32 pager could never join, no RSSI); **C** Bluetooth Classic
  RFCOMM (discoverable-mode prompts and bonding on site, no broadcast); **D** Wi-Fi Direct / a hotspot (one phone
  becomes the access point, minutes of setup, no proximity).
- **D-37 · Csipogó: the crew code is the key (M33), 2026-11-18.** Chosen in the session. Chosen: **A** — a typed
  crew code gives the crew id byte (the pager's `crew` field) and an HMAC-SHA256 key; every beacon carries a 4-byte
  MAC and the epoch minute (± 2 min), every link starts with a nonce handshake. It answers the builder's own warning
  about replayable fixed-code fobs. Not encrypted (said on screen and in the WP). Rejected: **B** no authentication
  (anyone's phone could send KAPCSOLD FEL into a crew); **C** full encryption with bonded links (pairing dialogs,
  and the beacon has no room for a nonce and a tag both).
- **D-38 · Csipogó: shape on the phone (M33), 2026-11-18.** Chosen in the session. Chosen: **A** — one feature in
  Kapcsolat (`pager`, 📟), the pager's codes and key map unchanged (1–14, K1–K3 short / long, types 1–14 + 0 idle),
  units 1–30 instead of 1–8, the Panel drawn after the B2 belt pager, Hungarian labels with the original English in
  `pager-core`. HUB mode, the LIGHT / HEAVY ports, ESP-NOW modules and the key fob are not carried over (no ports on a
  phone); a future hardware unit can join the same frame. Rejected: **B** a fresh message set designed for phones
  (would lose the pager's muscle memory and the path back to hardware).
  Details: `WP/M33.md`.

- **D-39 · Eszközök: how a phone gets in (M35), 2026-11-18.** Asked: the Founder chose "like Proton Vault".
  Chosen: **A** — Proton Vault's flow under VRG names: a phone's request (`vrg-req`, id + P-256 key + a 6-character code)
  as a QR; the owner's phone reads it with the app's scanner (the shell routes `vrg://devices?…`), checks the code by
  eye, writes the phone onto `Mobile/trust/devices.json` on `main` and shows a grant (`vrg-grant`, ECDH + AES-GCM) only
  that phone opens. The list also unlocks `Access`, so a new phone needs no new build. Rejected: **B** keep adding codes
  to `access.json` by hand (a release per phone); **C** a PC-side approval page (the owner is in the field).
- **D-40 · Eszközök: the owner's token is not handed over by default (M35), 2026-11-18.** Chosen in the session.
  Chosen: **A** — the approval card has *A GitHub tokenem is*, off by default with a red warning: VRG's token has the
  `repo notifications` scope, so it writes to every repository of the account, not only this one. Without it the phone
  is approved (unlocked, updates) and reads. Rejected: **B** always hand it over as Proton Vault does (its token reaches
  the same scope; one tap too easy to give away on a phone that is not the owner's).
- **D-41 · Eszközök: the release lock starts on (M35), 2026-11-18.** Chosen in the session: the Founder said "I allow the
  updates with QR codes". `Mobile/trust/devices.json` starts with `gated: true` and the owner's phone. Offline or before
  the first read, updates stay allowed (never lock the owner out). On a public repo it filters the in-app offer only.
  Details: `WP/M35.md`.

- **D-42 · iPhone: a web app with the online subset (M36), 2026-11-18.** Asked and answered by the Founder (three options).
  Chosen: **B** — the part of VRG Mobile that works in a browser, as a web app on GitHub Pages: Eszköz (the M35 device
  approval, same crypto), Haladás, Frissítés, Megjelenés; Csipogó, Légegér and the relay features stay on Android
  (Safari has no Bluetooth; an https page cannot open the PC relay's `ws://`). Rejected: **A** a native iOS app (the
  Apple Developer Program, 99 USD a year, TestFlight, and an iPhone Bluetooth mode for Csipogó, since iOS cannot put
  data into a BLE advertisement); **C** Android only.
- **D-43 · iPhone: where the web app lives and how it updates (M36), 2026-11-18.** Chosen in the session. **GitHub Pages
  from Actions** (`mobile-web.yml`, on pushes to `main`), so no server; a cache-first service worker so the app opens
  offline and changes only on *Frissítés most*, which follows the M35 release lock. The home-screen icon takes the
  palette chosen before *Add to Home Screen* (iOS reads it once). Rejected: jsDelivr or raw GitHub hosting (no
  same-origin service worker, HTML served as text); a PC-hosted page (not reachable on the road).
  Details: `WP/M36.md`.

- **D-44 · Eszközök: the install QR (M35), 2026-11-19.** Asked by the Founder: "a QR code within the app that shows up
  only to me that lets other phones download the apk". Chosen in the session: **A** — GitHub's fixed latest-release
  link (`Updates.PUBLIC_APK`; only `mobile-release.yml` makes releases, so "latest" is always the app), drawn only when
  this phone is the trusted list's owner entry (`Trust.isOwner`), behind a *Telepítő QR* tap. It works with no sign-in
  because the repo is public; the new phone still starts locked and is let in by the D-39 approval, so the QR only
  saves typing the link. Rejected: **B** the owner's phone serving its own installed APK over WiFi (works offline and
  on a private repo, but needs an HTTP server on the phone and the same network; kept for when the repo goes private);
  **C** a short-lived signed asset link fetched with the owner's token (expires in minutes, and the token stays out of
  QR codes).
  Later the same day the Founder asked for it on the home too: a slim *Telepítő QR* button under the quick row on
  both homes (same owner check), opening the same panel (`kit/ui/InstallQr.kt`) in a dialog.

- **D-45 · RCO: the long-press menu (M37), 2026-11-19.** Asked by the Founder: RCO on the dock's windows, then
  "genuine RCO opportunities throughout the app". Chosen in the session: **A** — one shared part (`kit/ui/Rco.kt`:
  tap unchanged, long press with a haptic tick and a TalkBack label, a Mélyvíz dropdown anchored to the item) on the
  dock windows and seven lists where it saves taps or adds a missing copy / share (WP M37 has the table). Where a long
  press already means something (Lapok drag and picker, Csipogó's long message and SOS, touch surfaces) it is left
  alone. Indítópult's long press (the detail panel) was asked about and the Founder said yes the same day: it is a
  menu now, with Részletek keeping the panel. Closing a dock window takes it off the bar only.
  Rejected: **B** a bottom sheet instead of a dropdown (heavier for two to four lines, and it hides what was pressed);
  **C** a menu on every item, single buttons included (the Founder asked for genuine ones).

- **D-46 · Eszközök: the admin phone approves on scan, the asker unlocks itself (M35), 2026-11-19.** Asked by the
  Founder: "the app should detect my admin phone so that scanning other phones auto allow them", and "every other
  phone … should not have that many info". Chosen in the session: **A** — the admin phone is the list's owner entry
  signed in to GitHub; a request its own scanner reads (marked in-process by `ScannedLinks`, not an Intent extra)
  is approved without the card: the QR came straight off the asking phone's screen, so the code check by eye adds
  nothing. A pasted or messenger request still shows the card and needs the tap (there the code check is what stops
  a forwarded or altered request). The asking phone polls the list every 10 s while it waits and unlocks by itself;
  the grant QR stays for the token handover and the iPhone. Every phone but the owner's sees a short Eszközök.
  Rejected: **B** auto-approve every request that reaches the owner's phone, links included (a messenger link would
  approve a phone nobody looked at); **C** keep the grant QR as the only way in (one more scan the Founder asked to drop).

- **D-47 · Kezdőlap: numbered pages, one long page, a Katalógus (M38), 2026-11-19.** The Founder set the order and
  answered four questions the same day: the planned programs (Workflow Kit, Térkép, Időjárás, Vault) get **"Terv"
  tiles** with a Katalógus page each, built later in sessions of their own; the old quick row goes **into the pages**
  (QR beolvasás stays in the top bar); **Kompakt becomes the one-page view**; Archívum was the broken screen.
  Chosen in the session: the pages are plain data (`HomeLayout.PAGES`, tested: every catalogue entry once); the top
  bar and the dock are page 0 on every page; a page of ≤ 3 entries is big cards, longer ones an icon grid; ⌂'s long
  press flips `ShellPrefs.home` (ids kept: `desk` = paged, `compact` = one page); Planner / Kalkulátorok / Készlet are
  catalogue entries that open M21 web apps (Készlet gathers BuildTree and Valena until the new Inventory); the paged
  home swipes its own pages, so the swipe to Gömb stays only on the one-page view (Gömb is on page 7). Replaces the
  Sketcher hero, the quick row and the group folding of D-35 (the Sketcher keeps the first card, its count and the
  dock button). Rejected: a vertical scroll of sections with sticky headers as the default (the Founder asked for
  swiped pages); keeping Kompakt as a third layout (one more to maintain, nothing it does that the one page does not).

- **D-48 · VRG Térkép reaches the phone as a web app, with the PC's data when it is there (M43), 2026-11-20.**
  Asked by the Founder, answered **A**: the PC's own `Map/vrg-terkep.html` from `main` on its own origin (the M21 way),
  the libraries from the pinned npm tarballs (sha512-checked); with a paired PC its offline data and the J layer through
  the relay's `/p/8802/`, without one the page's `?remote=1` mode over the public planet files with a 400 MB tile cache,
  so what was looked at once opens offline on site. Rejected: **B** through the relay only (no map on site, where the PC
  is not); **C** a native MapLibre module (a second map to keep in step with the page, and not checkable in a cloud
  session).
- **D-49 · The layers on site: own position + Vázlat sites, the jobs, Navigáció (M43), 2026-11-20.** Answered
  **A + B + C**: the GPS dot and the Sketcher's sites from the phone's own files (nothing sent); the J layer through the
  relay only, never stored on the phone (MAP-D2 B's controls apply unchanged); Navigáció on a tap hands the phone's
  navigation app a `geo:` link with coordinates and the job code / sketch name, never an address (D-31). No route
  planning of our own.

- **D-50, D-51 · not used.** Left to the parallel sessions M43–M45, which needed only D-48 and D-49.
- **D-52 · Varler Workflow Kit: the client data sealed to the phone's device key, through GitHub (M42), 2026-11-20.**
  (D-48 … D-51 are left to the parallel sessions M43–M45.) Asked: what the phone does with the Kit — **A** read-only
  through the relay, **B** a web app like M21, **C** a native screen fed by the Planner, the calculators and Készlet.
  The Founder: C overall, A could be sufficient; the client data is the real problem; could the phone hold an
  encrypted copy in the Vault? The Vault as built (M45, D-53 A) holds no key in VRG Mobile, so it could not feed this
  screen. Asked next, with **A** a sealed copy fetched over the relay, **B** through the Proton Vault with a native
  reader, **C** sealed to the device via GitHub, **D** relay only: the Founder chose **C**. The PC
  (`tools/workflow-seal.js`) packs each job's steps, offer variants, texts and file list, gzips it and seals it to the
  Eszközök P-256 key (ECDH + AES-GCM, WebCrypto's shape, the id as AAD) of each phone that is on devices.json **and**
  whose 6-character code the Founder confirmed on the PC (`trust <ID> <CODE>`, pinned outside Git); only ciphertext
  and public keys are on the orphan branch `workflow-sealed`. This bends "client data never enters Git" knowingly: it
  enters only sealed. No PDFs in the pack (PC ablakok has them). The estimate on the phone (the rest of C) waits for
  the Kit's pricing rules to be in the repo. Rejected: relay-only (nothing offline); the Vault (no way to read it here
  yet); a web app (the Kit is not packaged).

- **D-53 · Vault: what it is on the phone (M45), 2026-11-20.** Asked: three options; the Founder chose **A**, with a
  reminder for B. Chosen: **A** — the Vault's own web app (`webagoly-work/data-vault`) in a confined WebView inside VRG
  Mobile: its own crypto, no vault key and no decryption in VRG Mobile, nothing written to shared storage, FLAG_SECURE,
  requests only to its origin and GitHub (`kit-core VaultWeb`). Rejected for now: **B** a native reader of the vault in
  Kotlin (re-implements the Vault's crypto, needs the data-vault repo in the session; kept as a later step); **C** only
  a link to the browser (the browser holds the device key, outside the app's lock).
- **D-54 · Vault: its approval is separate from Eszközök (M35), 2026-11-20.** Asked: the Founder chose **A**. The Vault
  page keeps its own device key and its own QR approval (PV-D11 / PV-D12); an Eszközök approval does not open the vault
  and the Keystore-backed VRG key never reaches the page. Rejected: **B** one approval for both (the VRG key handed to a
  web page, and every phone let into VRG Mobile reaching the secrets).
  Details: `WP/M45.md`.
- **D-55 · Kamera 2: the text recogniser is ML Kit's bundled Latin model, behind one module (M46), 2026-11-20.**
  Taken in fork F3 without asking (FORKS.md rule 5), to confirm. `com.google.mlkit:text-recognition:16.0.1` in the new
  module `sketch-vision`, behind `TextReader` (plain text out; the parsing is pure Kotlin in `sketch-core`
  `TypePlate.kt`), so another engine only has to return text. **Why bundled:** it works offline in a cellar with no
  signal and needs no Google Play download on first use (the unbundled variant, ~260 KB, downloads its model through
  Play services). **Licence / terms:** ML Kit is free of charge and closed source, used under Google's ML Kit Terms
  (developers.google.com/ml-kit/terms) and the Google APIs Terms; the bundled model runs on the device and no image
  leaves it; Google's terms allow the SDK to send usage and performance metrics, not the image content (to re-read
  before a public release). **Size:** about 4 MB per CPU architecture (Google's figure); the APK now carries only
  `arm64-v8a` and `armeabi-v7a` (`abiFilters` in `app/build.gradle.kts`: x86 is emulators only), so about +8 MB.
  Rejected: Tesseract (≈ 20 MB with the Hungarian data, slower, worse on photos), the unbundled ML Kit (needs Play
  services and a first download). **Rule:** a finding is offered as a chip and fills an answer or a note line only
  when tapped; label photos (purpose *Típustábla*, the label items of the shot list) are read by themselves, others on
  a tap. Details: `WP/M46.md`.
- **D-56 · Kamera 2: automatic face detection, built in and switchable (M46), 2026-11-20 → answered 2026-11-21: B.**
  Proposed A (no face detection: ML Kit's bundled face model adds about 6.9 MB per architecture); the Founder chose
  **B**: build it ("I would default to have upcoming features and programs be integrated so we have them", D-90).
  `sketch-vision` `FaceFinder` (`com.google.mlkit:face-detection:16.1.7`, bundled, accurate mode, faces from 5 % of the
  picture) beside `TextReader`; `sketch-core` `CameraFeatures.proposals` turns each face into a blur rectangle grown by
  20 % and clipped, never twice over an existing one. The rectangles are only **proposed** (dashed red over the photo,
  *✓ Elmosás* / *✕*); flagging a photo 👤 searches by itself, *☺ Arcok keresése* on a tap. Both switchable (D-90).
  The APK grows by about 14 MB more (two ARM architectures).
- **D-57 · Kamera 2: GPS is stripped from exported copies by default (M46), 2026-11-20.** Taken in fork F3. Every
  photo that leaves the phone (the package's purpose photos and Fotópont photos, variant-request photos) has its EXIF
  position removed; when the rewrite fails the copy is re-encoded without EXIF rather than sent with it. Per photo
  *⌖ GPS a kiadott képen marad* keeps it (the survey file keeps the position either way, it is the Founder's own
  record). A photo flagged **Személyes adat** never keeps it. A photo with a blur mark leaves the phone **only blurred**
  (the original stays on the phone); personal photos, videos and signatures are never offered for a variant request
  (which ends up in Git). Rejected: keeping GPS by default (a photo forwarded from the PC to a supplier or a client
  carries the client's address in its metadata). **Answered 2026-11-21: A** (stripped by default, kept per photo); the
  strip itself is a switch too (D-90: *GPS törlése kiadáskor*); a variant request is always stripped (it goes to Git).
- **D-58 · Kamera 2: before / after is a pair by reference, compared with a slider (M46), 2026-11-20.** Taken in fork F3.
  The after-photo names its before (`phase` utana + `pair`); one after per before (a new one replaces the old). The
  candidates are earlier photos of the same purpose, the same room first, then the same shot item, the newest first.
  The phone's camera app gives no live ghost overlay (TakePicture intent, M29), so the comparison is in the viewer: a
  slider revealing the after over the before, or side by side. A live overlay needs an own camera (CameraX): later.
- **D-59 · Kamera 2: the client's signature is a PNG under a fixed statement (M46), 2026-11-20.** Taken in fork F3. Three
  statements (átvétel / hozzájárulás a fotózáshoz / mindkettő), the signer's name and the time written into the PNG
  under the strokes and stored on the capture (purpose *dokumentum*, kind *signature*); exported as `…_alairas.png`.
  It is a record of consent on site, **not** a qualified electronic signature. It fills no shot-list item (otherwise it
  would tick *A régi dokumentáció*); the Kotlin and JS engines both skip it, the fixture checks it. The statement texts
  are to be confirmed by the Founder (question 2 of the F3 report). **Answered 2026-11-21: A** (the texts stay; the
  Founder refines them later).
- **D-60 · Kamera 2: the walk video goes through the camera app, limited and warned (M46), 2026-11-20.** Taken in fork F3.
  CaptureVideo with `EXTRA_DURATION_LIMIT` 90 s and `EXTRA_SIZE_LIMIT` 150 MB (most camera apps honour them); a warning
  over 80 MB or a long video; no re-compression on the phone (no extra library). Purpose *Nyomvonal* unless chosen
  otherwise. Exported as `…_<cél>.mp4` with the package.
- **D-61 · Kamera 2: faster purpose switching (M46), 2026-11-20.** Taken in fork F3. The ◉ hold menu starts with the next
  four missing shot-list items (room items go to Fotópont, so they are left out), then 🎥 video, ✍ signature and the
  three purposes used last, then the full grid. After a photo a **＋ (symbol) még** pill stays nine seconds beside ◉
  (not during Sorozat, which already returns to the camera).
- **D-62 · Helyszín opens the phone's own map, full screen, with a return path (M48, fork F1), 2026-11-20.** Not asked
  (fork rule 5: the recommended option, written down). Chosen: Helyszín opens VRG Térkép (`vrg://map?site=<id>`) on its
  own screen; the map leaves its answer in `files/sketch/handoff/<id>.site.json` and opens
  `vrg://sketch?open=<id>&front=helyszin`; the Sketcher applies it when it opens the survey. Why: drawing corners and
  dragging a plan need the whole screen, and a map inside the scrolled Helyszín column fights the scroll; the Sketcher
  stays the only writer of the survey file (no two writers), and an answer survives the app being killed. Rejected:
  **B** the map embedded in Helyszín (a second copy of M43's request handling in feature-sketch, cramped gestures);
  **C** the map writing the survey file itself (overwritten by the open editor).
- **D-63 · The satellite layer: Esri World Imagery, on a tap, never stored (M48), 2026-11-20.** Asked (2026-11-21): **A** keyless Esri now, a free ArcGIS key later / **B** the Hungarian state orthophoto / **C** no satellite; the Founder chose **A**. Chosen: Esri's World
  Imagery tiles (`server.arcgisonline.com`, keyless), added only when 🛰 is tapped, attribution shown, not written to the
  phone's tile cache (the WebView runs `LOAD_NO_CACHE`; the phone lets only GET to that host out). Terms checked: Esri's
  terms summary requires attribution and allows offline use only through Esri's own content packages, and an ArcGIS
  account for use outside Esri software; so nothing is cached, and the keyless use is internal, low-volume, interactive.
  A free ArcGIS Location Platform key stays the later step for full compliance (not now, per the Founder).
  Rejected: Sentinel-2 cloudless (10 m pixels: no building to trace); Google / Bing / Mapbox imagery (a key and stricter
  terms); the Hungarian state orthophoto (registration; a candidate later).
- **D-64 · How the outline and the placement are stored (M48), 2026-11-20.** `site.outline` = the corners as
  `[lat, lon]` (absolute, so a corrected outline does not move a placement); `site.place` = `{lat, lon, rot, auto, at}`,
  the plan's oriented-box centre on the map and its clockwise turn (absolute too; the offset from the building is derived
  each time, never stored); `site.footprint` stays as before and is measured again from the outline, its `src` = `osm`,
  `rajz` (drawn) or `muhold` (traced over the satellite). All optional; the file stays v2.
- **D-65 · The fit and the mismatch report (M48), 2026-11-20.** The first placement turns the plan's long axis onto the
  building's and centres the two boxes; of the four quarter-turn candidates the one whose walls stick out least wins, the
  smaller turn on a tie. The report: the turn between the walls folded to ±45° (walls parallel or not, whichever side is
  long), the box-centre offset with its compass direction, and each wall whose **middle 80 %** is more than **0,25 m**
  outside the outline (a wall that is only too long shows as the walls at its ends). Verdicts in order: *kilóg*,
  *elforgatva* (> 3°), *eltolva* (> 1 m), *rendben*. Same numbers on the phone, the map and the Desktop (one fixture).
- **D-66 · Every lib file the map page loads is one the phone serves (M48), 2026-11-20.** Found: `Map/vrg-terkep.html`
  imports `/lib/weather-layer.js` (the W layer, after M43), which the phone did not fetch, so the page's module failed and
  the map did not start on the phone. Chosen: the phone fetches and serves it (and the two site-layer files), a test
  reads the page and fails when it loads a `/lib` file the phone does not serve, and the page loads optional layers
  without a static import, so a missing one never stops the map. Details: `WP/M48.md`.

- **D-67 · Takeoff: one engine twice, its rules as data, 2026-11-20** (fork F2, taken for the Founder, rule 5). The takeoff
  is `Sketcher/lib/takeoff.js` (Desktop, CLI) and `sketch-core/Takeoff.kt` (phone), kept equal by
  `Sketcher/test/fixtures/takeoff.json` (document and summary), the M26 pattern; what counts as what lives in
  `Sketcher/catalog/takeoff.json`, bundled with the field kit. Rejected: the phone sending the sketch to the PC to be
  counted there (no lap on site, offline). Details: `WP/M47.md`, `../sketcher/TAKEOFF.md`.
- **D-68 · Igények against the drawing: the larger number, marked ≈, 2026-11-20** (F2). A wanted count (Dugalj 4) and the
  drawn points (1) give `max` = 4, ≈ with *Munkakör: 4, vázlat: 1*, so neither the client's word nor the half-finished
  drawing is lost. Machines (gépbekötés) stay their own lines; a mismatch with the drawn Fix bekötés points is a check
  line, not a merge. Rejected: the drawing only (wants not drawn yet vanish), adding both (double counting).
- **D-69 · Implied work is shown, as a guess, 2026-11-20** (F2). A dedicated machine or system implies a dedicated circuit
  (since D-79 only with its toggle on), a second board is taken for an alelosztó, a circuit without a drawn route gets a right-angled home run to its board,
  the EV cable comes from the distance answer, and *Elosztó csere* without a drawn board still gives one; every one of
  them is ≈ and says why. Cable = solved length + per tied end (ceiling − height) + 300 mm (`--reserve`). Rejected:
  counting only what is drawn (the lap would say 0 m cable for a job everyone knows needs it).
- **D-70 · The intake lives on the Planner's building, shown by an action, 2026-11-20** (F2). `B.survey` (the job's
  facts; every save carries it, no new data collection, nothing drawn so the goldens stay); ⌘K *Felmérés: munkakör
  lap*. An older package keeps its raw intake by ids. Rejected: notes on the plan (they would clutter the drawing),
  the Igénylista (per room; the intake is per job).
- **D-71 · Csere and Bontás by tag; no prices; decisions from a fixed list, 2026-11-20** (F2). Replacement is a tag named
  *Csere* (or preset `replace`), demolition the *Bontás* preset; the *Tervezett* / *Meglévő* state stays as it is. The
  export carries no money; the decisions that change a quantity are a list of the field kit's own questions in the rules
  file, invented questions none (the Workflow Kit's funnel is mapped on the PC, `../sketcher/TAKEOFF.md` §5).
  Rejected: a third point state (it would change the v2 file), guessing funnel ids from here.
- **D-72 · F4: the client's wants by room keep the job total in `scope` (M49), 2026-11-21.** Taken in fork F4. A
  countable want (an *igény* with a quantity) can belong to a room: a new optional `roomScope {room → {want → qty}}`
  holds the rooms' part, `scope` stays the job total, the rest is *Általános* (derived, never stored). Every reader of
  `scope` (the conditions, the scope card, F2's takeoff, the Planner's raw intake) stays right without knowing about
  rooms. The Munkakör's + / − go to the room chosen under *Hová* (the room in focus when the front opens); a total
  lowered below the rooms takes back from the last room first; a deleted room's entry stays in the file and counts as
  Általános (an undo brings the room back with its wants). Rejected: a per-room list of separate *igény* records with
  categories (the research's wording): it duplicates the scope toggles and breaks every reader of the totals.
- **D-73 · F4: the Sketcher's variants on its long press start a new survey (M49), 2026-11-21.** Taken in fork F4. On the
  home tile (hero card, grid icon, Kompakt) and the Asztal dock's Sketcher dial, the RCO lists *Új felmérés: <variant>*
  for each variant, *Új felmérés: eredeti*, ⟳ *Variánsok frissítése* and ＋ *Új variáns kérése* (opened without a
  survey: the request carries the premise and toggles, its counts are zero). From outside the Sketcher a variant line
  means "I am starting this kind of job"; switching the survey already open is the editor's corner toggle, whose long
  press has the same list for that survey (a tap still toggles; with no variant chosen a faint ◐ opens the list).
  Rejected: reopening the last survey with the variant (it silently reshapes a survey the user may be in the middle of).
- **D-74 · F4: a variant tunes five drawing behaviours, nothing else (M49), 2026-11-21.** Taken in fork F4. The optional
  `draw` block: `snapAngle` (0 / 15 / 30 / 45 / 90°, the Vonal tool's step; 0 = the original 12° axis lock),
  `snapGrid` (m, corners of Szoba, Sablon, Vonal and corner moves; a neighbour's corner line still wins), `defaultRoom`
  `{w, d}` (m, a tap on paper with Szoba lays one), `measureFirst` (a new room opens its size dialog), `pointSnap`
  `wall` / `free`. Metres become sketch units through the sketch's current scale (the Solver's mm per unit), so the
  grid stays real after the first measure. The phone ignores a bad value (falls back to the original); the variant
  check rejects it. Left out: `wallThickness` (the sketch has no walls; the Planner builds them, and its wall tool is
  not this fork's) and `lineClose` (closing on the first point already works; an "ask" mode adds a dialog to every room).
- **D-75 · F4: the kit's égett detector skips kiégett (M49), 2026-11-21.** Taken in fork F4. `(?<!ki)eget|…` in
  `fieldkit.json`: a burnt-out lamp (*kiégett izzó*) no longer suggests a fault, *megégett*, *égett szag* still do. Java
  and JS regexes both take the lookbehind (FieldKitTest parses the kit; the fixture has the three cases). The
  ipari-telephely override is gone.
- **D-76 · F4 sweep: the deadline gets a date field; no audio fallback yet (M49), 2026-11-21.** Taken in fork F4. *Mikorra
  kell elkészülni?* has a `num` field (unit *dátum*) like the budget (*Ft*): budget and deadline are now both an option
  plus a typed value. A phone without a speech recogniser now says the keyboard's 🎤 still dictates. The audio-file
  fallback (record a sound file when there is no recogniser) is **not built**: it needs a new record field on the
  entry in both engines, the export and the Desktop player, and many phones have no app answering the recorder intent.
- **D-77 · A built-in Csere tag, 2026-11-21.** Asked: the Founder chose **A**. The tag presets get *Csere* (`T-csere`,
  preset `replace`, next to Bontás); the takeoff counts an existing point with it as csere, the Planner package marks the
  device `sk.replace`. Old surveys keep their own tag list (a user-made „Csere” tag still works by name); the Planner
  fixture `sketch-field.json` was refreshed for it. Rejected: **B** only a user-made tag. Details: `WP/M47.md`.
- **D-78 · Cable reserve per end: 300 mm, 2026-11-21.** Asked: the Founder chose **A**. `cable.endReserveMm` stays 300
  (`--reserve` on the CLI for one job). Rejected: **B** 500 mm, **C** another value.
- **D-79 · Implied dedicated circuits: none by default, a general toggle, 2026-11-21.** Asked: the Founder chose **C**
  ("should be toggle option to add these generally"). The takeoff assumes no dedicated circuit for the big machines and
  systems (`impliedDedicated: false` in the rules); a check line says how many they may need. One toggle switches the
  assumption on for every survey: on the phone the Munkakör lap's *◉ Dedikált kör a nagy gépeknek* (kept in the app's
  settings), on the Desktop the same button (kept in the browser), on the CLI `--implied-dedicated`; the export records
  it in `config.impliedDedicated`. On, they count as before (≈ with the reason). Rejected: **A** always on, **B** only
  the hob, the oven and CEE.
- **D-80 · F5: the built-in Csere tag reaches older surveys too (M50), 2026-11-21.** Taken in fork F5, extending D-77
  (the Founder's A; F5 had built the same `T-csere` preset in parallel, the merge kept one). A survey made before has a
  stored tag list without it: the phone adds it when it opens one that has neither a `replace` preset nor a tag named
  Csere, so the user's own *Csere* is not doubled and still counts by name. Rejected: adding it
  while reading every file (it would change the read of shared fixtures and round trips), a third point state (D-71). **Answered 2026-11-21: A** (on open, switchable).
- **D-81 · F5: the Felmérési jegyzőkönyv is the Desktop page's, built at run time, the browser paginates (M50),
  2026-11-21.** Taken in fork F5. One document from the open survey (`Sketcher/lib/report.js`), opened in a window and
  printed to PDF by the browser; never stored, so no client data reaches Git. Varler Papír tokens, but not its fixed
  `.lap` sheets (D11 of the style study): a survey's length is unknown, so the page flows with `@page` margins and no
  fixed footer that could overlap, sections and photos kept whole. Not on the phone: it needs the solved plan, the photos
  and the takeoff together, and a Kotlin renderer would be a third engine to keep equal; the package to the PC and one
  button is enough. Rejected: a generated PDF (a library, fonts embedded), the Workflow Kit's offer generator (that is the
  quote, not the survey). **Answered 2026-11-21: A for now**, and **B planned**: the phone's own report is planned out in `WP/M50.md`
  (*Planned: the jegyzőkönyv from the phone*) for a later round.
- **D-82 · F5: the client's contact is personal: kept on the phone, stripped on export unless kept (M50), 2026-11-21.**
  Taken in fork F5, D-57's rule for GPS. Name, phone, e-mail (the address is the site's) in an optional `client` object;
  every copy that leaves the phone (the Rendezés package and its takeoff) drops it unless *A kiadott csomagban marad* is on;
  a variant request never reads it; no fixture carries it. The Desktop page and the Planner show it from the user's own
  file. Rejected: a client record across jobs (the Workflow Kit owns clients), always exporting it (a package forwarded
  to a colleague would carry a private person's phone number). **Answered 2026-11-21: A** (stripped unless kept).
- **D-83 · F5: lineClose auto / ask; no wallThickness (M50), 2026-11-21.** Taken in fork F5 (M49 left both out). `auto`:
  the Vonal tool's Kész with 3+ corners makes a room, and closing on the first corner reaches twice as far; `ask`: Kész
  asks once (room or open line). Only Kész asks, so drawing a room by tapping its first corner never gets a dialog
  (D-74's worry). `wallThickness` stays out: the sketch's rooms are inner faces and the Planner imports floors, not walls,
  so nothing would read it; the variant check keeps rejecting it.
- **D-84 · F5: no recogniser, a sound note (M50), 2026-11-21.** Taken in fork F5 (reverses the "not yet" of D-76). The app
  records itself (MediaRecorder, AAC `.m4a`, at most 3 minutes) instead of asking a recorder app, which many phones lack;
  RECORD_AUDIO is asked on the first tap only. A capture of kind `audio`, purpose `hang` (not a photo purpose, so no shot
  list item and no takeoff photo; both engines skip it, pinned by the shared fixture). Shown only when the phone has no
  recogniser (the manifest's `<queries>` lets Android 11+ say so) or a dictation launch failed. Rejected: always showing it
  (two microphones side by side), transcribing on the phone (no offline Hungarian model without a paid SDK).

- **D-85 … D-89 · not used.** Reserved for fork F5, which needed D-80 … D-84.
- **D-90 · Features are built in, on by default, and each one switchable (the Founder's general rule), 2026-11-21.**
  The Founder, answering F3's question 3: *"my general approach towards features modularity: … I would default to have
  upcoming features and programs be integrated so we have them, but everything generally should be modular in its core
  design (with settings behind features to tinker with them, toggle each or all features as it pleases for high level
  customizations and user preference first design)."* **Rule for every WP from now on:** when a feature is optional,
  build it rather than leave it out; give it a switch (and a switch for the whole group) in the place the user tunes
  that tool; default on; a feature that needs another goes off with it; the stored setting lists only what is OFF, so
  a feature added later arrives on. First applied: Kamera 2 (M46), `sketch-core` `CameraFeatures` (12 switches: szöveg
  kiolvasása, címkefotó magától, elmosás, arckeresés, arckeresés személyes fotón, személyes adat, GPS törlése,
  előtte / utána, aláírás, séta videó, hiányzók elöl, „+ még”), one setting per phone in ⚙ → *Kamera funkciók* (and the
  Kamera front's ⚙ Funkciók tile).

- **D-91 · One feature registry for the whole Sketcher (M51), 2026-11-21.** Taken in fork F6. Every user-facing feature
  is one entry `{id, front, sym, label, requires, default, locked}` in `Sketcher/catalog/features.json`, grouped by the
  seven fronts plus *Variánsok* and *Rendezés / export* (73 today). The phone's engine is `sketch-core` `Features.kt`
  with the list in code (FeaturesTest checks it against the JSON), the Desktop's `Sketcher/lib/features.js`; the shared
  fixture `Sketcher/test/fixtures/features.json` keeps them equal. F3's `CameraFeatures` and F5's `SketchFeatures` stay
  as they are (their code still asks them) and appear as the `kamera.*` entries and four more (D-96). Rejected: one list
  per front or per fork (the Founder asked for *each or all*, in one place).
- **D-92 · The switches belong to the phone (the browser), not to the survey (M51), 2026-11-21.** Taken in fork F6.
  One setting per phone and one per browser, for every survey; the phone and the Desktop do not share them (each is the
  user's own tool there). **Answered 2026-11-21: A** (they stay separate; the package never carries them). The survey *plugins* (alaprajz, villany, fotopont) stay per survey and are a separate thing:
  a plugin decides what one survey uses, a switch what the user ever wants to see. A plugin whose every tool is switched
  off is not offered.
- **D-93 · Off leaves no trace, deletes nothing and never changes a file's meaning (M51), 2026-11-21.** Taken in fork
  F6. A switched-off feature's tools, wheel items, chips, cards, badges, loose ends, fronts and buttons go; the data it
  made stays in the survey and comes back with the switch. The exported package (`.vsketch.json`) is the same whatever
  is switched off; the switches decide only the files beside it (photos, marked copies, the `.takeoff` files) and the
  Desktop's buttons (⇩ Takeoff, Jegyzőkönyv). Privacy on export never follows a UI switch: a personal photo still leaves
  only blurred and without GPS, and *GPS törlése kiadáskor* has no prerequisite (it sits under Rendezés / export).
  The Planner and the Workflow Kit read the file as it is.
- **D-94 · Prerequisites grey, Mind switches, Mozgat stays (M51), 2026-11-21.** Taken in fork F6. A feature whose
  prerequisite is off is off and shown greyed with „előbb: …”; its own switch is kept, so it returns with the
  prerequisite. *Mind* per group and for everything: Mind ki switches every feature off, **Mind be** switches every
  default-on feature on and leaves the default-off option (D-79's implied dedicated circuits) as it was, so „all on”
  never changes a quantity behind the user's back. *Mozgat* is locked on: the canvas always has a tool, Vázlat always
  stays on the front bar. Rejected: Mind be = everything incl. the options. **Answered 2026-11-21: A** (Mind be leaves the
  option as it was).
- **D-95 · A variant cannot switch on what the user switched off (M51), 2026-11-21.** Taken in fork F6. User
  preference first: everything a variant brings passes through the registry after it — its rail order and plugins
  (`Features.rail`), its drawing tune (`Features.draw`: *Rajz-hangolás* off = the original tools), the hold wheel
  (`Features.wheel`), its extra chips, questions and shots (gone with their feature). A variant has no way to switch a
  feature on; if one ever needs to switch one *off*, it can be added as an optional key later.
- **D-96 · The settings stay where they were saved (M51), 2026-11-21.** Taken in fork F6. Four stores, read as one and
  written back split: F3's `sketcher-camera` / `off` (CameraFeatures ids), D-79's `sketcher` / `takeoff.impliedDedicated`,
  F5's `sketcher-features` / `off` (SketchFeatures ids) and the new `sketcher-features` / `flipped` (every other id that
  differs from its default). A phone that had switched camera features off keeps them bit for bit (tested), the Munkakör
  lap's toggle and ⚙ Funkciók are the same switch, and an older app still reads its own store. Ids the app does not
  know are kept (a newer app's switch). On the Desktop: `vrg-sketcher-features` + D-79's `vrg-sketcher-implied-dedicated`.
- **D-97 · A front with nothing on leaves the front bar (M51), 2026-11-21.** Taken in fork F6. When every feature of a
  front is off, its symbol leaves the front bar (the Desktop's rail), its loose ends leave Nyitott, and an open front
  falls back to Vázlat (Áttekintés on the Desktop). The Kamera front needs *Fotó céllal*; its other features depend on it.
- **D-98 · Without the hold wheel there is no wheel (M51), 2026-11-21.** Taken in fork F6. *Tartásra kerék* off: a hold
  on the canvas does nothing; the point type is still chosen on the Pont tool's row, ↶ still undoes, but Törlés lives on
  the wheel (question 2 of the F6 report; **answered 2026-11-21: A**, no separate Törlés, the wheel can be switched back on). Other switched-off features leave their wheel sectors empty, so the
  directions the hand knows do not move.
- **D-99 · The map's site panel follows the Sketcher's switches (M51), 2026-11-21.** Taken in fork F6. The phone's map
  page gets `hide` in `/__phone/site.json` (from the general store; the map only reads it), the Desktop sends it with the
  survey; `Map/lib/site-layer.js` leaves out ▱ Körvonal, 🛰 Műhold or ◫ Vázlat and opens in the mode that is left.
- **D-100 · The in-app camera is CameraX 1.4.1, the version QR párosítás already ships (M52), 2026-11-21** (fork F7, taken
  for the Founder, rule 5). `androidx.camera:camera-camera2 / camera-lifecycle / camera-view` 1.4.1, **Apache-2.0**, min SDK
  21 (ours is 28). `feature-pair` already puts the same three artifacts in the APK, so `feature-sketch` naming them adds
  only its own code (estimated under 0.1 MB; no new native code). Preview + ImageCapture bound to the editor's
  lifecycle, the same `AndroidView { PreviewView }` pattern as the QR scanner. Rejected: Camera2 by hand (several times
  the code for the same preview / capture / torch / zoom / focus), a third-party camera library (a new licence and size
  for nothing CameraX lacks). Details: `WP/M52.md`.
- **D-101 · The camera app stays the fallback (M52), 2026-11-21.** ⚙ → Kamera funkciók → *◉ Saját kamera* off = the
  phone's camera app exactly as before (M29 / M46). With it on, a CameraX bind or capture failure falls back to the
  camera app for the rest of the app's run (a note says so) and the next start tries CameraX again. The walk video and
  the signature are unchanged (the camera app's video mode, the pad).
  Asked (F7, 2026-11-21): should the in-app camera record video too? **A** no, the walk video stays with the camera
  app's video mode (D-60) / **B** yes, in a later round. The Founder chose **A** (2026-11-22).
- **D-102 · An in-app photo lands where a camera-app photo lands (M52), 2026-11-21.** The file is written straight into
  `files/sketch/photos/<id>/` under the same name scheme (`C-<base36 time>.jpg`, Fotópont `<F id>-…`), then goes
  through the same `captureTaken` / `photoTaken` path: same Capture record, GPS read back from the file's own EXIF, the
  type-plate reader and the face hooks, D-57 stripping on export. GPS: CameraX writes the phone's last known position
  into the EXIF only when the location permission was **already** granted (Helyszín asks for it; the camera never
  asks) and *⌖ Helyadat a fotón* is on. Nothing new in the survey file, so the Desktop page and an older phone see an
  ordinary photo.
- **D-103 · The viewfinder's purpose strip (M52), 2026-11-21.** Symbols and colours, little text. The current purpose is
  a coloured badge (symbol + short label); a tap opens the strip: the shot list's next four missing items first (marked
  with a dot, room items left out: they are Fotópont's), then the current purpose, the three used last, then the
  catalog's order; *Szoba* never (Fotópont). With *Hiányzók elöl* (QUICK) off the missing items are left out. The room
  in focus is a chip (a tap cycles the rooms and *—*); the count is the photos of that purpose (and item).
- **D-104 · Series in the camera (M52), 2026-11-21.** With *⟳ Sorozat a kamerában* on, the camera stays open after each
  shot until **✓** (or Back); off, it closes after a shot unless the M29 *⟳ Sorozat* is on. After a shot for a
  shot-list item that is now complete, the next shot goes to the next missing item of the same purpose, else to the
  purpose without an item. The last thumbnail with **↶** deletes that shot (an ordinary edit: the editor's undo can
  bring it back). Fotópont photos always close after one shot, for the direction swipe.
- **D-105 · The ghost overlay (M52), 2026-11-21.** For an after-photo (◑ Utána, `pairOf`) the before-photo lies over the
  preview, cropped the way the preview is (fill-centre), at 40 % by default, slider 0–80 %, a ◐ button hides it. On the
  viewfinder a ◐ chip also lists the befores of the current purpose still waiting (same room first): picking one pairs
  the next shot with it. After the after-photo the pair is done and the ghost goes. Needs *◐ Előtte / utána* too.
- **D-106 · Level and grid (M52), 2026-11-21.** The gravity sensor (the accelerometer where there is none), low-pass 0.15:
  a line across the preview turned by the roll against the nearest quarter turn, green within 1°, the degrees beside it;
  lying nearly flat (pointing at the floor or the ceiling) it becomes a bubble. The grid is the rule of thirds, shown
  while *▦ Rács* is on, with a viewfinder button to hide it for that session.
- **D-107 · Torch, focus, zoom (M52), 2026-11-21.** The torch button (only when the camera has a flash unit) starts off
  every time the camera opens. A tap on the preview focuses and meters there (3 s, then back to auto) with a ring;
  pinch zooms within the camera's range, the factor shown while it is not 1×. Focus and zoom are the camera's basic
  behaviour and have no switch of their own; everything else does (D-108).
- **D-108 · Seven new switches (M52), 2026-11-21.** In `CameraFeatures` (until F6's registry takes them over, M51):
  *◉ Saját kamera* and, each needing it, *⌖ Helyadat a fotón*, *⟳ Sorozat a kamerában*, *◐ Szellemkép* (also needs
  *Előtte / utána*: a new `also` list of prerequisites), *⊖ Vízszintező*, *▦ Rács*, *ϟ Lámpa*. All on by default; a
  phone that stored Kamera 2's switched-off list gets them on.
- **D-109 · The capture moment (M52), 2026-11-21.** The shutter takes the picture with `CAPTURE_MODE_MINIMIZE_LATENCY`,
  rotated by the phone's real orientation (the screen may stay portrait), a short white flash on the preview, the shot's
  thumbnail in the corner. A capture error leaves the camera open with a note; a second one in a row falls back (D-101).
- **D-110 · F8: the end-to-end fixtures are written by the phone's code, and everyone else must match them (M53),
  2026-11-21.** Taken in fork F8. Three realistic surveys are built in the JVM with the phone's own edit operations
  (sketch-core `E2eTest`: a flat renovation with everything F1–F5 added, a new house with an EV charger and the implied
  dedicated circuits on, a conversation with nothing drawn), exported as the Rendezés export does and committed under
  `Sketcher/test/fixtures/e2e/`. `Sketcher/test/e2e.test.js` (in `run.js`) opens them with the JS engines, the Desktop
  page and the Planner and compares with what the phone showed; a stale fixture fails the JVM run
  (`VRG_SKETCH_FIXTURE=update` rewrites it). An M24 v1 file and an M29-era v2 survey sit beside them and must open
  unchanged. Rejected: fixtures written from JS (the phone is where surveys are made), Playwright (jsdom is what the
  Sketcher and Planner tests already use, no browser needed in CI).
- **D-111 · F8: the Desktop page counts implied dedicated circuits as the phone did (M53), 2026-11-21.** Taken in fork
  F8, refining D-79. A package carries its takeoff and, in `config.impliedDedicated`, the phone's setting. Opening such
  a package, the page uses that setting (the toggle shows it, „a telefon beállítása szerint”) until the toggle is
  touched; then the browser's own setting rules again. Found by the e2e test: with the phone's toggle on, the Desktop
  showed one dedicated circuit fewer than the phone. Rejected: always the browser's setting (the two screens disagree on
  the same file), storing the phone's setting in the browser (one survey would change every other).
- **D-112 · F8: the takeoff names a video and a signature by their export names (M53), 2026-11-21.** Taken in fork F8.
  The takeoff's photo list (Kotlin and JS) used `<stem>_<id>_<purpose>.jpg` for every capture, so the Planner's survey
  panel named a walk video and a signature by files that never exist. It now uses the export's name
  (`Intake.exportName`: `.mp4`, `_alairas.png`); they still count with their purpose (a video under its purpose, a
  signature under Dokumentum), a sound note not at all (F5, D-84).
- **D-113 · F8: F5's D-80 kept over F8's file marker for the Csere preset (M53), 2026-11-21.** F8 had first added a
  `presetsV` key so an old survey gets *Csere* once and a deleted *Csere* stays deleted; F5 landed the same fix as
  D-80 (on open, switchable, answered A by the Founder). The merge keeps D-80 only. Asked: under D-80 a *Csere* the
  user deleted comes back the next time the survey opens (while *Csere címke régi felmérésben* is on). **Answered
  2026-11-21: A** — it stays that way; the switch turns it off. Rejected: **B** a file marker so it is added only once.
- **D-114 · F8: what CI covers for the Sketcher (M53), 2026-11-21.** Taken in fork F8. *VRG Mobile (Android)* now also
  starts on `Map/lib/site-math.js` (inlined into the Desktop page, replayed by the JVM), the Planner's sketch import and
  survey sources and fixtures, and runs the Planner's spec-111 / spec-112 after building it from source, so the e2e test
  opens the Planner as it is. The release workflow starts on everything the APK takes from outside `Mobile/android`
  (`feature-sketch/build.gradle.kts`): `Sketcher/catalog`, `Sketcher/variants` and, since F9 bundles the report,
  `Sketcher/lib`; the map page comes from `main` at run time (M43).
- **D-115 · F8: the exported package keeps every photo's position and the signer's name (M53), 2026-11-21.** Asked in
  fork F8 (audit 8): the photo FILES leave without GPS (D-57), but the package's survey copy keeps each capture's
  lat/lon, a personal photo's too, and the signature's signer. **Answered 2026-11-21: A** — the package is the
  Founder's own record (as D-57 says of the survey file), so it keeps them. Rejected: **B** stripping them from the
  package for personal photos.
- **D-116 · F8: a switched-off sound note stays out of the package, the one exception to D-93 (M53), 2026-11-21.**
  Asked in fork F8 (audit 18): F5's D-84 drops the sound notes from the package while *Hangjegyzet* is off; F6's D-93
  says the package never changes with the switches. **Answered 2026-11-21: A** — D-84 stands, by the Founder's D-90
  (a feature switched off leaves no trace in the exports either); D-93 holds for every other switch, and
  `E2eTest.everythingOffKeepsThePackage` pins exactly this. Rejected: **B** always the same package.
- **D-117 … D-119 · not used.** Reserved for fork F8, which needed D-110 … D-116.
- **D-120 · F9: the phone's jegyzőkönyv is the Desktop's renderer in a hidden WebView (M54), 2026-11-21.** Taken in fork F9,
  following the Founder's D-81 B and M50's plan. `report.js` + `fieldkit.js` run through `report-phone.js`; the phone
  only puts the input together (`Jegyzokonyv.kt`). Rejected: a Kotlin copy of the document (a third engine to keep equal).
- **D-121 · F9: the renderer is copied from `Sketcher/lib` at build time, checked byte for byte (M54), 2026-11-21.** As the
  catalog and the variants already are; the Gradle task fails on a differing copy, `report-phone.test.js` checks the
  list. Rejected: copies committed under `Mobile/` (they would drift, and a check would only report it).
- **D-122 · F9: PlanSvg / SiteSvg draw from the package plan, numbers as JavaScript prints them (M54), 2026-11-21.** The
  drawing is the one the Desktop shows when it opens the phone's package (`PlannerExport`'s floors and devices, not the
  editor's canvas); `JsNum` prints `4000`, not `4000.0`. The fixture is made from `app.js`'s own functions
  (`make-report-fixture.js`), so a Desktop change makes it stale; the JVM test allows a few ulps per number (Java's
  and V8's sin / cos may differ in the last bit), never a different text.
- **D-123 · F9: the report follows the export rules, stricter on photos (M54), 2026-11-21.** `SketchFeatures.forExport`
  (client only when kept, D-82; no sound notes when off); every photo re-encoded (no EXIF at all, so no GPS even where
  the package keeps it, D-57), the blur burned in and nothing else; a *Személyes adat* photo only blurred, otherwise
  named as withheld. Rejected: the package's photo files (full size, GPS where kept, markup copies).
- **D-124 · F9: *Az ügyfélnek* drops the Tisztázandó notes and the Ellenőrizni lines only (M54), 2026-11-21.** Kept: the
  Döntésre vár list and the open questions (the client is the one who answers them). A switch in the dialog, off each
  time it opens (a report for the client is a deliberate choice). Rejected: remembering it per phone. **Answered 2026-11-21: A**:
  the client's name stays under D-82 in this mode too (in the report only when *A kiadott csomagban marad* is on). Rejected:
  **B** always in the client's report.
- **D-125 · F9: photos at 1200 px, JPEG 80, in the export cache (M54), 2026-11-21.** Sharp at a third of A4 and about
  150 KB each (40 photos ≈ 6 MB of HTML); signatures as PNG; `cache/sketch/report/` is emptied at the next report.
- **D-126 · F9: PDF through the system print dialog; over 15 MB Átadás warns and offers it (M54), 2026-11-21.**
  `PrintManager` + the WebView's print adapter (A4): *PDF mentése* writes the file wherever the user picks, no PDF
  library. Átadás over 15 MB shows the size with *🖨 Inkább PDF* and *Mégis küldöm*. Rejected: a hard block.
- **D-127 · F9: the switch *📄 Jegyzőkönyv a telefonon* is the registry's `export.report_phone`, requiring `export.report` (M54), 2026-11-21.**
  In F6's registry (M51, `Features.kt` = `Sketcher/catalog/features.json`), front *Rendezés / export*, on by default.
  It requires F6's `export.report` (the Desktop's Jegyzőkönyv), so switching the jegyzőkönyv off anywhere takes the
  phone's button with it (shown greyed with its reason). Off: no button, nothing made; like every M51 switch, it never
  changes the package or what a file means (D-93). Built first in F5's `SketchFeatures`, moved when F6 landed.
- **D-128 · F9: Rendezés → 📄 Jegyzőkönyv, a dialog (M54), 2026-11-21.** Next to the two export buttons (the row now
  wraps on narrow phones); the dialog has *Az ügyfélnek*, *🖨 Nyomtatás / PDF*, *⇪ Átadás (.html)*, the privacy line and
  the result's name and size. Rejected: putting it into the Küldés share (the package is what the PC reads).

- **D-129 · VRG Térkép navigation, N2: our own offline road network (M55 line), 2026-11-21.** Asked by the Founder
  with the Térkép-feed ("Waze type … intelligent pathfinding"), answered **A**: the PC turns the Hungary OSM extract the
  map already has into a compact road network, the phone keeps a copy, and routes are computed in the map page
  (offline, nothing leaves the phone, the same on the PC and the phone). Not built yet (N2). Replaces D-49 C's "no route
  planning of our own"; the hand-off to a navigation app stays as the fallback. Rejected: **B** an online routing
  service (internet, the position and destination sent out, usage limits); **C** a native navigation kit (Ferrostar +
  Valhalla: a second map stack beside the page, against D-48). **Built 2026-11-21 as WP M56** (`docs/map/ROUTING.md`): junctions-only
  graph, car speeds from `maxspeed` or the road class, A* by time in the page, no turn restrictions yet.
- **D-130 · Traffic: none at first, a traffic service later as an opt-in (N3), 2026-11-21.** Answered **A, then B**:
  ETAs from road types and speed limits; later a keyed provider (e.g. TomTom, terms to verify) asked only for the
  chosen route and only on a tap. No free open live-traffic source exists for Hungary. Rejected: **C** no traffic ever.
  **Built 2026-11-21 as WP M58** with the guidance (`docs/map/NAVIGATION.md`): TomTom Routing v1 with the user's own key
  kept on the device, car routes only, one request per tap; the shown time changes, the route does not.
- **D-131 · The feed's points come from OpenStreetMap, kept on the phone; own pins never leave it (M55), 2026-11-21.**
  Answered **A**: `Map/tools/build-pois.js` extracts all of Hungary from the OSM extract into `Map/data/pois.json`; VRG
  Mobile keeps the copy it reads through the relay (public ODbL data, like the address index). Otthon and the user's own
  Daniella / szerelvénybolt pins live in the page's storage on the device (D-31). The "Korean type" store is the
  Chinese/Asian variety store (`shop=variety_store`), confirmed by the Founder; missing Daniella branches are added as
  own pins, confirmed. Rejected: **B** online lookups (Overpass: the position sent with every search); **C** own list only.
- **D-132 · Public transport: the nearest stops now, BKK live departures later (M55), 2026-11-21.** Answered **A now as
  the future fallback, B later**: stops from OSM (offline, all of Hungary); BKK FUTÁR departures for Budapest in a later
  WP (a free developer key, internet). Taken as defaults in the session (the Founder did not answer the feed-rules
  question): six cards by default (Otthon, Daniella, szerelvény/barkács, élelmiszerbolt, étkezés, kórház/orvos; Kínai
  bolt, WC, Megálló switchable, at most six on), one per category in that order; the list follows the user after 25 m or
  30 s; a selected place stays the target; tap frames, hold (RCO, right-click on the PC) selects.

- **D-133 … D-136 · Szobadoboz (M57, dev line skcam K1), 2026-11-21.** Taken for the Founder while building ("proceed
  with the outlined dev work"); each can be revisited.
  - **D-133 · Where the room's shape comes from.** Chosen **A**: from the sketch (the plan's outline in mm, the photo
    point, the side), with the photos projected onto it. Rejected: **B** photogrammetry from the four photos (turning on
    one spot gives no parallax, so there is no depth to recover); **C** a learned depth model (not offline-light, and its
    sizes are guesses).
  - **D-134 · Where it shows first.** Chosen **A**: the Desktop Sketcher page, an overlay opened from the Vázlat front
    (the photos and the package are already there; the PC has the screen for it). Rejected: **B** the phone first (the
    WebView route of M54 is K1b); **C** the Planner (a large app; it can reuse `roombox.js` later).
  - **D-135 · How it is drawn.** Chosen **A**: our own WebGL 1 (one shader, ~150 lines), offline from `file://`.
    Rejected: **B** three.js (≈600 KB inlined into the page, or a CDN, against the offline rule); **C** a 2D canvas
    unwrap of the walls (no "standing in the room" view).
  - **D-136 · Where the corrections live.** Chosen **A**: an optional survey key `box` written by the Desktop (room
    heights, camera height, per-photo direction / tilt / field of view); the survey stays v2. Known gap: the phone
    ignores unknown keys, so a survey re-saved on the phone drops `box` until K1b keeps it. Rejected: **B** a separate
    side file (one more file to carry); **C** browser storage only (lost with the browser, not in the survey).

- **D-137 … D-141 · Szobadoboz a telefonon (M59, dev line skcam K1b), 2026-11-22.** Taken for the Founder while
  building ("start K1b, the room box on the phone"); each can be revisited.
  - **D-137 · How the phone draws the box.** Chosen **A**: the Desktop's own `roombox.js` + `roombox-gl.js` in a WebView,
    with a touch UI file of its own (`roombox-phone.js`), as the jegyzőkönyv runs `report.js` (D-120). Rejected: **B** a
    native OpenGL / Compose renderer (a second copy of the projection to keep equal); **C** the box on the PC only.
  - **D-138 · The `box` key on the phone.** Chosen **A**: kept as the cleaned JSON object the viewer writes
    (`RoomBox.clean`), read and written by `SketchJson`, so the Desktop's and the phone's corrections are one key.
    Closes D-136's known gap. Rejected: **B** a typed Kotlin model (more code for data only the viewer edits); **C**
    dropping it on the phone (as before).
  - **D-139 · The lens per Fotópont shot.** Chosen **A**: the in-app camera stores a 35 mm equivalent on each Fotópont
    shot (Camera2 focal length and sensor size × the zoom ratio); `roombox.js` uses it after a typed value and before
    EXIF. Rejected: **B** EXIF only (CameraX writes the real focal length, not the equivalent, and the camera app may
    write neither); **C** the user picks the lens by hand.
  - **D-140 · Fotópont opens wide.** Chosen **A**: with `vazlat.roombox` on, a Fotópont shot opens at the camera's
    widest zoom (0.5× with an ultrawide), so four shots reach the corners; pinch still changes it. Rejected: **B** its
    own registry switch (one more switch for one behaviour of the box); **C** always 1× (the corner gap, research §1.1).
  - **D-141 · Where the box opens.** Chosen **A**: Rendezés → ⬚ Szobadoboz, where the plan is solved in mm. Rejected:
    **B** the Fotópont wheel (the plan may not be solved there); **C** a front of its own (the fronts are the survey's
    capture places).
- **D-142 … D-144 · VRG Időjárás on the phone (M44), 2026-11-22.** Asked as A/B/C in the session; answered "1A 2A 3B"
  (the recommendations), relayed from the Founder's coordinating session.
  - **D-142 · The form: a native screen.** Chosen **A**: "can we work outside today" per activity, with the reasons and
    the longest calm window, the official warnings, the fused 72 hours with their spread, a home-card line, and the
    PC's page one tap away through the relay. The fusion and the rules are ported to a pure-Kotlin `weather-core`,
    and `Weather/config` is bundled as exact copies under a test. Rejected: **B** the PC page only (it needs
    `serve.js` and its database, so it is useless on a site away from the PC); **C** a notification only (no screen;
    it can come later on top of A).
  - **D-143 · Sources the phone calls itself: keyless and free for a company.** Chosen **A**: MET Norway, DWD MOSMIX
    (nearest station within 45 km) and MeteoAlarm. Open-Meteo stays on the PC: a company may use it only with a paid
    key, which would be a secret on the phone. MET Norway's terms want a contact in the User-Agent. It is a field
    under ⚙ ("Kapcsolat (MET Norway)") kept on the phone only, and the source waits until it is filled in. Nothing is
    committed. Rejected: **B** adding the HungaroMet 10-minute measurements (a zipped CSV every 10 minutes on mobile
    data); **C** MET Norway and MeteoAlarm only (one forecast, so the confidence always reads "egy").
  - **D-144 · Location: named places and "Itt" on a tap.** Chosen **B**: the towns of `places.json`, saved places,
    and ◎ Itt. Itt reads one position on the tap, rounds it to two decimals (~1 km) and uses it only as the forecast
    query's coordinates, in the D-31 spirit. The county for the warnings is taken from the nearest approximate county
    centre (Budapest within 12 km). The PC Map's job sites stay on the PC. Rejected: **A** no GPS; **C** automatic
    GPS on every open.

- **D-145 … D-149 · Síkmérés (M60, dev line skcam K3), 2026-11-22.** Taken for the Founder while building ("start K3");
  each can be revisited.
  - **D-145 · One screen for the phone and the Desktop.** Chosen **A**: `Sketcher/lib/plane-ui.js` on the Desktop page
    and in a WebView on the phone (as D-137). Rejected: **B** a native Compose measuring screen (a second copy of the
    geometry and the gestures to keep equal).
  - **D-146 · The reference.** Chosen **A**: a rectangle of known size (presets or a typed size), its corners tapped by
    hand in any order, a landscape sheet read the right way round with ⇄ to override. Rejected: **B** a printed ArUco /
    ChArUco card found automatically (needs a detector; it stays a later step); **C** one known length (not enough to
    undo perspective).
  - **D-147 · Heights.** Chosen **A**: a floor line tapped on the floor–wall edge, heights measured square to it on the
    plane. Rejected: **B** the camera-height method (needs a level camera and a known height, both easy to get wrong).
  - **D-148 · Where the results live.** Chosen **A**: an optional survey key `planes` by photo (a capture id or a
    Fotópont shot), the millimetres stored computed, the phone keeping it (`Planes.kt`). Rejected: **B** inside the
    capture's marks (Fotópont shots have no marks); **C** a side file.
  - **D-149 · Accuracy.** Chosen **A**: a reach grade beside every value (jó ≤ 2×, közepes ≤ 5×, távoli beyond, in
    reference sizes) and the advice to measure with the 1× lens; no lens-distortion correction yet. Rejected: **B** a
    calibration step before the first measurement (later, with the marker card).
- **D-150 · Tárgykereső: which state of the tag to build for (M61, experimental), 2026-11-20.** Taken while building, the
  Founder may revisit. Chosen: **both** — a never-paired tag (pairing mode, `FD44`) and one paired to someone's Apple ID
  (the separated advertisement with its rotating key) — with **no Apple account anywhere in VRG Mobile**. The phone
  works only with what the tag says over Bluetooth: distance, ring, left-behind, the phone's last place. Rejected for
  now: signing in to Apple from the phone (an Apple ID password in VRG Mobile, against Apple's terms, and still no key
  to decrypt with). Details: `WP/M61.md`.
- **D-151 · Tárgykereső: no remote location (M61), 2026-11-22.** Asked: the Founder chose **A**. The tag stays local, as
  built: distance, ring, left-behind and the phone's last place, nothing more to set up. Rejected: **B** the Apple way
  through the PC (pair once with an iPhone / Mac, export the key, a PC helper with an Apple ID fetching reports for the
  phone: unofficial, against Apple's terms, fragile, needs a Mac); **C** a Google Find Hub tag beside it (not ruled out
  as a purchase, just not part of this WP). Details: `WP/M61.md`.
- **D-152 · Tárgykereső: the iTag joins it (M61), 2026-11-22.** Taken while building on the Founder's "in the same
  fashion, add this device as well", may be revisited. The teardrop iTag is a second kind of tag in the same feature
  (one tag book, one screen, one left-behind service), not a feature of its own. Its connection is held only while
  *Kapcsolat tartása és ottfelejtés* is on, because a link opened with the screen would make the tag slow-beep every
  time the screen closes. Telefonkereső (its button rings the phone) works only on that held link. Details: `WP/M61.md`.
- **D-157 · Tárgykereső: a paired device, the Q71 watch (M61), 2026-11-22.** Taken while building on the Founder's
  "repeat the process with this device as a third type of item", may be revisited. The Q71 is a FunDo-app calling watch
  whose protocol is not public, so it is **not** reverse-engineered or guessed: it is followed through what Android
  offers for any paired device — the connection as presence (Ottfelejtés, last place), a tone over hands-free audio
  (SCO) as Csipogtatás, and its BLE side by name for the distance. Chosen from the phone's paired list. Works the same
  for earbuds or a speaker. Rejected: sending guessed FunDo bytes to the watch. Details: `WP/M61.md`.
- **D-162 · Tárgykereső: Diagnosztika is read-only (M61), 2026-11-22.** The Founder asked to debug the Q71 and update its
  firmware. Not flashing a closed firmware (a wrong image bricks the watch; the update channel is FunDo's). Built
  instead, as step 1 of a plan the Founder approved ("start steps 1 and 2"): a read-only GATT inventory — every service
  and characteristic listed, only standard ones read (names, Device Information, battery; never a vendor characteristic
  or a serial number), a chip guess from the maker's update service — shared as `vrg.device-diag` v1, which the Data
  Vault's Eszközeim keeps (the Founder's "two parallel versions": work here, personal in the vault). Details: `WP/M61.md`.
- **D-163 · App archive in two versions, one manifest (M61), 2026-11-22.** Step 2 of the same plan: an exact copy of an
  installed app (first FunDo Pro) for legacy compatibility. Work: `Mobile/tools/app-archive.js` (START L → P) into
  `{vrg}\Backup\installers\android`, never git. Personal: the Data Vault's `tools/apps.js`, manifest in git, APKs on the
  PC. One format, `vrg.app-archive` v1. Only apps the Founder installed, pulled from the Founder's own phone; never a
  mirror-site download, never redistributed, FunDo's code never decompiled (a companion of our own comes from a capture
  of the watch's traffic, clean-room). Details: `WP/M61.md`.

- **D-153 … D-156 · Körkép (M62, dev line skcam K4), 2026-11-22.** Taken for the Founder while building ("start K4");
  each can be revisited.
  - **D-153 · How the photos are put together.** Chosen **A**: from the poses the survey knows (one spot, direction,
    tilt, lens), refined by matching neighbours where they overlap (normalised cross-correlation, our own code).
    Rejected: **B** OpenCV's Stitcher on the PC (a native library, feature matching that the known poses make
    unnecessary, and no phone version); **C** a learned model.
  - **D-154 · Where the alignment goes.** Chosen **A**: into the survey's `box` key as the shots' yaw / pitch
    corrections, the same ones the Szobadoboz sliders write, so the 3D view improves with it. Rejected: **B** a separate
    panorama record (two sets of corrections for the same photos).
  - **D-155 · The 360° file.** Chosen **A**: an equirectangular JPEG with the GPano XMP, which Google Photos and other
    viewers show as a sphere. Rejected: **B** a viewer of our own (the Szobadoboz's *A pontból* view already looks
    around); **C** cube faces (fewer viewers read them).
  - **D-156 · Where the buttons are.** Chosen **A**: in the Szobadoboz panel, one Körkép row per photo point
    (⟲ Igazítás, ⇩ 360° kép), behind `vazlat.pano`. Rejected: **B** on the Fotópont wheel (no solved plan there for
    the 3D check); **C** automatic alignment on every open (it changes the survey; the user should see it happen).

## Open (to ask when the WP that needs them starts)

None.
