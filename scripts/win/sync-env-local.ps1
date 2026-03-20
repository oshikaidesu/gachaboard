# Set nextjs-web/.env.local NEXTAUTH_URL (and related) for localhost mode
# Called from run.ps1 without -Tailscale (scripts/entry/start.bat menu 2)
param([string]$AppPort = "18580", [string]$MinioPort = "18583", [string]$SyncPort = "18582")

$RootDir = if ($env:GACHABOARD_ROOT) { $env:GACHABOARD_ROOT } else { (Get-Location).Path }
$EnvFile = Join-Path $RootDir "nextjs-web\.env.local"
if (-not (Test-Path $EnvFile)) { return }

$BaseUrl = "http://localhost:$AppPort"
Write-Host ">>> Setting NEXTAUTH_URL=$BaseUrl (Local)" -ForegroundColor Cyan

function Update-EnvVar {
  param($Key, $Value)
  $lines = Get-Content $EnvFile -ErrorAction SilentlyContinue
  if (-not $lines) { $lines = @() }
  $found = $false
  $newLines = $lines | ForEach-Object {
    if ($_ -match "^$([regex]::Escape($Key))=") { $found = $true; "$Key=$Value" } else { $_ }
  }
  if (-not $found) { $newLines += "$Key=$Value" }
  $newLines | Set-Content $EnvFile
}

Update-EnvVar "NEXTAUTH_URL" $BaseUrl
Update-EnvVar "S3_PUBLIC_URL" "http://localhost:$MinioPort"
Update-EnvVar "NEXT_PUBLIC_SYNC_WS_URL" "ws://localhost:$SyncPort"
Write-Host "    Discord Redirect: $BaseUrl/api/auth/callback/discord" -ForegroundColor Gray
