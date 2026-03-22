# Windows native startup (no WSL/Docker)
# Restart = stop app port if Next.js is already bound, then start again.
# -Tailscale: set NEXTAUTH_URL for HTTPS, enable Tailscale Serve
# -Dev: npm run dev (hot reload)
# -BuildOnly: build and exit (no app process)
param([switch]$Tailscale, [switch]$Dev, [switch]$BuildOnly)

# UTF-8 code page so redirected/piped child output mojibakes less on localized Windows
$null = cmd /c "chcp 65001 >nul 2>&1"

# Console output encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$RootDir = if ($PSScriptRoot) { (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path } else { (Get-Location).Path }
Set-Location $RootDir
$env:GACHABOARD_ROOT = $RootDir
$nextDirName = 'nextjs-web'

Write-Host '=== Gachaboard (Windows Native)' -ForegroundColor Cyan
if ($Tailscale) { Write-Host ' [Tailscale HTTPS]' -ForegroundColor Yellow }
if ($Dev) { Write-Host ' [Dev mode]' -ForegroundColor Magenta }
if ($BuildOnly) { Write-Host ' [Build only]' -ForegroundColor Gray }
Write-Host ' ===' -ForegroundColor Cyan

# Node.js check
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host ''
  Write-Host 'Node.js not found. Install from https://nodejs.org/' -ForegroundColor Red
  pause
  exit 1
}

# .env check
$envLocal = Join-Path (Join-Path $RootDir $nextDirName) '.env.local'
$envExample = Join-Path $RootDir '.env.example'
if (-not (Test-Path $envLocal)) {
  if (Test-Path $envExample) {
    Write-Host ''
    Write-Host 'Running npm run setup:env...' -ForegroundColor Yellow
    npm run setup:env
    if (-not (Test-Path $envLocal)) {
      Write-Host 'Failed to create nextjs-web/.env.local' -ForegroundColor Red
      pause
      exit 1
    }
    Write-Host ''
    Write-Host '============================================' -ForegroundColor Yellow
    Write-Host '  Configure Discord for sign-in' -ForegroundColor Yellow
    Write-Host '============================================' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  1. Create an app at https://discord.com/developers/applications' -ForegroundColor Gray
    Write-Host '  2. OAuth2: copy Client ID and Client Secret' -ForegroundColor Gray
    Write-Host '  3. Edit nextjs-web\.env.local and set:' -ForegroundColor Gray
    Write-Host '     DISCORD_CLIENT_ID=(your value)' -ForegroundColor Gray
    Write-Host '     DISCORD_CLIENT_SECRET=(your value)' -ForegroundColor Gray
    Write-Host '  4. Save, then run scripts\entry\start.bat again (option 1)' -ForegroundColor Gray
    Write-Host ''
    Write-Host '  See: docs\user\WINDOWS-NATIVE-SETUP.md' -ForegroundColor Gray
    Write-Host '============================================' -ForegroundColor Yellow
    pause
    exit 0
  } else {
    Write-Host '.env.example not found' -ForegroundColor Red
    pause
    exit 1
  }
}

# Discord env check (required for login)
$envContent = Get-Content $envLocal -Raw -ErrorAction SilentlyContinue
$discordId = if ($envContent -match 'DISCORD_CLIENT_ID=(.+)') { $Matches[1].Trim() } else { '' }
$discordSecret = if ($envContent -match 'DISCORD_CLIENT_SECRET=(.+)') { $Matches[1].Trim() } else { '' }
$authSecret = if ($envContent -match 'NEXTAUTH_SECRET=(.+)') { $Matches[1].Trim() } else { '' }
$missing = @()
if (-not $discordId -or $discordId -match 'REPLACE|^$') { $missing += 'DISCORD_CLIENT_ID' }
if (-not $discordSecret -or $discordSecret -match 'REPLACE|^$') { $missing += 'DISCORD_CLIENT_SECRET' }
if (-not $authSecret -or $authSecret -match 'REPLACE|^$') { $missing += 'NEXTAUTH_SECRET' }
if ($missing.Count -gt 0) {
  Write-Host ''
  Write-Host '============================================' -ForegroundColor Red
  Write-Host '  Missing values required for Discord sign-in' -ForegroundColor Red
  Write-Host '============================================' -ForegroundColor Red
  Write-Host ''
  Write-Host "  Not set: $($missing -join ', ')" -ForegroundColor Gray
  Write-Host ''
  Write-Host '  Edit nextjs-web\.env.local:' -ForegroundColor Gray
  Write-Host '    - DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET' -ForegroundColor Gray
  Write-Host '      (from Discord Developer Portal → OAuth2)' -ForegroundColor Gray
  Write-Host '    - If NEXTAUTH_SECRET is empty: npm run setup:env' -ForegroundColor Gray
  Write-Host ''
  Write-Host '  See: docs\user\WINDOWS-NATIVE-SETUP.md' -ForegroundColor Gray
  Write-Host '============================================' -ForegroundColor Red
  pause
  exit 1
}

# ffmpeg check (optional - for video/audio conversion)
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host ''
  Write-Host '  [Optional] ffmpeg not found (needed for video/audio transcoding).' -ForegroundColor DarkYellow
  Write-Host '  Install: winget install ffmpeg  or  https://ffmpeg.org/download.html' -ForegroundColor DarkYellow
  Write-Host ''
}

# Optional: credential rotation (from .env.local)
if ($envContent -match 'CREDENTIAL_ROTATION=(.+)') {
  $rotVal = $Matches[1].Trim()
  if ($rotVal -eq '1' -or $rotVal -eq 'true') { $env:CREDENTIAL_ROTATION = '1' }
}

# Port vars from .env.local (already loaded above for Discord check)
$PostgresPort = '18581'
$SyncPort = '18582'
$MinioPort = '18583'
$AppPort = '18580'
if ($envContent -match 'POSTGRES_HOST_PORT=(\d+)') { $PostgresPort = $Matches[1] }
if ($envContent -match 'SYNC_SERVER_HOST_PORT=(\d+)') { $SyncPort = $Matches[1] }
if ($envContent -match 'MINIO_API_HOST_PORT=(\d+)') { $MinioPort = $Matches[1] }
if ($envContent -match 'PORT=(\d+)') { $AppPort = $Matches[1] }
$env:POSTGRES_HOST_PORT = $PostgresPort
$env:SYNC_SERVER_HOST_PORT = $SyncPort
$env:MINIO_API_HOST_PORT = $MinioPort
$env:GACHABOARD_DATA_DIR = Join-Path $RootDir 'data'
$s3Bucket = 'my-bucket'
if ($envContent -match '(?m)^S3_BUCKET=(.+)$') { $s3Bucket = $Matches[1].Trim() }
if (-not [string]::IsNullOrWhiteSpace($s3Bucket)) { $env:S3_BUCKET = $s3Bucket }

# Sync .env.local URLs for Local vs Tailscale
Write-Host ''
if ($Tailscale) {
  & (Join-Path $RootDir 'scripts\win\sync-env-tailscale.ps1')
} else {
  & (Join-Path $RootDir 'scripts\win\sync-env-local.ps1') -AppPort $AppPort -MinioPort $MinioPort -SyncPort $SyncPort
}

# Start services
Write-Host ''
Write-Host ('Step 1. Starting PostgreSQL, MinIO, sync-server') -ForegroundColor Cyan
& (Join-Path $RootDir 'portable\scripts\start-services.ps1') $RootDir
if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { pause; exit 1 }

# Load rotated DATABASE_URL if credential rotation was used
$dataDirForRuntime = if ($env:GACHABOARD_DATA_DIR) { $env:GACHABOARD_DATA_DIR } else { Join-Path $RootDir 'data' }
$runtimeUrlFile = Join-Path $dataDirForRuntime '.runtime-db-url'
if ($env:CREDENTIAL_ROTATION -eq '1' -and (Test-Path $runtimeUrlFile)) {
  $line = Get-Content $runtimeUrlFile -Raw
  if ($line -match '^DATABASE_URL="?(.+?)"?$') { $env:DATABASE_URL = $Matches[1].Trim().Trim('"') }
}

$runtimeS3File = Join-Path $dataDirForRuntime '.runtime-s3-env'
if ($env:CREDENTIAL_ROTATION -eq '1' -and (Test-Path $runtimeS3File)) {
  Get-Content $runtimeS3File | ForEach-Object {
    if ($_ -match '^AWS_ACCESS_KEY_ID="(.*)"\s*$') { $env:AWS_ACCESS_KEY_ID = $Matches[1] }
    elseif ($_ -match '^AWS_SECRET_ACCESS_KEY="(.*)"\s*$') { $env:AWS_SECRET_ACCESS_KEY = $Matches[1] }
  }
}

# Add PostgreSQL to PATH if downloaded
$pgCtl = Get-Command pg_ctl -ErrorAction SilentlyContinue
if (-not $pgCtl) {
  $found = Get-ChildItem -Path (Join-Path $RootDir 'portable\bin') -Filter 'pg_ctl.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) {
    $pgBin = Split-Path $found.FullName
    $env:PATH = $pgBin + ';' + $env:PATH
  }
}

# pg_isready は libpq 認証が必要な場合 PGPASSWORD を参照する（CREDENTIAL_ROTATION + scram-sha-256 対策）
if ($env:DATABASE_URL -match 'postgresql://[^:]+:([^@]+)@') {
  try { $env:PGPASSWORD = [uri]::UnescapeDataString($Matches[1]) } catch { $env:PGPASSWORD = $Matches[1] }
}

# Wait for PostgreSQL
Write-Host ''
Write-Host ('Step 2. Waiting for PostgreSQL') -ForegroundColor Cyan
for ($i = 1; $i -le 60; $i++) {
  $proc = Start-Process -FilePath 'pg_isready' -ArgumentList '-h','127.0.0.1','-p',$PostgresPort,'-U','gachaboard' -Wait -NoNewWindow -PassThru -ErrorAction SilentlyContinue
  if ($proc -and $proc.ExitCode -eq 0) {
    Write-Host '    PostgreSQL ready' -ForegroundColor Green
    break
  }
  if ($i -eq 60) {
    Write-Host 'PostgreSQL startup timeout' -ForegroundColor Red
    pause
    exit 1
  }
  Start-Sleep -Seconds 1
}

# npm install
$nextDir = Join-Path $RootDir $nextDirName
if (-not (Test-Path (Join-Path $nextDir 'node_modules'))) {
  Write-Host ''
  Write-Host ('Step 3. npm install (first run)') -ForegroundColor Cyan
  Set-Location $nextDir
  npm install
  Set-Location $RootDir
}
$syncDir = Join-Path $nextDir 'sync-server'
if (-not (Test-Path (Join-Path $syncDir 'node_modules'))) {
  Write-Host ''
  Write-Host ('Step 3b. sync-server npm install (first run)') -ForegroundColor Cyan
  Set-Location $syncDir
  npm install
  Set-Location $RootDir
}

# Prisma
Write-Host ''
Write-Host ('Step 4. prisma generate, migrate deploy') -ForegroundColor Cyan
Set-Location $nextDir
npx prisma generate
npx prisma migrate deploy
Set-Location $RootDir

# Build (skipped in Dev unless BuildOnly)
$needBuild = $BuildOnly -or (-not $Dev -and -not (Test-Path (Join-Path (Join-Path $nextDir '.next') 'BUILD_ID')))
if ($needBuild) {
  Write-Host ''
  Write-Host ('Step 5. Building Next.js') -ForegroundColor Cyan
  Set-Location $nextDir
  $devTypes = Join-Path (Join-Path $nextDir '.next') 'dev'
  if (Test-Path $devTypes) { Remove-Item -Recurse -Force $devTypes -ErrorAction SilentlyContinue }
  npm run build
  Set-Location $RootDir
  if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { pause; exit 1 }
}

if ($BuildOnly) {
  Write-Host ''
  Write-Host 'Build completed.' -ForegroundColor Green
  pause
  exit 0
}

# Start Next.js
Write-Host ''
$step6Msg = if ($Dev) { 'Step 6. Starting app (dev)' } else { 'Step 6. Starting app' }
Write-Host $step6Msg -ForegroundColor Cyan
$conn = Get-NetTCPConnection -LocalPort $AppPort -ErrorAction SilentlyContinue
if ($conn) { $conn.OwningProcess | Select-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 2 }
$env:PORT = $AppPort
$AppUrl = 'http://localhost:' + $AppPort

# Tailscale Serve (HTTPS)
if ($Tailscale) {
  $tsExe = 'C:\Program Files\Tailscale\tailscale.exe'
  if (-not (Test-Path $tsExe)) { $tsExe = 'C:\Program Files (x86)\Tailscale\tailscale.exe' }
  if (Test-Path $tsExe) {
    Write-Host 'Tailscale Serve setting...' -ForegroundColor Cyan
    & $tsExe serve reset 2>$null
    & $tsExe serve --bg ('http://localhost:' + $AppPort) 2>$null
    & $tsExe serve --bg --set-path='/ws' ('http://localhost:' + $SyncPort) 2>$null
    $tsHost = $null
    try { $j = (& $tsExe status --json --peers=false 2>$null) | Out-String; $dq = [char]34; $pat = 'DNSName' + $dq + '\s*:\s*' + $dq + '(.+?)' + $dq; if ($j -match $pat) { $tsHost = $Matches[1].TrimEnd('.') } } catch {}
    if ($tsHost) { $AppUrl = 'https://' + $tsHost; Write-Host ('    HTTPS: ' + $AppUrl) -ForegroundColor Green }
  }
}

Write-Host ''
Write-Host ('URL: ' + $AppUrl) -ForegroundColor Green
Write-Host ('Stop: Ctrl' + [char]43 + 'C') -ForegroundColor Gray
Write-Host ''

# Open browser once Next.js responds (background job)
$readyUrl = 'http://localhost:' + $AppPort
$openUrl = $AppUrl
Start-Job -ScriptBlock {
  param($ReadyUrl, $OpenUrl)
  for ($i = 0; $i -lt 120; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $ReadyUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
      if ($r -and $r.StatusCode -in @(200, 302, 307)) {
        Start-Process $OpenUrl
        return
      }
    } catch {}
    Start-Sleep -Seconds 1
  }
} -ArgumentList $readyUrl, $openUrl | Out-Null

Set-Location $nextDir
if ($Dev) {
  npm run dev
} else {
  npm run start
}
