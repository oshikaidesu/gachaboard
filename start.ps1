# Gachaboard 起動スクリプト
# 右クリック → "PowerShell で実行" または ダブルクリックで起動

Set-Location $PSScriptRoot

Write-Host "Gachaboard を起動しています..." -ForegroundColor Cyan

# 1. Docker Compose 起動
Write-Host "[1/2] Docker コンテナを起動中..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker の起動に失敗しました。Docker Desktop が起動しているか確認してください。" -ForegroundColor Red
    Read-Host "Enterキーで終了"
    exit 1
}

# 2. Tailscale Funnel 起動（管理者権限で）
Write-Host "[2/2] Tailscale Funnel を起動中..." -ForegroundColor Yellow
$tailscale = "C:\Program Files\Tailscale\tailscale.exe"
if (Test-Path $tailscale) {
    gsudo cmd /c "`"$tailscale`" funnel --bg 3000" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Tailscale Funnel 起動済み" -ForegroundColor Green
    } else {
        Write-Host "Tailscale Funnel はすでに起動中か、設定が必要です" -ForegroundColor Yellow
    }
} else {
    Write-Host "Tailscale が見つかりません。スキップします。" -ForegroundColor Yellow
}

# 3. 起動完了メッセージ
Write-Host ""
Write-Host "==============================" -ForegroundColor Green
Write-Host " Gachaboard 起動完了" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host " 外部URL (Cloudflare):  https://gachaboar.uk" -ForegroundColor White
Write-Host " P2P URL (Tailscale):   http://desktop-hn7hdbv-1.tail16829c.ts.net:3000" -ForegroundColor White
Write-Host "==============================" -ForegroundColor Green
Write-Host ""
Write-Host "大容量ファイルのアップロードは P2P URL を使用してください。" -ForegroundColor Cyan
Write-Host ""

Read-Host "Enterキーで閉じる"
