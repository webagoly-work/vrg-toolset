# probe-tier0.ps1 — Tier 0 sampler for VRG Kódváros (live workspace P8, KV-18; report §1.4). A helper process of
# CodeCity/companion.js: every 2 s one JSON line on stdout — CPU %, RAM, disk %, NIC bytes/s, GPU 3D % — from the
# CIM performance classes (their names are not localised, unlike Get-Counter's). Unelevated, read-only; nothing is
# written. It exits when the companion (the parent PID given) is gone.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File CodeCity\probe-tier0.ps1 <parent pid> [ms=2000]
param([int]$Parent = 0, [int]$Every = 2000)
$ErrorActionPreference = 'SilentlyContinue'
while ($true) {
  if ($Parent -and -not (Get-Process -Id $Parent -ErrorAction SilentlyContinue)) { exit 0 }
  $cpu = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime
  $os = Get-CimInstance Win32_OperatingSystem
  $disk = (Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'").PercentDiskTime
  $nic = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface
  $rx = ($nic | Measure-Object -Property BytesReceivedPersec -Sum).Sum
  $tx = ($nic | Measure-Object -Property BytesSentPersec -Sum).Sum
  $gpu = (Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine | Where-Object { $_.Name -like '*engtype_3D' } | Measure-Object -Property UtilizationPercentage -Sum).Sum
  $o = [ordered]@{ at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); cpu = [int]$cpu; ramMB = [int]($os.TotalVisibleMemorySize / 1024);
    ramFreeMB = [int]($os.FreePhysicalMemory / 1024); disk = [int][Math]::Min(100, [double]$disk); rx = [long]$rx; tx = [long]$tx; gpu = [int][Math]::Min(100, [double]$gpu) }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress)); [Console]::Out.Flush()
  Start-Sleep -Milliseconds $Every
}
