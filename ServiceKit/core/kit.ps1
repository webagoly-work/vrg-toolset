# ServiceKit shared library. Dot-source it:  . (Join-Path $CoreDir 'kit.ps1')
# Written for Windows PowerShell 2.0+ (Windows 7) and also runs on PowerShell 7.
# Rules kept for PS2: no ConvertTo/From-Json, no [ordered], no -in, no Invoke-WebRequest,
# no Expand-Archive, no $PSScriptRoot outside modules, no .Where()/.ForEach().

$ErrorActionPreference = 'Stop'

if (-not $CoreDir) { $CoreDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$KitRoot   = Split-Path -Parent $CoreDir
$ToolsDir  = Join-Path $KitRoot 'tools'
$StateDir  = Join-Path $KitRoot 'state'
$LogsDir   = Join-Path $KitRoot 'logs'
$DataDir   = Join-Path $KitRoot 'data'
$InboxDir  = Join-Path $ToolsDir '_inbox'
$BinDir    = Join-Path $CoreDir 'bin'
$KitUA     = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ServiceKit/1.0'

foreach ($d in @($ToolsDir, $StateDir, $LogsDir, $DataDir, $InboxDir, $BinDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

# ---------------------------------------------------------------- JSON (PS2-safe)
$script:Jss = $null
try {
    Add-Type -AssemblyName System.Web.Extensions -ErrorAction Stop
    $script:Jss = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $script:Jss.MaxJsonLength = [int]::MaxValue
    $script:Jss.RecursionLimit = 200
} catch { $script:Jss = $null }

function ConvertFrom-KitJson([string]$Text) {
    if ($script:Jss) { return ,$script:Jss.DeserializeObject($Text) }
    return ,(ConvertFrom-Json -InputObject $Text -AsHashtable)
}

function ConvertTo-KitJson($Object) {
    if ($script:Jss) { return $script:Jss.Serialize($Object) }
    return (ConvertTo-Json -InputObject $Object -Depth 20 -Compress)
}

function Read-KitText([string]$Path) {
    return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Write-KitText([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    $tmp = $Path + '.tmp'
    [System.IO.File]::WriteAllText($tmp, $Text, $enc)
    if (Test-Path $Path) { Remove-Item $Path -Force }
    Move-Item $tmp $Path -Force
}

function Read-KitJson([string]$Path, $Default) {
    if (-not (Test-Path $Path)) { return $Default }
    try { return ConvertFrom-KitJson (Read-KitText $Path) } catch { return $Default }
}

function Write-KitJson([string]$Path, $Object) {
    for ($i = 0; $i -lt 5; $i++) {
        try { Write-KitText $Path (ConvertTo-KitJson $Object); return } catch { Start-Sleep -Milliseconds 80 }
    }
}

function Get-Key($Dict, [string]$Key, $Default) {
    if ($null -eq $Dict) { return $Default }
    if ($Dict -is [System.Collections.IDictionary]) {
        if ($Dict.ContainsKey($Key) -and $null -ne $Dict[$Key]) { return $Dict[$Key] }
    }
    return $Default
}

function Get-Catalog { return ConvertFrom-KitJson (Read-KitText (Join-Path $CoreDir 'catalog.json')) }

# ---------------------------------------------------------------- System facts
function Get-KitOS {
    $v = [Environment]::OSVersion.Version
    $isWin = ([Environment]::OSVersion.Platform -eq 'Win32NT')
    $legacy = $isWin -and ($v.Major -eq 6)          # 6.1 = Win7, 6.2 = Win8, 6.3 = Win8.1
    $is64 = ([IntPtr]::Size -eq 8) -or ($env:PROCESSOR_ARCHITEW6432 -ne $null)
    $admin = $false
    if ($isWin) {
        try {
            $id = [Security.Principal.WindowsIdentity]::GetCurrent()
            $admin = (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        } catch { }
    }
    $name = 'Windows ' + $v.ToString()
    if ($isWin) {
        try { $name = (Get-WmiObject Win32_OperatingSystem -ErrorAction Stop).Caption } catch { }
    } else { $name = [Environment]::OSVersion.VersionString }
    return @{ version = $v.ToString(); major = $v.Major; minor = $v.Minor; build = $v.Build; legacy = $legacy;
              is64 = $is64; admin = $admin; windows = $isWin; name = "$name"; ps = $PSVersionTable.PSVersion.ToString() }
}

# ---------------------------------------------------------------- Logging
$script:LogFile = Join-Path $LogsDir ('kit-' + (Get-Date -Format 'yyyyMMdd') + '.log')
function Write-KitLog([string]$Msg, [string]$Level = 'INFO') {
    $line = (Get-Date -Format 'HH:mm:ss') + ' [' + $Level + '] ' + $Msg
    try { Add-Content -Path $script:LogFile -Value $line -Encoding UTF8 } catch { }
    return $line
}

# ---------------------------------------------------------------- Networking
function Set-KitTls {
    # 3072 = TLS 1.2, 768 = TLS 1.1, 192 = TLS 1.0. Numeric so it works on old .NET too.
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType] (3072 -bor 768 -bor 192) ; return $true }
    catch { try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType] 3072; return $true } catch { return $false } }
}
$script:TlsOk = Set-KitTls

function Get-CurlExe {
    if (-not $env:SystemRoot) { return $null }
    $c = Join-Path $env:SystemRoot 'System32\curl.exe'
    if (Test-Path $c) { return $c }
    return $null
}

function Get-KitWebString([string]$Url, [string]$UA = $KitUA) {
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add('User-Agent', $UA)
        $wc.Encoding = [System.Text.Encoding]::UTF8
        return $wc.DownloadString($Url)
    } catch {
        $err = $_.Exception.Message
        $curl = Get-CurlExe
        if ($curl) {
            $out = & $curl -sSL -A $UA $Url 2>$null
            if ($LASTEXITCODE -eq 0 -and $out) { return ($out -join "`n") }
        }
        throw "Web request failed: $Url ($err)"
    }
}

# Streams a URL to a file and calls $OnProgress with (bytesDone, bytesTotal).
function Invoke-KitDownload([string]$Url, [string]$OutFile, [scriptblock]$OnProgress, [string]$UA = $KitUA) {
    $tmp = $OutFile + '.part'
    if (Test-Path $tmp) { Remove-Item $tmp -Force }
    $ok = $false; $err = ''
    try {
        $req = [System.Net.HttpWebRequest]::Create($Url)
        $req.UserAgent = $UA
        $req.AllowAutoRedirect = $true
        $req.MaximumAutomaticRedirections = 20
        $req.Timeout = 60000
        $req.ReadWriteTimeout = 120000
        $resp = $req.GetResponse()
        $total = $resp.ContentLength
        $in = $resp.GetResponseStream()
        $fs = New-Object System.IO.FileStream($tmp, [System.IO.FileMode]::Create)
        $buf = New-Object byte[] 262144
        $done = 0; $last = [DateTime]::MinValue
        try {
            while (($n = $in.Read($buf, 0, $buf.Length)) -gt 0) {
                $fs.Write($buf, 0, $n); $done += $n
                if ($OnProgress -and (([DateTime]::Now - $last).TotalMilliseconds -gt 250)) {
                    & $OnProgress $done $total; $last = [DateTime]::Now
                }
            }
        } finally { $fs.Close(); $in.Close(); $resp.Close() }
        if ($OnProgress) { & $OnProgress $done $total }
        $ok = $true
    } catch { $err = $_.Exception.Message }

    if (-not $ok) {
        $curl = Get-CurlExe
        if ($curl) {
            Write-KitLog "WebClient failed ($err), retrying with curl: $Url" 'WARN' | Out-Null
            & $curl -sSL -A $UA -o $tmp $Url 2>$null
            if ($LASTEXITCODE -eq 0 -and (Test-Path $tmp)) { $ok = $true }
        }
    }
    if (-not $ok -and $env:SystemRoot -and (Test-Path (Join-Path $env:SystemRoot 'System32\bitsadmin.exe'))) {
        Write-KitLog "Retrying with BITS: $Url" 'WARN' | Out-Null
        & bitsadmin.exe /transfer ServiceKit /download /priority foreground $Url $tmp 2>&1 | Out-Null
        if (Test-Path $tmp) { $ok = $true }
    }
    if (-not $ok) { throw "Download failed: $err" }

    # Reject HTML pages masquerading as downloads (mirror pickers, login walls).
    $head = New-Object byte[] 512
    $fs2 = [System.IO.File]::OpenRead($tmp)
    try { $read = $fs2.Read($head, 0, 512) } finally { $fs2.Close() }
    $txt = [System.Text.Encoding]::ASCII.GetString($head, 0, $read).TrimStart().ToLower()
    $isArchiveExpected = ($OutFile -match '\.(zip|7z|exe|msi|iso)$')
    if ($isArchiveExpected -and ($txt.StartsWith('<!doctype html') -or $txt.StartsWith('<html') -or $txt.StartsWith('<?xml'))) {
        Remove-Item $tmp -Force
        throw 'The server returned a web page instead of the file (download page changed or needs a click).'
    }
    if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
    Move-Item $tmp $OutFile -Force
}

# ---------------------------------------------------------------- Source resolution
function Resolve-RelativeUrl([string]$Found, [string]$Base) {
    if ($Found -match '^https?://') { return $Found }
    if ($Found.StartsWith('//')) { return 'https:' + $Found }
    $u = New-Object System.Uri((New-Object System.Uri($Base)), $Found)
    return $u.AbsoluteUri
}

function Resolve-GitHubAsset([string]$Repo, [string]$Pattern) {
    $api = "https://api.github.com/repos/$Repo/releases/latest"
    try {
        $rel = ConvertFrom-KitJson (Get-KitWebString $api)
        foreach ($a in @($rel['assets'])) {
            if ($a['name'] -match $Pattern) { return @{ url = $a['browser_download_url']; file = $a['name']; version = $rel['tag_name'] } }
        }
    } catch { Write-KitLog "GitHub API unavailable for $Repo, using release page" 'WARN' | Out-Null }
    # Fallback without the API (rate limit): read the release page's asset list.
    $tag = $null
    try {
        $req = [System.Net.HttpWebRequest]::Create("https://github.com/$Repo/releases/latest")
        $req.UserAgent = $KitUA; $req.AllowAutoRedirect = $false
        $resp = $req.GetResponse(); $loc = $resp.Headers['Location']; $resp.Close()
        if ($loc) { $tag = $loc.Substring($loc.LastIndexOf('/') + 1) }
    } catch {
        $r = $_.Exception.InnerException
        if ($r -and $r.Response) { $loc = $r.Response.Headers['Location']; if ($loc) { $tag = $loc.Substring($loc.LastIndexOf('/') + 1) } }
    }
    if ($tag) {
        $html = Get-KitWebString "https://github.com/$Repo/releases/expanded_assets/$tag"
        foreach ($m in [regex]::Matches($html, 'href="(/[^"]+/releases/download/[^"]+)"')) {
            $path = $m.Groups[1].Value
            $name = [System.Uri]::UnescapeDataString($path.Substring($path.LastIndexOf('/') + 1))
            if ($name -match $Pattern) { return @{ url = 'https://github.com' + $path; file = $name; version = $tag } }
        }
    }
    throw "No release asset matching '$Pattern' in $Repo"
}

function Resolve-KitSource($Src) {
    $type = Get-Key $Src 'type' 'url'
    $fileOverride = Get-Key $Src 'file' $null
    $r = $null
    switch ($type) {
        'url' {
            $u = $Src['url']
            $f = $fileOverride
            if (-not $f) { $f = [System.Uri]::UnescapeDataString(((New-Object System.Uri($u)).AbsolutePath -split '/')[-1]) }
            $r = @{ url = $u; file = $f; version = '' }
        }
        'github' { $r = Resolve-GitHubAsset $Src['repo'] $Src['asset'] }
        'scrape' {
            $page = $Src['page']
            $html = Get-KitWebString $page
            $m = [regex]::Match($html, $Src['regex'])
            if (-not $m.Success) { throw "Download link not found on $page" }
            $tpl = Get-Key $Src 'url' $null
            if ($tpl) {
                $u = $tpl.Replace('{0}', $m.Value)
                for ($g = 1; $g -lt $m.Groups.Count; $g++) { $u = $u.Replace('{' + $g + '}', $m.Groups[$g].Value) }
            } else {
                $u = Resolve-RelativeUrl $m.Value (Get-Key $Src 'base' $page)
            }
            $f = [System.Uri]::UnescapeDataString(((New-Object System.Uri($u)).AbsolutePath -split '/')[-1])
            $r = @{ url = $u; file = $f; version = '' }
        }
        'sfrss' {
            $p = $Src['project']
            $rssPath = Get-Key $Src 'path' '/'
            $rss = Get-KitWebString ("https://sourceforge.net/projects/$p/rss?path=" + $rssPath)
            foreach ($m in [regex]::Matches($rss, '<link>(https://sourceforge\.net/projects/[^<]+?/download)</link>')) {
                $link = $m.Groups[1].Value
                $name = [System.Uri]::UnescapeDataString(($link -replace '/download$', '').Split('/')[-1])
                if ($name -match $Src['regex']) {
                    $r = @{ url = $link; file = $name; version = ''; ua = 'Wget/1.21.4' }
                    break
                }
            }
            if (-not $r) { throw "No file matching '$($Src['regex'])' in SourceForge project $p" }
        }
        'manual' { throw 'MANUAL' }
        default { throw "Unknown source type $type" }
    }
    if ($fileOverride) { $r['file'] = $fileOverride }
    return $r
}

# ---------------------------------------------------------------- Archives
function Get-SevenZa {
    $p = Join-Path $BinDir '7za.exe'
    if (Test-Path $p) { return $p }
    return $null
}

function Expand-KitArchive([string]$File, [string]$Dest) {
    if (-not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest -Force | Out-Null }
    $sz = Get-SevenZa
    if ($sz) {
        $out = & $sz x $File ("-o" + $Dest) -y -bso0 -bsp0 2>&1
        if ($LASTEXITCODE -gt 1) { throw "7-Zip could not extract $([IO.Path]::GetFileName($File)): $out" }
        return
    }
    if ($File -notmatch '\.zip$') { throw '7-Zip is missing, only .zip files can be extracted.' }
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop
        [System.IO.Compression.ZipFile]::ExtractToDirectory($File, $Dest)
        return
    } catch { }
    $shell = New-Object -ComObject Shell.Application
    $zip = $shell.NameSpace($File); $dst = $shell.NameSpace($Dest)
    if (-not $zip -or -not $dst) { throw 'Windows could not open the zip file.' }
    $dst.CopyHere($zip.Items(), 0x14)   # 0x4 no progress UI, 0x10 yes to all
}

# ---------------------------------------------------------------- Finding programs
$script:ExeCache = @{}
function Find-KitExe([string]$PkgId, $App, [bool]$Is64 = $true) {
    $dir = Join-Path $ToolsDir $PkgId
    $patterns = @()
    $e64 = Get-Key $App 'exe' $null; $e32 = Get-Key $App 'exe32' $null
    if ($Is64) { if ($e64) { $patterns += $e64 }; if ($e32) { $patterns += $e32 } }
    else       { if ($e32) { $patterns += $e32 }; if ($e64) { $patterns += $e64 } }
    $inst = Get-Key $App 'installed' $null
    if ($inst) {
        $ip = [Environment]::ExpandEnvironmentVariables($inst)
        if (Test-Path $ip) { return $ip }
    }
    if (-not (Test-Path $dir)) { return $null }
    foreach ($pat in $patterns) {
        $key = "$PkgId|$pat"
        if ($script:ExeCache.ContainsKey($key) -and (Test-Path $script:ExeCache[$key])) { return $script:ExeCache[$key] }
        # Shallow first (most tools sit at the top after flattening), then the whole tree.
        $hits = @(Get-ChildItem -Path $dir -Filter $pat -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer })
        if ($hits.Count -eq 0) { $hits = @(Get-ChildItem -Path $dir -Recurse -Filter $pat -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer }) }
        if ($hits.Count -gt 0) {
            $best = $hits | Sort-Object { @($_.FullName -split '[\\/]').Count }, FullName | Select-Object -First 1
            $script:ExeCache[$key] = $best.FullName
            return $best.FullName
        }
    }
    return $null
}

function Get-Installed { return (Read-KitJson (Join-Path $StateDir 'installed.json') @{}) }

# ---------------------------------------------------------------- Integrity
function Get-KitHash([string]$Path) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $fs = [System.IO.File]::OpenRead($Path)
    try { $h = $sha.ComputeHash($fs) } finally { $fs.Close() }
    return ([BitConverter]::ToString($h) -replace '-', '').ToLower()
}

function Get-KitSigner([string]$Path) {
    try {
        $sig = Get-AuthenticodeSignature -FilePath $Path -ErrorAction Stop
        $who = ''
        if ($sig.SignerCertificate) {
            $m = [regex]::Match($sig.SignerCertificate.Subject, 'CN=("[^"]+"|[^,]+)')
            if ($m.Success) { $who = $m.Groups[1].Value.Trim('"') }
        }
        return @{ status = [string]$sig.Status; signer = [string]$who }
    } catch { return @{ status = 'Unknown'; signer = '' } }
}

# Records SHA256 + signature of every program the catalog knows in a package (trust on first use).
function Update-KitHashes([string]$PkgId) {
    $cat = Get-Catalog
    $file = Join-Path $StateDir 'hashes.json'
    $all = Read-KitJson $file @{}
    $os = Get-KitOS
    foreach ($p in @($cat['packages'])) {
        if ($PkgId -and $p['id'] -ne $PkgId) { continue }
        foreach ($a in @($p['apps'])) {
            $exe = Find-KitExe $p['id'] $a ([bool]$os['is64'])
            if (-not $exe -or -not $exe.ToLower().StartsWith($ToolsDir.ToLower())) { continue }
            try {
                $sg = Get-KitSigner $exe
                $all[$a['id']] = @{ path = [string]$exe.Substring($ToolsDir.Length).TrimStart('\', '/'); sha256 = [string](Get-KitHash $exe);
                                    size = [double](Get-Item -LiteralPath $exe).Length; signer = $sg['signer']; sigStatus = $sg['status'];
                                    pkg = [string]$p['id']; date = (Get-Date).ToString('s') }
            } catch { }
        }
    }
    Write-KitJson $file $all
}

function Get-PsExe {
    try { return [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName } catch { return 'powershell.exe' }
}

function ConvertTo-HtmlText($s) {
    if ($null -eq $s) { return '' }
    return ([string]$s).Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
}

function Get-KitSlug([string]$s) {
    $map = @{ 'á'='a';'é'='e';'í'='i';'ó'='o';'ö'='o';'ő'='o';'ú'='u';'ü'='u';'ű'='u' }
    $o = ''
    foreach ($ch in $s.ToLower().ToCharArray()) { $c = [string]$ch; if ($map.ContainsKey($c)) { $o += $map[$c] } else { $o += $c } }
    $o = [regex]::Replace($o, '[^a-z0-9]+', '-').Trim('-')
    if (-not $o) { $o = 'ugyfel' }
    if ($o.Length -gt 40) { $o = $o.Substring(0, 40) }
    return $o
}
