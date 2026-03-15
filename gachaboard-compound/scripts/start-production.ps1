# Gachaboard 本番サーバー起動スクリプト (Windows)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

Write-Host "=== Gachaboard 本番サーバー起動 ===" -ForegroundColor Cyan

Write-Host ">>> 1. 依存サービス起動 (PostgreSQL, MinIO, Sync Server)" -ForegroundColor Yellow
docker compose up -d

Write-Host ">>> 2. パッケージ・DB セットアップ" -ForegroundColor Yellow
Set-Location nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push

Write-Host ">>> 3. ビルド" -ForegroundColor Yellow
npm run build

Write-Host ">>> 4. 本番サーバー起動" -ForegroundColor Yellow
$nextjsPath = Join-Path $PWD "nextjs-web"
Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $nextjsPath

Write-Host "    サーバーの起動を待機中..." -ForegroundColor Gray
$maxAttempts = 60
$url = "http://localhost:3000"
for ($i = 1; $i -le $maxAttempts; $i++) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -match "^(200|302|307)$") {
      Write-Host "    準備完了 ($i 秒)" -ForegroundColor Green
      break
    }
  } catch {}
  Start-Sleep -Seconds 1
  if ($i -eq $maxAttempts) {
    Write-Host "    タイムアウト。ブラウザは手動で $url を開いてください" -ForegroundColor Yellow
  }
}

Start-Process $url
