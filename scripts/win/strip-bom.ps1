# Remove BOM and normalize line endings (CRLF only, no stray CR)
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
foreach ($rel in @('scripts\entry\start.bat')) {
  $path = Join-Path $root $rel
  if (-not (Test-Path $path)) { continue }
$bytes = [System.IO.File]::ReadAllBytes($path)
$i = 0
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
  $i = 3
}
$list = [System.Collections.ArrayList]::new()
while ($i -lt $bytes.Length) {
  $b = $bytes[$i]
  if ($b -eq 13) { $i++; continue }
  if ($b -eq 10) { [void]$list.Add(13); [void]$list.Add(10); $i++; continue }
  [void]$list.Add($b)
  $i++
}
[System.IO.File]::WriteAllBytes($path, [byte[]]$list)
Write-Host "Normalized OK: $rel"
}
