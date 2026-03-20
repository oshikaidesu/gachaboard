# Create nextjs-web/.env.local only (no root .env / symlinks)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptsDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $ScriptsDir
Set-Location $RootDir

$EnvLocal = "nextjs-web\.env.local"
$EnvRoot = ".env"

Write-Host "=== Gachaboard env setup (nextjs-web/.env.local only) ===" -ForegroundColor Cyan

if (Test-Path $EnvRoot) {
  $item = Get-Item $EnvRoot -Force
  if (-not ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    if (-not (Test-Path $EnvLocal)) {
      New-Item -ItemType Directory -Path (Split-Path $EnvLocal) -Force | Out-Null
      Move-Item $EnvRoot $EnvLocal
      Write-Host ">>> Moved root .env -> $EnvLocal" -ForegroundColor Yellow
    } else {
      Get-Content $EnvRoot | ForEach-Object {
        $line = $_
        if ($line -match '^\s*#' -or $line -match '^\s*$') { return }
        if ($line -match '^([^=]+)=(.*)$') {
          $key = $Matches[1].Trim()
          $c = Get-Content $EnvLocal -Raw
          if ($c -notmatch "(?m)^\s*$([regex]::Escape($key))=") {
            Add-Content $EnvLocal $line
          }
        }
      }
      Remove-Item $EnvRoot -Force
      Write-Host ">>> Merged root .env into $EnvLocal and removed root .env" -ForegroundColor Yellow
    }
  } else {
    Remove-Item $EnvRoot -Force
    Write-Host ">>> Removed legacy root .env symlink" -ForegroundColor Yellow
  }
}

if (-not (Test-Path $EnvLocal)) {
  Copy-Item ".env.example" $EnvLocal
  Write-Host ">>> $EnvLocal created from .env.example" -ForegroundColor Yellow
} elseif ((Get-Item $EnvLocal -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
  Copy-Item $EnvLocal "$EnvLocal.tmp"
  Remove-Item $EnvLocal
  Move-Item "$EnvLocal.tmp" $EnvLocal
  Write-Host ">>> .env.local was a symlink; converted to a regular file" -ForegroundColor Yellow
}

$content = Get-Content $EnvLocal -Raw
if ($content -notmatch "NEXTAUTH_SECRET=.+") {
  $bytes = [byte[]]::new(32)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes)
  $content = $content -replace "NEXTAUTH_SECRET=.*", "NEXTAUTH_SECRET=$secret"
  Set-Content $EnvLocal $content -NoNewline
  Write-Host "    NEXTAUTH_SECRET generated" -ForegroundColor Gray
}

$syncScriptPath = Join-Path $ScriptsDir "lib\sync-env-ports.sh"
if (Test-Path $syncScriptPath) {
  $syncScript = $syncScriptPath -replace '\\', '/'
  try { & bash $syncScript 2>$null } catch { }
}

Write-Host ""
Write-Host "Done. Edit $EnvLocal then run scripts/entry/start.bat or scripts/entry/start.sh." -ForegroundColor Green
exit 0
