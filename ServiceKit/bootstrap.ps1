<#
  ServiceKit — one-line bootstrap.
  Pulls the ServiceKit kit from the public repo and sets it up on this PC, with no
  stick, no phone and no bridge. Run it on a client PC you service:

    irm https://raw.githubusercontent.com/webagoly-work/vrg-toolset/servicekit/ServiceKit/bootstrap.ps1 | iex

  With options (pass arguments):

    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/webagoly-work/vrg-toolset/servicekit/ServiceKit/bootstrap.ps1))) -Target 'C:\ServiceKit' -NoLaunch

  Or set env vars before the plain one-liner:  $env:SK_TARGET='D:\SK'; $env:SK_NOLAUNCH='1'

  It is a transparent, openly-run service tool: it echoes its source URL, verifies
  the download's SHA-256 against the published hash, and does nothing hidden. The
  kit carries no client/job data (example names only). Public repo, so no token.
#>
param(
  [string]$Target,
  [string]$Branch = 'servicekit',
  [switch]$NoLaunch,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$Repo   = 'webagoly-work/vrg-toolset'
$Base   = "https://raw.githubusercontent.com/$Repo/$Branch"
$ZipUrl = "$Base/ServiceKitPhone/www/kit/ServiceKit.zip"
$ShaUrl = "$ZipUrl.sha256"

if (-not $Target)   { $Target   = $env:SK_TARGET }
if (-not $Target)   { $Target   = Join-Path $env:USERPROFILE 'ServiceKit' }
if ($env:SK_NOLAUNCH -and $env:SK_NOLAUNCH -ne '0') { $NoLaunch = $true }

function Say($m)  { Write-Host "[ServiceKit] $m" }
function Warn($m) { Write-Host "[ServiceKit] WARN: $m" }
function Die($m)  { Write-Host "[ServiceKit] ERROR: $m"; throw $m }

# --- TLS 1.2 (old Windows/PS defaults to TLS 1.0, which GitHub refuses) ---
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072 } catch {}

# --- download helper (PS3+ Invoke-WebRequest, PS2 WebClient fallback) ---
function Get-Url([string]$url, [string]$outFile) {
  if (Get-Command Invoke-WebRequest -ErrorAction SilentlyContinue) {
    if ($outFile) { Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing }
    else { return (Invoke-WebRequest -Uri $url -UseBasicParsing).Content }
  } else {
    $wc = New-Object Net.WebClient
    if ($outFile) { $wc.DownloadFile($url, $outFile); return }
    else { return $wc.DownloadString($url) }
  }
}

# --- SHA-256 (PS4+ Get-FileHash, else .NET) ---
function Sha256([string]$path) {
  if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
    return (Get-FileHash -Algorithm SHA256 -Path $path).Hash.ToLower()
  }
  $fs = [IO.File]::OpenRead($path)
  try { $h = [Security.Cryptography.SHA256]::Create().ComputeHash($fs) }
  finally { $fs.Close() }
  return (($h | ForEach-Object { $_.ToString('x2') }) -join '')
}

# --- unzip (PS5 Expand-Archive, .NET 4.5 ZipFile, Shell COM fallback) ---
function Expand-Zip([string]$zip, [string]$dest) {
  if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
  if (Get-Command Expand-Archive -ErrorAction SilentlyContinue) {
    Expand-Archive -Path $zip -DestinationPath $dest -Force; return
  }
  try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zip, $dest); return
  } catch {
    $shell = New-Object -ComObject Shell.Application
    $items = $shell.NameSpace($zip).Items()
    $shell.NameSpace($dest).CopyHere($items, 0x14)  # 0x10 yes-to-all + 0x4 no progress
  }
}

Say "source : $ZipUrl"
Say "target : $Target"

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("skboot_" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$zipPath = Join-Path $tmp 'ServiceKit.zip'

try {
  Say "downloading kit..."
  Get-Url $ZipUrl $zipPath
  $bytes = (Get-Item $zipPath).Length
  if ($bytes -lt 1024) { Die "download too small ($bytes bytes) — wrong URL or branch '$Branch'?" }

  $actual = Sha256 $zipPath
  $expected = $null
  try { $expected = (Get-Url $ShaUrl $null).Trim().Split()[0].ToLower() } catch { Warn "no published SHA-256 to check against (continuing)" }
  if ($expected) {
    if ($actual -eq $expected) { Say "sha-256 : $actual  (verified)" }
    elseif ($Force)           { Warn "SHA-256 MISMATCH but -Force set. got $actual expected $expected" }
    else { Die "SHA-256 mismatch — got $actual expected $expected. Re-run with -Force to override." }
  } else { Say "sha-256 : $actual" }

  Say "extracting..."
  $stage = Join-Path $tmp 'x'
  Expand-Zip $zipPath $stage

  # the archive holds a top-level 'ServiceKit' folder — use its contents as the root
  $root = Join-Path $stage 'ServiceKit'
  if (-not (Test-Path $root)) { $root = $stage }

  if ((Test-Path $Target) -and -not $Force) {
    $existing = @(Get-ChildItem -Path $Target -Force -ErrorAction SilentlyContinue)
    if ($existing.Count -gt 0) { Warn "target exists and is not empty — merging/overwriting ($Target)" }
  }
  New-Item -ItemType Directory -Path $Target -Force | Out-Null
  Copy-Item -Path (Join-Path $root '*') -Destination $Target -Recurse -Force

  Say "installed to $Target"

  $start = Join-Path $Target 'START.cmd'
  if ($NoLaunch) {
    Say "done. Launch it with:  $start"
  } elseif (Test-Path $start) {
    Say "launching dashboard..."
    Start-Process -FilePath $start -WorkingDirectory $Target
  } else {
    Warn "START.cmd not found in the kit — open $Target manually"
  }
}
finally {
  try { Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}
