# Windows で起動（メニュー付き）
# 推奨: プロジェクトルートの start.bat をダブルクリック（実行ポリシー不要）
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptsDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $ScriptsDir
Set-Location $RootDir

# ── 必須: Docker は常に必要 ──
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "============================================" -ForegroundColor Red
  Write-Host "  Gachaboard を起動するには Docker が必要です" -ForegroundColor Red
  Write-Host "============================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "  Docker Desktop をインストールしてください:"
  Write-Host "  https://docs.docker.com/desktop/install/windows-install/"
  Write-Host ""
  Write-Host "============================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "Enter キーを押すと終了します..."
  Read-Host
  exit 1
}

# ── .env の存在チェック（Docker 全コンテナモード用に .env を優先）──
$envFile = Join-Path $RootDir ".env"
$envExample = Join-Path $RootDir ".env.example"

if ((-not (Test-Path $envFile)) -and (Test-Path $envExample)) {
  Copy-Item $envExample $envFile
  Write-Host ""
  Write-Host "  .env を .env.example から作成しました。" -ForegroundColor Green
  Write-Host "  Discord OAuth 等を編集してから再度起動してください。"
  Write-Host ""
  Write-Host "Enter キーを押すと終了します..."
  Read-Host
  exit 0
}
if (-not (Test-Path $envFile)) {
  Write-Host ""
  Write-Host "============================================" -ForegroundColor Red
  Write-Host "  .env が未作成です（初回セットアップ）" -ForegroundColor Red
  Write-Host "============================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "  以下を実行してください:"
  Write-Host ""
  Write-Host "    cd $RootDir" -ForegroundColor Cyan
  Write-Host "    Copy-Item .env.example .env" -ForegroundColor Cyan
  Write-Host "    # .env を開いて Discord OAuth 等を入力"
  Write-Host ""
  Write-Host "  Node.js がある場合: npm run setup:env" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "============================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "Enter キーを押すと終了します..."
  Read-Host
  exit 1
}

# ── 起動モード選択 ──
$canRunScript = $false
$hasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
$hasNpm = [bool](Get-Command npm -ErrorAction SilentlyContinue)

if ($hasNode -and $hasNpm) {
  $canRunScript = $true
}

if ($canRunScript) {
  $envLocal = Join-Path $RootDir "nextjs-web\.env.local"
  if (-not (Test-Path $envLocal)) {
    Write-Host ""
    Write-Host "  nextjs-web\.env.local が未作成です。npm run setup:env を実行してください。" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Enter キーを押すと終了します..."
    Read-Host
    exit 1
  }

  Write-Host "✓ 必須ツール インストール確認済み" -ForegroundColor Green
  Write-Host ""
  Write-Host "  起動モードを選んでください（Enter で 1 を選択）:" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "    1) 本番モード（既存ビルドで起動・デフォルト）"
  Write-Host "    2) ビルドを再生成してから本番モードで起動"
  Write-Host "    3) 開発モードで起動（ホットリロード）"
  Write-Host ""
  $choice = Read-Host "  1 / 2 / 3 [1]"
  if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

  # Windows では bash に頼らず PowerShell で完結（Docker → Postgres 待機 → Prisma → Next.js）
  $nextjsDir = Join-Path $RootDir "nextjs-web"
  $isDev = ($choice -eq "3")

  Write-Host ""
  Write-Host ">>> 1. 依存サービス起動 (PostgreSQL, MinIO, Sync Server)" -ForegroundColor Cyan
  & docker compose up -d --build
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  Docker の起動に失敗しました。Docker Desktop が起動しているか確認してください。" -ForegroundColor Red
    exit 1
  }

  Write-Host ">>> 2. PostgreSQL の起動を待機中..." -ForegroundColor Cyan
  $maxWait = 60
  $pgReady = $false
  for ($i = 1; $i -le $maxWait; $i++) {
    & docker exec compound-postgres pg_isready -U gachaboard -q 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "    準備完了 ($i 秒)" -ForegroundColor Green
      $pgReady = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $pgReady) {
    Write-Host "  タイムアウトしました。" -ForegroundColor Red
    exit 1
  }

  Write-Host ">>> 3. スキーマ適用 (prisma generate / db push)" -ForegroundColor Cyan
  Push-Location $nextjsDir
  npx prisma generate
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  Prisma generate に失敗しました。" -ForegroundColor Red
    Pop-Location
    exit 1
  }
  npx prisma db push
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  Prisma db push に失敗しました。" -ForegroundColor Red
    Pop-Location
    exit 1
  }

  $buildIdPath = Join-Path $nextjsDir ".next\BUILD_ID"
  if (($choice -eq "2") -or ((-not $isDev) -and (-not (Test-Path $buildIdPath)))) {
    Write-Host ">>> 4. ビルド（本番用）" -ForegroundColor Cyan
    if (-not (Test-Path $buildIdPath)) {
      Write-Host "    本番ビルドが見つかりません。ビルドを実行します..." -ForegroundColor Gray
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  ビルドに失敗しました。" -ForegroundColor Red
      Pop-Location
      exit 1
    }
  }
  Pop-Location

  $port = "18580"
  $envLocalPath = Join-Path $RootDir "nextjs-web\.env.local"
  if (Test-Path $envLocalPath) {
    $portLine = Get-Content $envLocalPath -ErrorAction SilentlyContinue | Select-String -Pattern "^PORT=" | Select-Object -First 1
    if ($portLine) {
      $pv = ($portLine -replace "^PORT=", "").Trim().Trim('"')
      if ($pv -match "^\d+$") { $port = $pv }
    }
  }

  Write-Host ""
  if ($isDev) {
    Write-Host ">>> 5. アプリ起動（開発モード）" -ForegroundColor Cyan
  } else {
    Write-Host ">>> 5. アプリ起動（本番モード）" -ForegroundColor Cyan
  }
  Write-Host "    アクセスURL: http://localhost:${port}" -ForegroundColor Green
  Write-Host "    終了: Ctrl+C" -ForegroundColor Gray
  Write-Host ""

  Set-Location $nextjsDir
  if ($isDev) {
    npm run dev
  } else {
    npm run start
  }
  exit $LASTEXITCODE
}

# ── Docker 全コンテナモード（Node.js 不要）──
Write-Host ""
Write-Host "  起動モードを選んでください（Enter で 1 を選択）:" -ForegroundColor Cyan
Write-Host ""
Write-Host "    1) 起動（Docker 全コンテナ・本番）"
Write-Host "    2) ビルド再生成・開発モード ... Node.js が必要です"
Write-Host ""
$choice = Read-Host "  1 [1]"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

if ($choice -ne "1") {
  Write-Host ""
  Write-Host "  Node.js をインストールすると、ビルド再生成や開発モードを選べます。" -ForegroundColor Yellow
  Write-Host "  https://nodejs.org/ からダウンロード"
  Write-Host ""
  Write-Host "Enter キーを押すと終了します..."
  Read-Host
  exit 0
}

Write-Host ""
Write-Host ">>> コンテナを起動中..." -ForegroundColor Cyan
try {
  docker compose --profile app up -d
} catch {
  Write-Host ""
  Write-Host "  起動に失敗しました。Docker Desktop が起動しているか確認してください。" -ForegroundColor Red
  Write-Host ""
  Write-Host "Enter キーを押すと終了します..."
  Read-Host
  exit 1
}

$port = "18580"
$envContent = Get-Content $envFile -ErrorAction SilentlyContinue
$portLine = $envContent | Select-String -Pattern "^PORT=" | Select-Object -First 1
if ($portLine) {
  $portVal = ($portLine -replace "^PORT=", "").Trim().Trim('"')
  if ($portVal -match "^\d+$") { $port = $portVal }
}

Write-Host ""
Write-Host "  起動しました。ブラウザで http://localhost:${port} を開いてください。" -ForegroundColor Green
Write-Host ""
Write-Host "  停止するには: docker compose --profile app down"
Write-Host ""
Write-Host "Enter キーを押すとこのウィンドウを閉じます（アプリは起動したままです）..."
Read-Host
exit 0
