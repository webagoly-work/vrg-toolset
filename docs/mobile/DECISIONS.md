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

- **D-55 · Jegyzetek: one central Notes app, phone first (M46), 2026-11-20.** Asked: the Founder wants one central
  Notes app users mainly use, with selectable versions (module sets) and a hub other features write into, tagged by
  origin. Asked which platform first: the Founder chose **A**, the phone (VRG Mobile, replacing Gyorsjegyzet M6);
  the Desktop page follows on the same files (`Notes/catalog/noteskit.json`, the `vrg-note` format). Rejected for
  now: **B** desktop first (a self-contained page needs a local server to share storage between tools); **C** both
  at once (slower to a usable first version).
- **D-56 · Jegyzetek: where the notes live (M46), 2026-11-20.** Asked, with the warning that Sketcher notes carry
  client details: **A** each device + the PC over the relay (client data never on GitHub), **B** a private git
  branch, **C** the OneDrive Shared folder. The Founder chose **B**: the branch `vrg-notes`, one JSON file per note
  (`notes/<id>.json`), sha-guarded writes, conflicts kept as a separate note tagged `ütközés`, a tombstone for an
  emptied trash. This bends "client data never enters Git" knowingly and **unsealed** (unlike D-52); sealing the
  notes of `client` origins to the devices' keys is the follow-up to offer.
- **D-57 · Jegyzetek: who owns a feature's note (M46), 2026-11-20.** Asked: **A** a linked mirror, **B** the hub owns
  it, **C** a one-way copy. The Founder chose **A**: the feature keeps its record (the Sketcher's Entry stays in the
  survey and goes to the Planner with it) and the hub holds the same note with a fixed id; the base of the three-way
  merge is the source's text when the two last agreed (`origin.seen`). Source changed → the note follows; note
  changed → the source takes it when it next opens; both → the note keeps both texts and the source takes that; a
  trashed note is never revived; a deleted record marks the note `gone`. Details: `WP/M46.md`, `Notes/README.md`.

## Open (to ask when the WP that needs them starts)

None.
