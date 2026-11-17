# VM v2 — an installed, kept VM (design only)

*v1 is Windows Sandbox (`wsb.ps1`): disposable, nothing kept, Pro/Enterprise/Education only. v2 is a VM that is kept
between uses, has checkpoints, and also covers Home editions. Nothing below is built yet.*

## When v2 is worth it

- Work that must survive a reboot: a dev box, a long build, a configured test client.
- Home editions (no Sandbox, no Hyper-V).
- An OS other than the host's own Windows build (Linux, an older Windows with the user's own media and licence).

## Engines

| | Hyper-V (Pro / Enterprise / Education) | VirtualBox (Home fallback, any edition) |
|---|---|---|
| Install | Windows feature `Microsoft-Hyper-V-All`, admin + reboot | the official installer (catalog `virtualbox`, manual), admin |
| Disk | VHDX in `<kit>\vm\<name>\disk.vhdx` or, on a slow stick, `%LOCALAPPDATA%\ServiceKitVM\<name>` | VDI in the same places |
| Snapshots | checkpoints (`Checkpoint-VM`, `Restore-VMCheckpoint`) | `VBoxManage snapshot` |
| Network | an **internal** switch by default (host <-> VM only); external switch only on request | host-only adapter by default; NAT on request |
| Coexistence | Hyper-V running makes VirtualBox use the slower WHPX path; T4 reports both | |

The T4 check already gathers what the choice needs: firmware virtualization, hypervisor present, Hyper-V / VM Platform
state, edition, free RAM and disk.

## What the kit would automate (no admin)

1. Pick the engine from T4 (Hyper-V if enabled, else VirtualBox if installed, else explain both).
2. Create the VM from a **template** in `vm\templates\*.json` (name, OS, RAM, CPU, disk size, ISO or VHDX source with
   SHA-256, network mode). Downloads go through the catalog rules: official source, pinned version, checksum, size shown.
3. Map the kit like v1: tools / core / terminal read-only, `exchange` read-write (Hyper-V: SMB share or Enhanced Session
   folder redirection; VirtualBox: shared folders). `data\` is never shared.
4. Checkpoint "clean" right after the first boot; a **Reset** button restores it.
5. Ledger rows for every VM (kind `vm`, paths = its folder, uninstall = the engine's delete command), so Installs and
   Full uninstall cover it.

## What needs admin (shown as commands, run by the user)

- Enabling Hyper-V: `Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -All` + reboot.
- Creating a Hyper-V VM or switch: the user must be in the local **Hyper-V Administrators** group (adding them is one
  admin command: `Add-LocalGroupMember -Group 'Hyper-V Administrators' -Member $env:USERNAME`, then sign out and in).
- Installing VirtualBox (its installer asks for UAC itself).

## Open questions

- VM disks on a USB stick are slow and wear it out; default to `%LOCALAPPDATA%` and keep only templates on the stick?
- Windows guests need the user's own licence; the kit must never fetch Windows media from unofficial places.
- Should a VM session also go through the phone gate (access issue + deny), or only Claude sessions inside it?
