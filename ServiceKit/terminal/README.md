# ServiceKit Terminál

Hordozható Claude Code indító a ServiceKitben. Bármely Windows 10/11 gépen megnézi, van-e Claude Code, felajánlja a
mappákat, ahol ezen a gépen Claude munkamenet futott (vagy egy elkülönített munkaterületet a kiten belül), és **csak
akkor enged bejelentkezni, ha a tulajdonos a telefonján jóváhagyja**. Minden hozzáférés egy privát GitHub repóba kerül
naplóként, ahonnan a tulajdonos le is tilthatja azt.

*A portable Claude Code launcher inside ServiceKit. On any Windows 10/11 PC it finds Claude Code, offers the folders
where Claude sessions ran on that PC (or an isolated workspace inside the kit), and lets sign-in happen **only after the
owner approves on their phone**. Every access is logged to a private GitHub repo, from which the owner can also deny it.*

## Indítás

1. Másold a `terminal\profile.example.json` fájlt `terminal\profile.json` néven, és írd be a GitHub felhasználónevedet.
   Jelszó, token vagy süti **soha** nem kerül bele.
2. Futtasd a **TERMINAL.cmd**-t (vagy az Irányítópult *Terminál* oldalán: *Claude indítása*).
3. **1** Claude indítása → mappa → feladatnév (külön munkafa) → a figyelmeztetés elfogadása → a gép kiír egy kódot:
   a **telefonodon** nyisd meg a `github.com/login/device` oldalt, írd be, hagyd jóvá. Utána a Claude saját
   bejelentkezése: a kiírt címet szintén a telefonon nyisd meg, és a kódot írd vissza a gépen.

*Start: copy `profile.example.json` to `profile.json` and enter your GitHub name (never a password or token). Run
TERMINAL.cmd, press 1, pick a folder and a task name, accept the notice, then approve the code at
github.com/login/device on your phone, and do Claude's own sign-in the same way.*

## Mi kerül a naplóba / What is logged

Indításkor egy issue a `<tulajdonos>/vrg-access-log` (privát) repóban: időpont (UTC és helyi, időzóna), gépnév,
Windows felhasználó, kiadás és build, helyi IPv4 címek, a kit helye, a választott mappa, ideiglenes vagy megbízható
gép, a kit verziója. A nyilvános IP csak akkor, ha a profilban bekapcsolod (`publicIp`), mert ahhoz egy külső
szolgáltatást kell megkérdezni. Munka közben legfeljebb 30 percenként és a végén rövid összefoglaló: repó, ág,
munkafa, commitok, a változások összesítése, a nem commitolt fájlok száma. **A beírt szöveg és a fájlok tartalma soha.**
Mindezt a gép előtt ülő ember a bejelentkezés előtt egy figyelmeztetésben látja.

*An issue in the private log repo with time, computer, Windows user, OS, local IPv4, kit path, folder, mode and
version; public IP only if enabled. Briefs at most every 30 minutes and at the end: repo, branch, worktree, commits,
diff summary, uncommitted count. Never prompt text, never file contents. The person at the PC sees all of this in a
notice before anything is sent.*

## Letiltás / Deny

A telefonon (GitHub Mobile) a bejegyzésre tegyél `deny` címkét, vagy írd megjegyzésben: `/deny`. Csak a tulajdonos
megjegyzése számít. A Terminál percenként nézi: leállítja a Claude-ot, törli a belépési adatokat, kijelentkezteti a
gh-t, megjegyzést ír („logged out at …”) és lezárja a bejegyzést.

**Ez együttműködő vészkapcsoló.** Egy rosszindulatú gép figyelmen kívül hagyhatja. Valódi visszavonás:

- **GitHub:** github.com → Settings → Applications → *Authorized OAuth Apps* → **GitHub CLI** → *Revoke*.
  (Ez minden gépen visszavonja a gh belépést.)
- **Fontos:** a kilépéskori `gh auth logout` a gépről törli a tokent, de a GitHubon **nem vonja vissza**. Letiltás
  után (és időnként) vond vissza a fenti *GitHub CLI* engedélyt. A Claude ugyanazzal a Windows felhasználóval fut,
  ezért egy rosszindulatú munkamenet elérheti a tokent a lemezen.
- **Claude:** a claude.ai fiókban jelentkeztesd ki a munkameneteket (Settings → a fiók biztonsági / munkamenet
  beállításai), vagy változtasd meg a jelszót.

*Note: `gh auth logout` removes the token from the PC but does not revoke it on GitHub; revoke the GitHub CLI app after a deny. Claude runs as the same Windows user, so a hostile session could read the token on disk.*

*Deny: label the issue `deny` or comment `/deny` (owner only). The launcher stops Claude, wipes, logs out, comments and
closes the issue. This is a cooperative kill switch: a hostile PC can ignore it. To revoke for real, revoke the
**GitHub CLI** OAuth app under GitHub → Settings → Applications, and sign out your Claude sessions in your claude.ai
account settings (or change the password).*

## Ideiglenes és megbízható gép / Ephemeral and trusted

Alapból minden gép **ideiglenes**: kilépéskor (és ha az ablakot bezárták, a következő indításkor) törlődik a
`data\claude\.credentials.json` és a `data\gh`. A menü **T** gombjával a gép **megbízhatónak** jelölhető: akkor a belépés
megmarad, de **ezen a gépen** (`%LOCALAPPDATA%\ServiceKitTerminal`), nem a pendrive-on — így egy elveszett pendrive-on
nincs működő belépés. A napló rögzíti, ha a gép megbízható.

*Every PC is ephemeral by default: credentials are wiped on exit, or at the next start after a closed window. **T**
marks a PC trusted: the sign-in is then kept on that PC (`%LOCALAPPDATA%\ServiceKitTerminal`), never on the stick.*

## A menü / The menu

| | |
|---|---|
| 1 | Claude indítása (mappa, munkafa, telefonos kapu) / *Start Claude* |
| 2 | Ellenőrzések T0–T4, csak olvasnak; jelentés a `reports\<idő>\` mappában / *Read-only checks with a report* |
| 3 | Telepítések: amit a kit létrehozott; mappa / fájl megnyitása, eltávolítás, teljes eltávolítás / *Installs ledger* |
| 4 | Agent Workshop: git, node, python, gh, rg, fd, jq, uv, PowerShell 7, 7-Zip, Claude Code / *Portable dev tools* |
| 5 | Windows Sandbox: eldobható Windows, a kit csak olvasható, az `exchange` írható / *Disposable Windows* |
| 6 | Kit Shell |
| T / L / Q | megbízható gép / nyelv / kilépés |

## Biztonsági szabályok / Security rules

- Hitelesítő adat soha nem kerül a repóba, zip-be vagy a profilba. *No credential in the repo, a zip or the profile.*
- A bejelentkezés mindig a hivatalos folyamattal (GitHub device flow, Claude `/login`) és a telefonon jóváhagyva
  történik; a kit nem olvassa és nem másolja a gép saját `~/.claude/.credentials.json` fájlját.
- A géphez tartozó végrehajtási házirendet a kit nem változtatja (a `-ExecutionPolicy Bypass` csak a saját folyamatára vonatkozik).
- Letöltés csak a katalógusból: hivatalos forrás, rögzített verzió, SHA-256 ellenőrzés, méret kiírva. Rendszergazdai
  vagy Windows-funkciót kapcsoló lépést a kit csak parancsként mutat meg.
- Eltávolítani csak azt lehet, amit a napló rögzített, a kiten belül.

Fejlesztői anyag: `PLAN.md`, `DECISIONS.md`, `TESTING.md`, `vm\DESIGN-VM-V2.md`.
