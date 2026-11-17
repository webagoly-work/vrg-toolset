# T2 Claude: Claude Code version, reach api.anthropic.com and github.com, proxy, TLS interception.

# Pure: who issued the certificate a site showed us. Security products that inspect HTTPS re-sign it with their own CA,
# and Node (Claude Code) then fails unless NODE_EXTRA_CA_CERTS points at that CA.
function Test-TermTlsIntercepted([string]$Issuer) {
    if (-not $Issuer) { return @{ status = 'none'; product = '' } }
    $mitm = @('Avast', 'AVG', 'Kaspersky', 'ESET', 'Bitdefender', 'Norton', 'Fortinet', 'FortiGate', 'Zscaler', 'Sophos', 'Netskope',
        'Palo Alto', 'Umbrella', 'McAfee', 'Trend Micro', 'WebTitan', 'mitmproxy', 'Fiddler', 'Charles Proxy', 'Blue Coat', 'Forcepoint',
        'Check Point', 'Barracuda', 'Cisco', 'Untangle', 'Smoothwall', 'Lightspeed', 'GoGuardian', 'Securly', 'iboss', 'Menlo')
    foreach ($m in $mitm) { if ($Issuer -match [regex]::Escape($m)) { return @{ status = 'intercepted'; product = $m } } }
    $public = @('DigiCert', 'Sectigo', 'USERTrust', "Let's Encrypt", 'ISRG', 'Google Trust Services', 'GTS ', 'Amazon', 'GlobalSign',
        'Entrust', 'GoDaddy', 'Baltimore', 'Microsoft', 'Cloudflare', 'COMODO', 'Starfield', 'IdenTrust', 'Certum', 'Buypass', 'SSL.com',
        'QuoVadis', 'Thawte', 'GeoTrust', 'RapidSSL', 'Actalis', 'HARICA', 'SwissSign')
    foreach ($p in $public) { if ($Issuer -match [regex]::Escape($p)) { return @{ status = 'public'; product = '' } } }
    if ($Issuer -match 'O=Let''s Encrypt|CN=(R|E)\d+\b|CN=W[ER]\d\b') { return @{ status = 'public'; product = '' } }
    return @{ status = 'unknown'; product = '' }
}

# HTTPS HEAD with a time limit; returns @{ ok; code; issuer; error }.
function Test-TermHttps([string]$Url, [int]$TimeoutMs = 8000) {
    $r = @{ ok = $false; code = 0; issuer = ''; error = '' }
    $req = $null
    try {
        $req = [System.Net.HttpWebRequest]::Create($Url)
        $req.Method = 'HEAD'; $req.Timeout = $TimeoutMs; $req.AllowAutoRedirect = $false; $req.UserAgent = 'ServiceKit-Terminal'
        $resp = $req.GetResponse(); $r['code'] = [int]$resp.StatusCode; $resp.Close(); $r['ok'] = $true
    } catch [System.Net.WebException] {
        $ex = $_.Exception
        if ($ex.Response) { $r['code'] = [int]$ex.Response.StatusCode; $r['ok'] = $true; try { $ex.Response.Close() } catch { } }
        else { $r['error'] = [string]$ex.Status + ': ' + $ex.Message }
    } catch { $r['error'] = $_.Exception.Message }
    try { if ($req -and $req.ServicePoint.Certificate) { $r['issuer'] = [string]$req.ServicePoint.Certificate.Issuer } } catch { }
    return $r
}

function Invoke-TermCheckT2 {
    $it = @()
    $inst = @(Find-TermClaudeInstalls)
    $cli = @($inst | Where-Object { $_['cli'] })
    if ($cli.Count -eq 0) { $it += New-TermItem 'claude' '' 'missing' '' @{ sources = @() } }
    else {
        $txt = @($cli | ForEach-Object { $_['source'] + ' ' + $_['version'] }) -join ', '
        $it += New-TermItem 'claude' $txt 'ok' '' @{ sources = @($cli | ForEach-Object { $_['source'] }) }
    }
    $tls = $null
    foreach ($h in @(@('net_anthropic', 'https://api.anthropic.com/'), @('net_github', 'https://github.com/'))) {
        $t = Test-TermHttps $h[1]
        $st = 'ok'; $v = 'HTTP ' + $t['code']
        if (-not $t['ok']) { $st = 'bad'; $v = $t['error'] }
        $it += New-TermItem $h[0] $v $st '' @{ issuer = $t['issuer'] }
        if (-not $tls -and $t['issuer']) { $tls = Test-TermTlsIntercepted $t['issuer']; $tls['issuer'] = $t['issuer'] }
        if (-not $t['ok'] -and $t['error'] -match 'Trust|certificate') { $tls = @{ status = 'intercepted'; product = '?'; issuer = $t['issuer'] } }
    }
    $px = @()
    try {
        $sp = [System.Net.WebRequest]::GetSystemWebProxy()
        $u = New-Object Uri('https://api.anthropic.com/')
        $pu = $sp.GetProxy($u)
        if ($pu -and $pu.AbsoluteUri -ne $u.AbsoluteUri) { $px += ('system: ' + $pu.AbsoluteUri) }
    } catch { }
    foreach ($v in @('HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY')) { $e = [Environment]::GetEnvironmentVariable($v); if ($e) { $px += ($v + '=' + $e) } }
    if ($env:SystemRoot) {
        $n = Invoke-TermExe (Join-Path $env:SystemRoot 'System32\netsh.exe') @('winhttp', 'show', 'proxy') 8
        if ($n['out'] -and $n['out'] -notmatch 'Direct access|K.zvetlen') { $px += ('winhttp: ' + (($n['out'] -split "`n" | Where-Object { $_ -match 'Proxy' }) -join ' ').Trim()) }
    }
    $st = 'ok'; if ($px.Count -gt 0) { $st = 'info' }
    $pv = 'none'; if ($px.Count -gt 0) { $pv = $px -join '; ' }
    $it += New-TermItem 'proxy' $pv $st
    if (-not $tls) { $tls = @{ status = 'none'; product = ''; issuer = '' } }
    $st = 'ok'; $v = 'public CA: ' + $tls['issuer']
    if ($tls['status'] -eq 'intercepted') { $st = 'bad'; $v = 'intercepted by ' + $tls['product'] + ': ' + $tls['issuer'] }
    elseif ($tls['status'] -eq 'unknown') { $st = 'warn'; $v = 'unknown issuer: ' + $tls['issuer'] }
    elseif ($tls['status'] -eq 'none') { $st = 'warn'; $v = 'no certificate seen' }
    $it += New-TermItem 'tls' $v $st '' $tls
    return @{ tier = 'T2'; items = $it }
}
