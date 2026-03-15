# Windows でダブルクリックして起動（Tailscale 開発モード）
# 右クリック →「PowerShell で実行」またはエクスプローラーで .ps1 を実行
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

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
$envLocal = Join-Path $PSScriptRoot "nextjs-web\.env.local"
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
npm run dev
