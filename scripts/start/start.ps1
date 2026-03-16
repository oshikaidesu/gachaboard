# Windows で起動（メニュー付き）
# 推奨: プロジェクトルートの start.bat をダブルクリック（実行ポリシー不要）
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptsDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $ScriptsDir
Set-Location $RootDir

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

# ── 起動モード選択 ──
Write-Host ""
Write-Host "  起動モードを選んでください（Enter で 1 を選択）:" -ForegroundColor Cyan
Write-Host ""
Write-Host "    1) 本番モード（既存ビルドで起動・デフォルト）"
Write-Host "    2) ビルドを再生成してから本番モードで起動"
Write-Host "    3) 開発モードで起動（ホットリロード）"
Write-Host ""
$choice = Read-Host "  1 / 2 / 3 [1]"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

switch ($choice) {
  "2" {
    Write-Host ""
    Write-Host ">>> ビルドを再生成しています..." -ForegroundColor Cyan
    Push-Location (Join-Path $RootDir "nextjs-web")
    try {
      npx prisma generate
      npm run build
    } catch {
      Write-Host "ビルドに失敗しました" -ForegroundColor Red
      Pop-Location
      exit 1
    }
    Pop-Location
    Write-Host ""
    npm run start
  }
  "3" {
    npm run dev
  }
  default {
    npm run start
  }
}
