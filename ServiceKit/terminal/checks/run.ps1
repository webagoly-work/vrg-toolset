# Runs the chosen tier checks and writes <kit>\reports\<time>\T?.json, recommendations.json and report.html.
# Dot-source after lib.ps1 and detect.ps1. Every check is read-only. PowerShell 5.1, ASCII only.
$script:TermChecksDir = Join-Path $TermDir 'checks'
foreach ($f in @('common.ps1', 'T0.ps1', 'T1.ps1', 'T2.ps1', 'T3.ps1', 'T4.ps1')) { . (Join-Path $script:TermChecksDir $f) }

function Invoke-TermTierChecks([string[]]$Tiers) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $dir = Join-Path $TermReportsDir $stamp
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $results = @()
    foreach ($t in $Tiers) {
        $fn = 'Invoke-TermCheck' + $t
        if (-not (Get-Command $fn -CommandType Function -ErrorAction SilentlyContinue)) { continue }
        Write-Term ('  ' + $t + ' ...') 'DarkGray'
        $r = $null
        try { $r = & $fn } catch { $r = @{ tier = $t; items = @((New-TermItem 'error' $_.Exception.Message 'bad')) } }
        foreach ($it in @($r['items'])) { $it['label'] = Get-TermItemLabel $it['id'] }
        $results += ,$r
        Write-KitJson (Join-Path $dir ($t + '.json')) $r
    }
    $ledger = @()
    if (Get-Command Read-TermLedger -CommandType Function -ErrorAction SilentlyContinue) { $ledger = @(Read-TermLedger (Get-TermLedgerPath)) }
    $rec = @(Get-TermRecommendations $results (Get-Catalog) (Get-Installed) $ledger $KitRoot)
    Write-KitJson (Join-Path $dir 'recommendations.json') $rec
    $html = Join-Path $dir 'report.html'
    Write-KitText $html (Format-TermReportHtml $results $rec $stamp)
    return @{ results = $results; recommendations = $rec; html = $html; dir = $dir }
}

function Get-TermItemLabel([string]$Id) { return (TT ('chk_' + $Id)) }

function Format-TermReportHtml($Results, $Rec, [string]$Stamp) {
    $t = Get-TermTextTable
    $hu = $t['hu']; $en = $t['en']
    $h = @('<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>ServiceKit Terminal</title><style>body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#1b1f24;background:#fff}',
        'h1{font-size:20px}h2{font-size:16px;margin-top:22px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:5px 8px;text-align:left;vertical-align:top}',
        '.en{color:#667;font-style:italic;font-size:12px}.ok{color:#17803d}.warn{color:#a15c00}.bad{color:#b42318}.missing{color:#a15c00}.info{color:#445}',
        '@media (prefers-color-scheme:dark){body{background:#15181c;color:#e6e8eb}td,th{border-color:#333}.en{color:#99a}}</style></head><body>',
        ('<h1>ServiceKit Terminal &ndash; ' + (ConvertTo-HtmlText ([Environment]::MachineName)) + ' &ndash; ' + (ConvertTo-HtmlText $Stamp) + '</h1>'))
    foreach ($r in $Results) {
        $k = 'tier_' + $r['tier']
        $h += ('<h2>' + $r['tier'] + ' ' + (ConvertTo-HtmlText $hu[$k]) + ' <span class="en">' + (ConvertTo-HtmlText $en[$k]) + '</span></h2><table>')
        foreach ($it in @($r['items'])) {
            $lk = 'chk_' + $it['id']
            $lh = Get-Key $hu $lk $it['id']; $le = Get-Key $en $lk $it['id']
            $h += ('<tr><th>' + (ConvertTo-HtmlText $lh) + '<div class="en">' + (ConvertTo-HtmlText $le) + '</div></th><td class="' + $it['status'] + '">' +
                $it['status'] + '</td><td>' + (ConvertTo-HtmlText $it['value']) + '</td></tr>')
        }
        $h += '</table>'
    }
    $h += ('<h2>' + (ConvertTo-HtmlText $hu['recTitle']) + ' <span class="en">' + (ConvertTo-HtmlText $en['recTitle']) + '</span></h2><ul>')
    foreach ($x in @($Rec)) { $h += ('<li>' + (ConvertTo-HtmlText (Format-TermRecommendation $x)) + '</li>') }
    $h += '</ul></body></html>'
    return ($h -join "`n")
}
