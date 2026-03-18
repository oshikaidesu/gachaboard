$files = @('run.ps1', 'sync-env-local.ps1', 'sync-env-tailscale.ps1', 'reset-services.ps1')
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$batFiles = @((Join-Path $projectRoot 'start.bat'))
$utf8 = New-Object System.Text.UTF8Encoding $true
foreach ($f in $files) {
  $path = Join-Path $PSScriptRoot $f
  if (Test-Path $path) {
    $c = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $c = $c -replace [char]0x2018, [char]0x27 -replace [char]0x2019, [char]0x27
    $c = $c -replace [char]0x201C, [char]0x22 -replace [char]0x201D, [char]0x22
    [System.IO.File]::WriteAllText($path, $c, $utf8)
    Write-Host "Fixed: $f"
  }
}
foreach ($path in $batFiles) {
  if (Test-Path $path) {
    $c = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $c = $c -replace [char]0x2018, [char]0x27 -replace [char]0x2019, [char]0x27
    $c = $c -replace [char]0x201C, [char]0x22 -replace [char]0x201D, [char]0x22
    [System.IO.File]::WriteAllText($path, $c, $utf8)
    Write-Host "Fixed: start.bat"
  }
}
