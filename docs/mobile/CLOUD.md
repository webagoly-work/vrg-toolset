# VRG Mobile in a cloud session: what works there and what does not

A claude.ai/code session runs in a Linux container with a filtered network. A Légegér cloud session
established the limits on 2026-10-27, and `Mobile/docs/legeger.md` §Verified records them.

| Works in the cloud | Does not |
|---|---|
| Gradle wrapper download, Maven Central, Gradle Plugin Portal | **Google's Maven** (`maven.google.com`, `dl.google.com`): no Android Gradle Plugin, no AndroidX, no SDK |
| `VRG_JVM_ONLY=1 ./gradlew :kit-core:test :airdeck-core:test` | `assembleDebug`, lint, instrumented tests |
| Node: the relay, `Mobile/tests/relay-e2e.js` (with Playwright, if it installs) | a phone, Bluetooth, a camera, adb |
| reading and writing the repo, committing, pushing **its own branch** | pushing `main`, creating GitHub secrets or OAuth apps |

## Consequences for how every WP is written

1. **Keep logic in pure Kotlin modules.** Every feature puts its rules, its protocol and its parsing in a
   `<feature>-core` (or `kit-core`) JVM module with tests. The Android module is the thin shell around it
   (UI, permissions, system services). This keeps most of every WP testable in the cloud.
2. **The PC side is Node.** Relay additions (pairing, ports, launch, drop) go in
   `Planner/projects/varler-planner/tools/phone-relay-server.js` (or a sibling module it requires) with
   tests in `Mobile/tests/`. They run in the cloud.
3. **The APK comes from GitHub Actions.** The workflow is kept at `Mobile/ci/mobile-android.yml`, because
   the desktop's token cannot push files under `.github/workflows/`. **The first cloud session installs it:**
   `mkdir -p .github/workflows && cp Mobile/ci/mobile-android.yml .github/workflows/`, commit, push. If that
   push is refused too, remove the copy from the commit, push the rest, tell the user, and carry on: the
   desktop builds APKs with `Mobilemobile.cmd` until the workflow is in. Once installed, pushing the
   session branch triggers `.github/workflows/mobile-android.yml`, which runs the tests, builds the debug APK and attaches it as an
   artifact. A compile error in the Android modules first shows up **there**. Ask the user to look at the run,
   or check it with `gh run list` / the GitHub API if the session has access, and fix it in the next commit.
4. **On-device checks are a list, not a claim.** Each WP ends with a "Telefonon ellenőrizni" list. The user
   (or a desktop session with the phone on USB) works through it, and the WP stays BETA until they have.

## Start of a session

```bash
java -version                       # 17+ needed; the container has one
cd Mobile/android
export VRG_JVM_ONLY=1
./gradlew :kit-core:test :airdeck-core:test   # must be green before you change anything
```

If even the Gradle wrapper download fails, the network policy has changed. Say so, and work on the
pure Kotlin code anyway, checking it with `kotlinc` if it is available.
