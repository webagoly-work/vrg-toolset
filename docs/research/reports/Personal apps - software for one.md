# Personal apps: software for one person, and what it means for VRG Mobile

*Research report, 2026-11-20 (cloud session). Asked by the Founder: get informed about "personal apps", software made
mainly to serve one person, which AI coding is turning into its own part of personal-device software, and about
"omniapps". The sourced notes are in
[`../research_notes/Personal apps - software for one/notes.md`](../research_notes/Personal%20apps%20-%20software%20for%20one/notes.md),
and every claim below links its source there. The feature selection that follows from this report is
[`docs/mobile/PERSONAL-APP.md`](../../mobile/PERSONAL-APP.md).*

**How far to trust it.** All sources were read on 2026-11-20. Only Google's Android verification FAQ was read in
full. Ink & Switch, robinsloan.com and flourish.org are blocked from the cloud session, so those come from search
summaries. Anything marked UNVERIFIED in the notes is left out here or flagged.

## 1. The short answer

- **The idea is twenty years old. What changed in 2025–2026 is the cost.** Shirky's *situated software* (2004),
  Sloan's *home-cooked app* (2020) and Appleton's *barefoot developers* (2024) all say the same thing: software
  for a known, small audience does not need to scale, so it can be simple, odd and exactly right. AI coding
  (Karpathy's "vibe coding", Feb 2025, Collins Word of the Year 2025) made building it nearly free for one person.
- **"Omniapp" has no settled meaning.** No source uses it as a concept. The nearest real thing is the **super app**:
  WeChat runs its *mini programs* inside its own WebView. That is the architecture VRG Mobile already has: one
  shell, features as modules, and HTML apps in confined WebViews (M21, M18, M43, M45). Take "omniapp" to mean
  *one personal shell that absorbs your small tools*, and treat it as our own word.
- **The serious literature is not about generating apps. It is about owning them.** Ink & Switch's *Malleable
  Software* (2025) says AI generation alone does not give people control. You also need tools you can reshape, data
  in your hands, and a gentle slope from user to maker. *Local-first* (2019) gives the data checklist: offline,
  multi-device, long-lived, private, under the user's control. Sloan's five-year follow-up (2025) calls the result
  **sovereignty**: "it might go away … but that will be our decision."
- **For an Android APK built for yourself, the one real change ahead is Google's developer verification.**
  Enforcement began on 30 Sep 2026, but only in four countries (Brazil, Indonesia, Singapore, Thailand). Global
  rollout is planned for 2027. ADB installs stay allowed. A free *limited distribution* account (no ID, up to 20
  devices) covers a personal app. Its launch date is unconfirmed: the FAQ says August 2026. See section 5.

## 2. The vocabulary, in the order it appeared

| Term | Who, when | What it adds |
|---|---|---|
| Situated software | Clay Shirky, 2004 | built for a known group; does not need to scale |
| Local-first software | Ink & Switch (Kleppmann et al.), 2019 | the data stays yours: offline, multi-device, longevity, privacy, user control. Kleppmann later called the ideals "a gradient" |
| Home-cooked app | Robin Sloan, 2020 | BoopSnoop, a messenger for his family of four; "an app can be a home-cooked meal" |
| Personal software | Matt Webb, 2020 (title only) | the plain name for the category |
| Barefoot developers | Maggie Appleton, 2024 | AI lets non-professionals build for themselves and their community |
| Malleable software | Geoffrey Litt 2023; Ink & Switch essay 2025 | tools not apps; reshape what you have; AI is necessary, not sufficient |
| Vibe coding | Andrej Karpathy, Feb 2025 | describe it, let the model write it, don't read the code |
| Micro apps, single-serving / disposable software | trade press, 2025–2026 | apps made for one task and thrown away |
| Generative UI, just-in-time software | vendor and trade writing, 2025–2026 | the interface made at the moment of need; no hard numbers yet |
| Super app / everything app | WeChat model | one host app, many mini programs in its WebView |
| Omniapp | no settled source | use it as our own word for the personal super app |

## 3. The landscape, 2025–2026

**Builders that keep the app inside their own product.**
- *Claude Artifacts*: apps that run in Claude. Persistent storage arrived in Oct 2025, up to 20 MB, for published
  artifacts on paid plans. They can be viewed on mobile, but there is no APK.
- *Google Opal*: chained-prompt "mini apps", in Gemini as an experimental Gem since Dec 2025. Hosted by Google, no APK.

These are the fastest way to make something. They are also the weakest on sovereignty, because the app lives
inside the vendor's product.

**Builders that produce a real mobile app.** *Rork* and *Vibecode* (Expo / React Native; Rork's recent pages say
native Swift + Kotlin) are aimed at shipping apps. Apple removed Replit, Vibecode and Anything from the App Store,
because Apple bans apps that download code which changes their behaviour after review. Most other names (Replit,
Lovable, Bolt, v0, Glide, Tasker, Shortcuts, Home Assistant, TiddlyWiki) had no sourced mobile or offline detail in
this run.

**What people with a personal app actually built** (section 6 of the notes):
- Pat Reen's *Family Hub*: a PWA on a kitchen tablet, mostly written with Claude Code (Feb 2026).
- An Android Authority writer's household app (Aug 2026): started as a PWA, hit its limits, now being rewritten
  as native with Claude Code and Android Studio.
- Christopher Meiklejohn's social app (Feb 2026): built in a week, with a Go backend and native clients.

The common path is **web first, native where the web runs out**: background work, sensors, notifications,
Bluetooth. VRG Mobile took that path a month ago, with a native shell and web apps inside it.

**The app-store side.** The App Store's new apps rose 84% year on year in Q1 2026, while downloads grew 2–3%.
More software is being made for smaller audiences. These counts do not separate personal apps from commercial ones.

## 4. Principles that recur, and where VRG stands on each

| Principle (source) | VRG Mobile today | Gap |
|---|---|---|
| One user, so no scale, accounts or multi-tenant code (Shirky, Sloan) | yes: one owner, device trust by QR (M35) | none |
| Offline first (local-first) | partly: Console PWA, M21 apps, the Sketcher; notes keep an outbox | personal data mostly lives on GitHub or the PC |
| Longevity: works after the vendor or the builder is gone (local-first, Sloan) | partly: plain JSON files, own relay, own update channel | no export / import; depends on GitHub for sync and updates |
| Data in plain, portable formats (local-first; practitioner posts on SQLite / files) | yes for the Sketcher, sheets and notes (JSON, markdown) | no single "everything" export |
| Tools, not apps; reshape what you have (malleable software) | the catalogue + feature modules; GO VARIANT lets an agent make a Sketcher variant from a phone request | the request loop exists only for Sketcher variants |
| Privacy | Keystore keys, sealed data (M42), FLAG_SECURE on the Vault | none for v1 |
| Security of AI-written code (Veracode 2025: 45% of AI-generated samples had flaws) | tests per WP, `theresa`-style independent checks, confined WebViews with allow-lists | keep it: the main risk of the whole approach |

## 5. Mobile realities for an APK you build for yourself

**Android developer verification** (Google FAQ, read 2026-11-20).
- *What is enforced now:* certified devices on Android 8+, and only participating stores in four countries.
  Direct sideloads are not affected yet.
- *What comes in 2027:* the global rollout. An app from an unregistered developer then needs one of three routes:
  1. **ADB**: still allowed, with no wait. This is `mobile.cmd` install over USB.
  2. **The advanced flow**: developer mode, a coaching check, a restart, a one-time 24-hour wait and biometric
     confirmation. After that, installs are allowed for 7 days or indefinitely. Updates of unregistered apps work
     only with this flow on, or by ADB.
  3. **Registering**: the free *limited distribution* account needs no ID and covers up to 20 named devices, for
     testing and personal use. The $25 full account needs ID. A limited account can be upgraded, not downgraded.
- **A lost signing key cannot be recovered**, and without it the package cannot be registered.

What this means for VRG Mobile:
- **M9's self-update depends on this.** An APK that downloads and installs its next version is exactly what the
  2027 rules check.
- Before 2027:
  1. Keep `hu.vrg.mobile`'s release key safe, outside the repo and backed up. BACKUP already archives work folders.
     Confirm the key is in one of them.
  2. Register the package under a free limited-distribution account once it opens. That covers the owner's
     phones and the crew's (M33, M35), up to 20.
  3. Keep ADB as the fallback. This is a recommendation, not a decision: `docs/mobile/PERSONAL-APP.md`, Q6.

**iOS.** A free personal provisioning profile expires every 7 days. EU alternative marketplaces exist (AltStore
PAL, Epic, Onside), but Setapp Mobile closed in Feb 2026. For one user on iPhone, the PWA route (M36) is the
practical one, which is what was built.

**Wrappers.** A Capacitor-style WebView with the web build bundled into the APK is a normal, documented pattern.
The Console and ServiceKit Phone already use Capacitor. VRG Mobile does the same thing in its own Kotlin shell.

**On-device AI a personal app could call.**
- *Android:* ML Kit GenAI on AICore / Gemini Nano offers summarise, proofread, rewrite, image description and a
  Prompt API. It works only in the foreground and only on supported devices, and the cloud fallback is ours to
  build. A WebView page would reach it through a native bridge.
- *Apple:* the Foundation Models framework, a ~3B on-device model, offline, since WWDC25.

For VRG, on-device AI could cover:
- tidying dictated notes (M6, Sketcher Jegyzet);
- captioning site photos (M29);
- summarising the inbox (M10);
- all of it without sending client words to a server. That fits the anonymise rules.

## 6. Critiques and open questions

- **Maintenance.** Sloan's apps are "substantially finished" on launch day. That works for a four-person
  messenger, not for a 34-feature app. Mobile apps need more tooling than web pages (Android Authority, 2026).
  A personal app must stay small per feature, or the owner becomes its full-time maintainer.
- **Generation is not malleability.** Ink & Switch: people need to reshape, not only to ask. The VRG answer so far
  is the catalogue plus requests from the phone (GO VARIANT). Extending that loop is the most "personal app"
  thing VRG could do next.
- **Security.** Nearly half of AI-generated code samples had flaws in Veracode's 2025 study. A single user does not
  make the risk smaller when the app holds keys, client data and a relay into the PC.
- **Consistency.** Generated interfaces change between runs. That is fine for throwaway tools and bad for something
  used every day. VRG's shared kit (Mélyvíz, VRG UI Kit, RCO) is the counterweight.
- **Not found:** solid sources on skills atrophy, on fragmentation, and on who maintains personal software after
  its maker stops.

## 7. Where it is heading, 2026–2028 (forecasts, labelled)

- **Google** (a stated plan): global developer verification in 2027.
- **9to5Mac** (an extrapolation): more than 1 million new App Store apps in 2026, a record.
- **Trade press** (speculation): software made per task and thrown away, "a utility, like electricity". The
  counter-view (Built In): systems of record keep their value, and only the one-UI-for-everyone era fades.
- **Not found:** any analyst number (Gartner, IDC) on personal apps.

**Our own reading, not a forecast from a source.** The durable personal app is likely to be a stable shell that
holds the owner's data and identity, with features made and remade by an agent on request inside it. That is the
super-app pattern with one user, which is the direction VRG Mobile is already going.

## 8. Reading list

1. [Ink & Switch, Malleable Software (2025)](https://www.inkandswitch.com/essay/malleable-software/): the most serious framing; AI alone is not enough.
2. [Robin Sloan, An app can be a home-cooked meal (2020)](https://robinsloan.com/notes/home-cooked-app/): the founding text.
3. [Robin Sloan, five years of home-cooked apps (2025)](https://www.robinsloan.com/lab/five-years-of-home-cooked-apps/): sovereignty and longevity.
4. [Maggie Appleton, Home-cooked software and barefoot developers (2024)](https://maggieappleton.com/home-cooked-software): the AI-era version.
5. [Clay Shirky, Situated Software (2004)](https://www.gwern.net/docs/technology/2004-03-30-shirky-situatedsoftware): the oldest statement of the scale argument.
6. [Ink & Switch, Local-first software (2019)](https://inkandswitch.com/essay/local-first/): the data-ownership checklist.
7. [Google, Android developer verification FAQ](https://developer.android.com/developer-verification/guides/faq): what changes for your own APK.
8. [Android Authority, a custom household app (Aug 2026)](https://www.androidauthority.com/custom-household-management-3691965/): PWA first, then native.
9. [Veracode, AI-generated code security (2025)](https://www.veracode.com/press-release/ai-generated-code-poses-major-security-risks-in-nearly-half-of-all-development-tasks-veracode-research-reveals/): the main security number.
10. [9to5Mac, the App Store surge (Apr 2026)](https://9to5mac.com/2026/04/06/app-store-sees-84-surge-in-new-apps-as-ai-coding-tools-take-off/): the economics side.
