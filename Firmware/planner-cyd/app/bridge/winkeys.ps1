# winkeys.ps1 - presses key combinations for the Planner CYD's MAKROK page (started by macros.js).
#
# Trimmed from the RL CYD's winhelper.ps1: keys only (no media, no idle).
# Reads one combination per line on stdin, e.g.  ctrl+shift+s  or  volume_mute,
# presses it into whatever window has focus, and answers each line on stdout with
# "ok <combo>" or "error <message>".
#
# Some antivirus products flag scripts that inject keys (seen with Avast on the RL pack).
# If this file is quarantined, the bridge keeps running and only the key buttons stop.

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PlCydKeys {
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static void Key(byte vk, bool up, bool extended) {
    uint f = (up ? 2u : 0u) | (extended ? 1u : 0u);
    keybd_event(vk, 0, f, UIntPtr.Zero);
  }
}
'@

$VK = @{
  ctrl = 0x11; control = 0x11; shift = 0x10; alt = 0x12; win = 0x5B; windows = 0x5B
  esc = 0x1B; escape = 0x1B; enter = 0x0D; return = 0x0D; tab = 0x09; space = 0x20; backspace = 0x08
  delete = 0x2E; del = 0x2E; insert = 0x2D; ins = 0x2D; home = 0x24; end = 0x23; pgup = 0x21; pageup = 0x21
  pgdn = 0x22; pagedown = 0x22; up = 0x26; down = 0x28; left = 0x25; right = 0x27; printscreen = 0x2C
  period = 0xBE; comma = 0xBC; minus = 0xBD; plus = 0xBB
  volume_mute = 0xAD; volume_down = 0xAE; volume_up = 0xAF
  media_next = 0xB0; media_prev = 0xB1; media_stop = 0xB2; media_play_pause = 0xB3
}
$EXTENDED = @(0x2E, 0x2D, 0x24, 0x23, 0x21, 0x22, 0x26, 0x28, 0x25, 0x27, 0x5B, 0xAD, 0xAE, 0xAF, 0xB0, 0xB1, 0xB2, 0xB3)

function Get-VK([string]$name) {
  $n = $name.Trim().ToLower()
  if ($VK.ContainsKey($n)) { return [byte]$VK[$n] }
  if ($n -match '^[a-z0-9]$') { return [byte][char]$n.ToUpper() }
  if ($n -match '^f([1-9]|1[0-9]|2[0-4])$') { return [byte](0x6F + [int]$Matches[1]) }
  return $null
}

function Send-Keys([string]$combo) {
  $codes = @()
  foreach ($part in $combo.Split('+')) {
    $vk = Get-VK $part
    if ($null -eq $vk) { return "error unknown key '$part' in '$combo'" }
    $codes += $vk
  }
  foreach ($c in $codes) { [PlCydKeys]::Key($c, $false, $EXTENDED -contains $c) }
  [array]::Reverse($codes)
  foreach ($c in $codes) { [PlCydKeys]::Key($c, $true, $EXTENDED -contains $c) }
  return "ok $combo"
}

[Console]::Out.WriteLine('ready')
[Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }   # the bridge has gone
  $line = $line.Trim()
  if (-not $line) { continue }
  [Console]::Out.WriteLine((Send-Keys $line))
  [Console]::Out.Flush()
}
