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

## Open (to ask when the WP that needs them starts)

None.
