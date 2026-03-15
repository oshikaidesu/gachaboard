# 統合 .env のセットアップ（Windows 用）
# - 正本: nextjs-web/.env.local
# - プロジェクトルートの .env を nextjs-web/.env.local へのシンボリックリンクに
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptsDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $ScriptsDir
Set-Location $RootDir

$EnvLocal = "nextjs-web\.env.local"
$EnvRoot = ".env"

Write-Host "=== Gachaboard 環境変数セットアップ ===" -ForegroundColor Cyan

# 1. 正本 nextjs-web/.env.local を用意
if (-not (Test-Path $EnvLocal)) {
  Copy-Item ".env.example" $EnvLocal
  Write-Host ">>> $EnvLocal を作成しました（.env.example から）" -ForegroundColor Yellow
  $content = Get-Content $EnvLocal -Raw
  if ($content -notmatch "NEXTAUTH_SECRET=.+") {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    $content = $content -replace "NEXTAUTH_SECRET=.*", "NEXTAUTH_SECRET=$secret"
    Set-Content $EnvLocal $content -NoNewline
    Write-Host "    NEXTAUTH_SECRET を自動生成しました" -ForegroundColor Gray
  }
  Write-Host "    先頭4つ（Discord OAuth 等）を編集してください。" -ForegroundColor Gray
}
elseif ((Get-Item $EnvLocal -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
  Write-Host ">>> $EnvLocal がシンボリックリンクです。正本に移行します..." -ForegroundColor Yellow
  Copy-Item $EnvLocal "$EnvLocal.tmp"
  Remove-Item $EnvLocal
  Move-Item "$EnvLocal.tmp" $EnvLocal
}

# 2. 上層 .env が通常ファイルなら、内容を正本に移す
if ((Test-Path $EnvRoot) -and -not ((Get-Item $EnvRoot).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
  Write-Host ">>> プロジェクトルートの .env の内容を正本に移します..." -ForegroundColor Yellow
  Copy-Item $EnvRoot $EnvLocal -Force
  Remove-Item $EnvRoot
}

# 3. シンボリックリンク作成（Node スクリプト使用・Mac/Windows 両対応）
node "$ScriptsDir\setup\create-env-symlink.mjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 4. ポート変数から派生する値を同期
if (Test-Path "$ScriptsDir\lib\sync-env-ports.sh") {
  bash "$ScriptsDir/lib/sync-env-ports.sh" 2>$null
}

Write-Host ""
Write-Host "✓ セットアップ完了。$EnvLocal を編集（Discord OAuth 等）してから docker compose up -d と npm run dev を実行してください。" -ForegroundColor Green
