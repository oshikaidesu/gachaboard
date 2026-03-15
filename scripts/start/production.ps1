# Gachaboard 本番サーバー起動スクリプト (Windows)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptsDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $ScriptsDir
Set-Location $RootDir

Write-Host "=== Gachaboard 本番サーバー起動 ===" -ForegroundColor Cyan

# ── 必須ツールの存在チェック ──
$missing = @()
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { $missing += "docker" }
if (-not (Get-Command node   -ErrorAction SilentlyContinue)) { $missing += "node" }
if (-not (Get-Command npm    -ErrorAction SilentlyContinue)) { $missing += "npm" }

if ($missing.Count -gt 0) {
  Write-Host ""
  Write-Host "============================================" -ForegroundColor Red
  Write-Host "  Gachaboard を起動するには以下が必要です" -ForegroundColor Red
  Write-Host "============================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "  未インストール:" -ForegroundColor Yellow
  foreach ($m in $missing) {
    Write-Host "     - $m" -ForegroundColor Yellow
  }
  Write-Host ""
  Write-Host "  Windows でのインストール手順:" -ForegroundColor Cyan
  Write-Host "  ─────────────────────────────"
  foreach ($m in $missing) {
    switch ($m) {
      "docker" {
        Write-Host "  1) Docker Desktop をインストール"
        Write-Host "     https://docs.docker.com/desktop/install/windows-install/"
        Write-Host ""
      }
      { $_ -in "node", "npm" } {
        Write-Host "  2) Node.js をインストール (npm 同梱)"
        Write-Host "     https://nodejs.org/ からダウンロード"
        Write-Host ""
      }
    }
  }
  Write-Host "  インストール後、再度起動してください。"
  Write-Host "============================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "Enter キーを押すと終了します..."
  Read-Host
  exit 1
}

Write-Host "✓ 必須ツール インストール確認済み" -ForegroundColor Green

# ── .env の存在チェック ──
$envLocal = Join-Path $RootDir "nextjs-web\.env.local"
if (-not (Test-Path $envLocal)) {
  Write-Host ""
  Write-Host "============================================" -ForegroundColor Red
  Write-Host "  .env が未作成です（初回セットアップ）" -ForegroundColor Red
  Write-Host "============================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "  以下を実行してください:"
  Write-Host ""
  Write-Host "    npm run setup:env" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  その後 nextjs-web\.env.local を開いて"
  Write-Host "  Discord OAuth 等を入力してください。"
  Write-Host ""
  Write-Host "============================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "Enter キーを押すと終了します..."
  Read-Host
  exit 1
}

# ── 起動 ──
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
$port = 18580
if (Test-Path $envLocal) {
  $portLine = Get-Content $envLocal | Select-String -Pattern "^PORT="
  if ($portLine) {
    $portVal = ($portLine -replace "^PORT=", "").Trim().Trim('"')
    if ($portVal -match "^\d+$") { $port = [int]$portVal }
  }
}
$url = "http://localhost:$port"
$nextjsPath = Join-Path $RootDir "nextjs-web"
$env:PORT = $port
Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $nextjsPath

Write-Host "    サーバーの起動を待機中..." -ForegroundColor Gray
$maxAttempts = 60
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
