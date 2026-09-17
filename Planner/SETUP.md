# VARLER — setup from zero

A complete walkthrough: empty folder → working portable environment.
Plain steps, nothing assumed. Roughly 45–60 minutes, most of it downloading.

Read this once before starting. **Step 11 is the one that can lose work if you
skip it** — everything else is recoverable.

---

## Before you start

You need:

- A USB stick, **32 GB or bigger**, formatted **NTFS or exFAT** (not FAT32 — FAT32
  chokes on files over 4 GB and handles thousands of small files badly)
- An internet connection, for the downloads in steps 3–6
- About 6 GB of free space on your PC's internal drive, temporarily

**Important: build the whole thing on your PC's hard drive first, then copy it to
the stick at the end.** Assembling directly on a USB stick is painfully slow —
`npm install` alone can take twenty minutes on USB versus one minute on an SSD.
You do the work fast on the internal drive, then copy once.

---

## Step 1 — Make the base folder

On your PC's internal drive, somewhere simple:

```
C:\VARLER
```

Not inside Documents, not inside OneDrive, not on the Desktop. A plain folder at
the root of C:. Those other locations get synced or redirected by Windows and
will confuse things later.

> **Why not straight onto the stick?** Speed. See the note above. The folder is
> identical either way — at the end you copy it across and it works the same.

---

## Step 2 — Create the folder tree

Put **`make-folders.cmd`** inside `C:\VARLER` and double-click it.

It creates every folder you need and prints what it made. Safe to run twice; it
never deletes anything.

When it finishes you should have this:

```
C:\VARLER\
   apps\        node\  opera-gx\  vscode\  git\  7zip\
   projects\    varler-planner\  (with src, dist, tests, docs, tools, mobile)
   data\        projects\  backgrounds\  exports\
   scripts\
```

**Check:** open `C:\VARLER` in Explorer. Four folders. If you only see one or two,
the script didn't run — right-click it and choose *Run as administrator*.

---

## Step 3 — Node.js (portable)

1. Go to **nodejs.org**, Downloads page
2. Pick the **LTS** version, Windows, **Binary ZIP** for x64
   — the file is named like `node-v22.x.x-win-x64.zip`
   — **not** the `.msi` installer
3. Open the ZIP. Inside is a single folder, also called `node-v22.x.x-win-x64`
4. Open that folder. You should see `node.exe`, `npm.cmd`, `npx.cmd` and a
   `node_modules` folder
5. Copy **the contents** — not the folder itself — into `C:\VARLER\apps\node\`

**Check:** `C:\VARLER\apps\node\node.exe` must exist. If your path is
`apps\node\node-v22.x.x-win-x64\node.exe`, you copied one level too high — move
the contents up one.

> **Why the ZIP?** It touches nothing on the computer: no registry, no PATH
> changes, no admin rights. That's the whole point of portable.

---

## Step 4 — Opera GX (standalone)

1. Go to **opera.com/download**, expand the **Opera GX** section, and download
   the **offline installer** (not the small online one)
2. Run it. **Do not click Install yet.**
3. Click **Options** (bottom of the window)
4. Set **Install for** → **Standalone / USB**
5. Set **Install path** → `C:\VARLER\apps\opera-gx`
6. Now install

**Check:** `C:\VARLER\apps\opera-gx\launcher.exe` exists.

> Two known limits of standalone Opera, neither of which affects the planner:
> it can't be set as Windows' default browser, and certificates come from
> Windows rather than travelling with you.

**Don't use the PortableApps version** — it isn't an official Opera release.

---

## Step 5 — VS Code (portable)

1. Go to **code.visualstudio.com/download**
2. Choose the **.zip** for Windows x64 — **not** the "User Installer"
3. Extract the contents into `C:\VARLER\apps\vscode\`
4. Make sure there is an **empty folder named exactly `data`** next to `Code.exe`
   (`make-folders.cmd` already created it — just confirm it's there)

**Check:** `C:\VARLER\apps\vscode\Code.exe` and `C:\VARLER\apps\vscode\data\` both exist.

> **The `data` folder is the whole trick.** With it, VS Code stores settings and
> extensions inside itself. Without it, it writes into the host PC's user profile
> — and your setup doesn't travel.

---

## Step 6 — Git (portable)

1. Go to **git-scm.com/download/win**
2. Download **64-bit Git for Windows Portable** (the "thumbdrive edition")
3. It's a self-extracting `.7z.exe`. Run it and point it at `C:\VARLER\apps\git`

**Check:** `C:\VARLER\apps\git\cmd\git.exe` exists.

Optional but handy: 7-Zip portable into `apps\7zip\`.

---

## Step 7 — Put the code files in place

Copy your existing planner project into `C:\VARLER\projects\varler-planner\`:
`src\`, `build.js`, `package.json`, `tests\`, `docs\`.

Then place the new files:

| File | Goes into |
|---|---|
| `11b-backup.js` | `projects\varler-planner\src\` |
| `manifest.js` | `projects\varler-planner\tools\` |
| `phone-relay-server.js` | `projects\varler-planner\tools\` |
| `phone-sender.html` | `projects\varler-planner\mobile\` |
| `07b-phone-camera.js` | `projects\varler-planner\src\` |
| `backup-smoke.js` | `projects\varler-planner\tests\` |
| `START.cmd` | `C:\VARLER\` (the root) |
| `README.md` | `C:\VARLER\` (the root) |
| `SETUP.md` (this file) | `C:\VARLER\` (the root) |
| `_env.cmd` `planner.cmd` `build.cmd` `test.cmd` `gyro.cmd` `shell.cmd` `manifest.cmd` | `C:\VARLER\scripts\` |

**The rule behind that table**, for every file you add from now on:

- Ends up inside the built HTML → `src\`
- Runs on your PC outside the browser → `tools\`
- Runs on your phone or someone else's device → `mobile\`
- Made by `build.js` → `dist\`, and you never edit it by hand

---

## Step 8 — Check for name collisions

Before building, make sure the new module's name doesn't clash with anything.
Open `C:\VARLER\scripts\shell.cmd` (double-click it) and type:

```
findstr /s /n "VBACKUP" src\*.js
```

You should see hits **only** in `src\11b-backup.js`. If another file mentions it,
tell me before building — that's exactly the kind of silent collision that caused
trouble before.

Close the window with `exit`.

---

## Step 9 — Install the dependencies

Still on the PC's internal drive (this is why we're doing it here). Open
`scripts\shell.cmd` and type:

```
npm install
```

Wait for it to finish. It creates a `node_modules` folder with a few thousand
small files in it. That's normal.

**Check:** `projects\varler-planner\node_modules\ws\` exists. The gyro relay needs
that one specifically.

---

## Step 10 — First build

Double-click `C:\VARLER\START.cmd` and press **2**.

It should print the Node version, run the build, and end with
*"Kész: dist\varler_planner.html"*.

If it prints an error instead, copy the whole message and send it to me — build
errors are usually one bad character and take a minute to fix.

Then press **3** to run the tests. Everything should pass.

---

## Step 11 — ⚠ Rescue your projects

**Do this before you start working in the new browser.**

Your saved projects — Domoszló included — live in the browser's `localStorage`,
which belongs to the **browser profile**. The standalone Opera GX you installed in
step 4 is a brand new, empty profile. It will show you an empty project list, and
that is not a bug.

So, in order:

1. Open your **old, normally installed** Opera GX — the one you use every day
2. Open the planner in it the way you always do
3. Click the new **🗄 Teljes mentés…** button (next to the project export button;
   if it isn't there it'll be floating in the bottom-right corner)
4. Click **⬇ Mentés fájlba**. A `.vbundle.json` downloads
5. Move that file into `C:\VARLER\data\projects\`
6. Now open the new portable planner: `START.cmd` → **1**
7. Click **🗄 Teljes mentés…** → the **Visszatöltés** tab
8. Choose the file, leave the mode on **Hozzáadás**, click **⬆ Visszatöltés**
9. The page reloads and your projects are there

**Check:** open Domoszló in the portable browser and confirm the drawing is
complete and current. Don't move on until you've seen it with your own eyes.

> Note: the old browser still has its copy — nothing was deleted. You now have the
> same data in two places plus a file. That's a good position to be in.

---

## Step 12 — Test everything

Work through this before you trust the stick:

- [ ] `START.cmd` → **1** opens the planner in portable Opera GX
- [ ] Domoszló opens and looks right
- [ ] You can draw something, save it, close the browser, reopen — still there
- [ ] `START.cmd` → **2** builds without errors
- [ ] `START.cmd` → **3** all tests pass
- [ ] `START.cmd` → **5** opens VS Code with the project
- [ ] `START.cmd` → **7** writes `docs\MANIFEST.md`
- [ ] `START.cmd` → **4** starts the gyro relay and prints an address like
      `http://192.168.x.x:8080`

For that last one: open the printed address on your phone, on the same WiFi.
Windows will ask whether to let `node.exe` through the firewall — say yes, and
tick **Private networks**. You need admin rights for that prompt.

---

## Step 13 — Start version control

In `scripts\shell.cmd`:

```
git init
git add .
git commit -m "1.0 portable setup"
```

First make sure `projects\varler-planner\.gitignore` contains:

```
node_modules/
.npm-cache/
*.log
```

Without that you'd commit thousands of dependency files and it becomes very hard
to undo cleanly.

> `data\` is deliberately outside the repo. Your drawings must never be tangled up
> with code history — you want to be able to delete `projects\` and re-clone it
> without losing a single plan.

---

## Step 14 — Copy to the stick

Everything works on the PC. Now:

1. Plug in the stick
2. Copy the entire `C:\VARLER` folder to the root of the stick
3. Wait. This takes a while — `node_modules` is thousands of tiny files
4. Eject properly, unplug, plug back in
5. Open the stick and run `START.cmd`
6. Repeat the step 12 checklist, from the stick this time

**Everything must work identically.** The drive letter doesn't matter — every
script figures out where it is on its own.

Keep `C:\VARLER` on the PC as your fast working copy and your first backup. When
the stick and the PC drift apart, git tells you which is which.

---

## Step 15 — OneDrive backup

Optional, but sensible.

Sync **only** `data\`, plus a copy of `dist\varler_planner.html` when you finish a
version.

Do **not** sync `apps\`, `node_modules\` or `.git\`. Thousands of small files will
make OneDrive thrash, and an interrupted sync can corrupt a git repository.

If you want the source in two places, that's what git is for — not file sync.

---

## Daily habits

- **End of a work day:** 🗄 Teljes mentés → file into `data\projects\`. It takes
  five seconds and it's the only thing standing between you and a lost afternoon.
- **After changing code:** build, then test, then look at it in the browser. In
  that order.
- **Before asking me for help:** `START.cmd` → **7**, then paste `MANIFEST.md`
  into the chat. That tells me exactly what's on the stick and what changed.

---

## When something's wrong

| What you see | What it means |
|---|---|
| "Nincs meg a dist fájl" | You haven't built yet — press **2** |
| "Nincs hordozható Node" | `apps\node\node.exe` is missing or one folder too deep (step 3) |
| "Hiányzik a 'ws' csomag" | `npm install` wasn't run, or `node_modules` didn't get copied |
| Planner opens but no projects | Wrong browser profile — that's step 11 |
| Phone can't reach the relay | Different WiFi, or the firewall blocked `node.exe` |
| Build fails with a syntax error | Send me the exact message; usually a one-line fix |
| VS Code settings don't travel | The empty `data` folder next to `Code.exe` is missing |

---

## What's still open

Two things are known-incomplete, and neither blocks anything above:

1. **The gyro camera isn't wired in yet.** All three files exist and each works on
   its own, but the planner module needs a small `PLANNER_CAM` adapter written
   against your real variable names. To move that forward, run in `shell.cmd`:
   ```
   findstr /s /n /i /c:"pitch" /c:"yaw" /c:"zoom" src\*.js
   ```
   and send me the output plus the files it points at.

2. **`backup-smoke.js` isn't in your test runner yet.** It runs on its own with
   `node tests\backup-smoke.js`. Send me the top of any existing spec file and
   I'll convert it into a proper `spec-20-backup.js`.
