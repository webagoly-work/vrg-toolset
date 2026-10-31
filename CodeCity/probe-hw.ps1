# probe-hw.ps1 — the Gépország inventory (docs/city/homeland/04-data-feed.md): one JSON object on stdout, once, when the
# view first opens: what stands on this island. Unelevated, read-only; serial numbers are never read.
$ErrorActionPreference = 'SilentlyContinue'
$board = Get-CimInstance Win32_BaseBoard
$bios = Get-CimInstance Win32_BIOS
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$slots = (Get-CimInstance Win32_PhysicalMemoryArray | Measure-Object -Property MemoryDevices -Sum).Sum
$dimms = @(Get-CimInstance Win32_PhysicalMemory | ForEach-Object { [ordered]@{ slot = $_.DeviceLocator; size = [long]$_.Capacity; speed = [int]$_.Speed } })
$gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1
$disks = @(Get-CimInstance Win32_DiskDrive | ForEach-Object {
  $d = $_
  $letters = @(Get-CimAssociatedInstance -InputObject $d -ResultClassName Win32_DiskPartition | ForEach-Object { Get-CimAssociatedInstance -InputObject $_ -ResultClassName Win32_LogicalDisk | ForEach-Object { $_.DeviceID } })
  $vols = @($letters | ForEach-Object { $l = $_; Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$l'" | ForEach-Object { [ordered]@{ letter = $l; size = [long]$_.Size; free = [long]$_.FreeSpace } } })
  [ordered]@{ index = [int]$d.Index; model = ([string]$d.Model).Trim(); size = [long]$d.Size; bus = [string]$d.InterfaceType; media = [string]$d.MediaType; vols = $vols } })
$nics = @(Get-CimInstance Win32_NetworkAdapter -Filter 'PhysicalAdapter=True' | ForEach-Object { [ordered]@{ name = $_.Name; up = ($_.NetConnectionStatus -eq 2); speed = [long]$_.Speed } })
$audio = @(Get-CimInstance Win32_SoundDevice | ForEach-Object { $_.Name })
$o = [ordered]@{ board = "$($board.Manufacturer) $($board.Product)".Trim(); bios = [ordered]@{ maker = $bios.Manufacturer; version = $bios.SMBIOSBIOSVersion; date = $bios.ReleaseDate.ToString('yyyy-MM-dd') };
  cpu = [ordered]@{ name = ([string]$cpu.Name).Trim(); cores = [int]$cpu.NumberOfCores; threads = [int]$cpu.NumberOfLogicalProcessors; l3 = [int]$cpu.L3CacheSize };
  ram = [ordered]@{ slots = [int]$slots; dimms = $dimms }; gpu = [ordered]@{ name = $gpu.Name; w = [int]$gpu.CurrentHorizontalResolution; h = [int]$gpu.CurrentVerticalResolution; hz = [int]$gpu.CurrentRefreshRate };
  disks = $disks; nics = $nics; audio = $audio }
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 6))
