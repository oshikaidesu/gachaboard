# Update nextjs-web/.env.local for Tailscale HTTPS (NEXTAUTH_URL, S3_PUBLIC_URL, NEXT_PUBLIC_SYNC_WS_URL)
# Called from run.ps1 -Tailscale (scripts/entry/start.bat menu 1)
param([string]$TailscaleHost)

$RootDir = if ($env:GACHABOARD_ROOT) { $env:GACHABOARD_ROOT } else { (Get-Location).Path }
$EnvFile = Join-Path $RootDir "nextjs-web\.env.local"
if (-not (Test-Path $EnvFile)) { return }

# Resolve Tailscale host
if (-not $TailscaleHost) {
  $tsExe = "C:\Program Files\Tailscale\tailscale.exe"
  if (-not (Test-Path $tsExe)) { $tsExe = "C:\Program Files (x86)\Tailscale\tailscale.exe" }
  if (Test-Path $tsExe) {
    try {
      $json = (& $tsExe status --json --peers=false 2>$null) | Out-String
      $dnsPat = '"DNSName"\s*:\s*"(.+?)"'
      if ($json -match $dnsPat) { $TailscaleHost = $Matches[1].TrimEnd('.') }
      if (-not $TailscaleHost) { $certPat = '"CertDomains"\s*:\s*\[\s*"(.+?)"'; if ($json -match $certPat) { $TailscaleHost = $Matches[1] } }
    } catch {}
  }
}
if (-not $TailscaleHost) {
  Write-Host "Tailscale host not found. Set TAILSCALE_HOST or run: tailscale status --json" -ForegroundColor Yellow
  return
}

$BaseUrl = "https://$TailscaleHost"
Write-Host ">>> Setting NEXTAUTH_URL=$BaseUrl (Tailscale HTTPS)" -ForegroundColor Cyan

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
Update-EnvVar "S3_PUBLIC_URL" ""
Update-EnvVar "NEXT_PUBLIC_SYNC_WS_URL" ""
Write-Host "    Discord Redirect: $BaseUrl/api/auth/callback/discord" -ForegroundColor Gray
