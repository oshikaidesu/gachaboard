# Portable: Start PostgreSQL, MinIO, sync-server (no Docker)
$ErrorActionPreference = "Stop"
$RootDir = if ($args[0]) { $args[0] } else { (Get-Location).Path }
$DataDir = if ($env:GACHABOARD_DATA_DIR) { $env:GACHABOARD_DATA_DIR } else { Join-Path $RootDir "data" }
$BinDir = Join-Path $RootDir "portable\bin"

$PostgresPort = if ($env:POSTGRES_HOST_PORT) { $env:POSTGRES_HOST_PORT } else { "18581" }
$MinioApiPort = if ($env:MINIO_API_HOST_PORT) { $env:MINIO_API_HOST_PORT } else { "18583" }
$MinioConsolePort = if ($env:MINIO_CONSOLE_HOST_PORT) { $env:MINIO_CONSOLE_HOST_PORT } else { "18584" }
$SyncPort = if ($env:SYNC_SERVER_HOST_PORT) { $env:SYNC_SERVER_HOST_PORT } else { "18582" }

$PgData = Join-Path $DataDir "postgres"
$MinioData = Join-Path $DataDir "minio"
$SyncData = Join-Path $DataDir "sync"

New-Item -ItemType Directory -Force -Path $DataDir, $BinDir | Out-Null

# PostgreSQL: get pg_ctl path
function Get-PostgresCtlPath {
  $pgCtl = Get-Command pg_ctl -ErrorAction SilentlyContinue
  if ($pgCtl) {
    return (Split-Path $pgCtl.Source)
  }
  $found = Get-ChildItem -Path $BinDir -Filter "pg_ctl.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) {
    return (Split-Path $found.FullName)
  }
  return $null
}

# PostgreSQL: first-run download
function Install-PostgresPortable {
  Write-Host ">>> Downloading PostgreSQL (first run)..."
  $pgZip = Join-Path $BinDir "postgres.zip"
  $urls = @(
    "https://get.enterprisedb.com/postgresql/postgresql-16.13-1-windows-x64-binaries.zip",
    "https://sourceforge.net/projects/pgsqlportable/files/16.1/postgresql-16.1-1-windows-x64-full.zip/download"
  )
  foreach ($u in $urls) {
    try {
      Invoke-WebRequest -Uri $u -OutFile $pgZip -UseBasicParsing -TimeoutSec 120
      if ((Get-Item $pgZip).Length -gt 10000000) {
        break
      }
    }
    catch {
      # ignore
    }
  }
  if (-not (Test-Path $pgZip) -or (Get-Item $pgZip).Length -le 10000000) {
    Write-Host "PostgreSQL download failed. Install manually: https://www.postgresql.org/download/windows/"
    return $false
  }
  Expand-Archive -Path $pgZip -DestinationPath $BinDir -Force
  Remove-Item $pgZip -Force
  $found = Get-ChildItem -Path $BinDir -Filter "pg_ctl.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $found) {
    Write-Host "PostgreSQL extract failed."
    return $false
  }
  $true
}

# PostgreSQL: init data dir (first run only)
function Initialize-PostgresData {
  Write-Host ">>> Initializing PostgreSQL (first run)..."
  Write-Host "    (May take a while on first run; antivirus may delay)"
  & initdb -D $PgData -U gachaboard --auth=trust --locale=C
  Add-Content -Path (Join-Path $PgData "pg_hba.conf") -Value "host all all 127.0.0.1/32 trust"
  $conf = Join-Path $PgData "postgresql.conf"
  (Get-Content $conf) -replace "dynamic_shared_memory_type = posix", "dynamic_shared_memory_type = windows" | Set-Content $conf
  (Get-Content $conf) -replace "log_timezone = 'Etc/UTC'", "log_timezone = 'UTC'" | Set-Content $conf
  (Get-Content $conf) -replace "timezone = 'Etc/UTC'", "timezone = 'UTC'" | Set-Content $conf
}

# PostgreSQL: start and ensure DB ready
function Start-Postgres {
  $pgCtlPath = Get-PostgresCtlPath
  if (-not $pgCtlPath) {
    if (-not (Install-PostgresPortable)) { return $false }
    $pgCtlPath = Get-PostgresCtlPath
    if (-not $pgCtlPath) { return $false }
  }
  $env:PATH = $pgCtlPath + ";" + $env:PATH

  $ec = 1
  try { $p = Start-Process -FilePath "pg_isready" -ArgumentList "-h", "127.0.0.1", "-p", $PostgresPort, "-U", "gachaboard" -Wait -NoNewWindow -PassThru; $ec = $p.ExitCode }
  catch { }
  if ($ec -eq 0) {
    Ensure-GachaboardDatabase
    return $true
  }

  if (-not (Test-Path $PgData)) { Initialize-PostgresData }

  $pidFile = Join-Path $PgData "postmaster.pid"
  if ((Test-Path $PgData) -and (Test-Path $pidFile)) {
    Write-Host ">>> Stopping existing PostgreSQL..."
    try { & pg_ctl -D $PgData stop -m fast 2>&1 | Out-Null } catch { }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }

  # If the project folder moved, fix postgresql.conf data_directory if it still points elsewhere
  $conf = Join-Path $PgData "postgresql.conf"
  $pgDataNorm = $PgData.Replace('\', '/')
  if ((Test-Path $conf)) {
    $content = Get-Content $conf -Raw
    if ($content -match "data_directory\s*=\s*'([^']+)'") {
      $oldPath = $Matches[1].Trim().Replace('\', '/')
      if ($oldPath -and $oldPath -ne $pgDataNorm) {
        Write-Host ">>> Updating data_directory (project was moved)..."
        $content = $content -replace "data_directory\s*=\s*'[^']*'", "data_directory = '$pgDataNorm'"
        Set-Content -Path $conf -Value $content -NoNewline
      }
    }
  }

  Write-Host ">>> Starting PostgreSQL..."
  $logFile = Join-Path $DataDir "postgres.log"
  # pg_ctl start can hang when run synchronously on Windows; use Start-Job. Do not stop the job (would kill postgres).
  $null = Start-Job -ScriptBlock {
    param($ctlPath, $dataDir, $logPath, $port)
    $env:PATH = $ctlPath + ";" + $env:PATH
    & (Join-Path $ctlPath "pg_ctl.exe") -D $dataDir -l $logPath -o "-p $port" start 2>&1
  } -ArgumentList $pgCtlPath, $PgData, $logFile, $PostgresPort
  Start-Sleep -Seconds 4

  $maxWait = 60
  for ($j = 0; $j -lt $maxWait; $j++) {
    $ready = $null
    try { $ready = Start-Process -FilePath "pg_isready" -ArgumentList "-h", "127.0.0.1", "-p", $PostgresPort, "-U", "gachaboard" -Wait -NoNewWindow -PassThru -ErrorAction SilentlyContinue }
    catch { }
    if ($ready -and $ready.ExitCode -eq 0) {
      Ensure-GachaboardDatabase
      return $true
    }
    if ($j -eq 0) { Write-Host "    waiting for PostgreSQL to accept connections..." }
    Start-Sleep -Seconds 1
    if ($j -eq $maxWait - 1) {
      Write-Host "PostgreSQL did not become ready in $maxWait s. Check data/postgres.log" -ForegroundColor Red
      return $false
    }
  }
  return $false
}

function Ensure-GachaboardDatabase {
  $sql = "SELECT 1 FROM pg_database WHERE datname='gachaboard'"
  $out = & psql -h 127.0.0.1 -p $PostgresPort -U gachaboard -d postgres -tAc $sql 2>&1 | Out-String
  if ($out -notmatch "1") {
    & psql -h 127.0.0.1 -p $PostgresPort -U gachaboard -d postgres -c "CREATE DATABASE gachaboard"
  }
}

# Credential rotation: 起動毎に PostgreSQL パスワードを変更（CREDENTIAL_ROTATION=1 時）
function Invoke-CredentialRotation {
  $rotationEnabled = ($env:CREDENTIAL_ROTATION -eq "1" -or $env:CREDENTIAL_ROTATION -eq "true")
  if (-not $rotationEnabled) { return }

  $pgCtlPath = Get-PostgresCtlPath
  if (-not $pgCtlPath) { return }
  $env:PATH = $pgCtlPath + ";" + $env:PATH

  $passwordFile = Join-Path $PgData ".db-password"
  $runtimeUrlFile = Join-Path $DataDir ".runtime-db-url"
  $hba = Join-Path $PgData "pg_hba.conf"

  # 32 bytes -> base64-like, URL-safe (avoid +/= for SQL)
  function New-RandomPassword {
    $bytes = 1..32 | ForEach-Object { [byte](Get-Random -Maximum 256 -Minimum 0) }
    $b64 = [Convert]::ToBase64String($bytes) -replace '\+','A' -replace '/','B' -replace '=',''
    $b64
  }

  if (Test-Path $passwordFile) {
    $current = (Get-Content $passwordFile -Raw).Trim()
    $newPass = New-RandomPassword
    $env:PGPASSWORD = $current
    try {
      & psql -h 127.0.0.1 -p $PostgresPort -U gachaboard -d postgres -c "ALTER USER gachaboard WITH PASSWORD '$newPass'" 2>&1 | Out-Null
    } catch {}
    if ($LASTEXITCODE -eq 0) {
      Set-Content $passwordFile -Value $newPass -NoNewline
      Write-Host ">>> Credential rotation: PostgreSQL password rotated" -ForegroundColor Cyan
    } else {
      Write-Host ">>> Credential rotation: failed (wrong current password?)" -ForegroundColor Yellow
      $newPass = $current
    }
  } else {
    $newPass = New-RandomPassword
    & psql -h 127.0.0.1 -p $PostgresPort -U gachaboard -d postgres -c "ALTER USER gachaboard WITH PASSWORD '$newPass'" 2>&1 | Out-Null
    if ((Test-Path $hba)) {
      $content = Get-Content $hba -Raw
      if ($content -match '127\.0\.0\.1/32\s+trust') {
        $content = $content -replace '(127\.0\.0\.1/32)\s+trust', '$1 scram-sha-256'
        Set-Content $hba -Value $content -NoNewline
        & pg_ctl -D $PgData reload 2>&1 | Out-Null
      }
    }
    Set-Content $passwordFile -Value $newPass -NoNewline
    Write-Host ">>> Credential rotation: PostgreSQL password set (first run)" -ForegroundColor Cyan
  }

  $escaped = [uri]::EscapeDataString($newPass)
  $dbUrl = "postgresql://gachaboard:$escaped@localhost:$PostgresPort/gachaboard"
  Set-Content $runtimeUrlFile -Value "DATABASE_URL=`"$dbUrl`"" -NoNewline
}

# MinIO
function Start-Minio {
  $minioExe = Join-Path $BinDir "minio.exe"
  if (-not (Test-Path $minioExe)) {
    Write-Host ">>> Downloading MinIO (first run)..."
    $minioUrl = "https://dl.min.io/server/minio/release/windows-amd64/minio.exe"
    Invoke-WebRequest -Uri $minioUrl -OutFile $minioExe -UseBasicParsing
  }
  $minioProc = Get-Process -Name "minio" -ErrorAction SilentlyContinue
  if ($minioProc) {
    Write-Host ">>> Stopping existing MinIO..."
    $minioProc | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  $minioProc = Get-Process -Name "minio" -ErrorAction SilentlyContinue
  if (-not $minioProc) {
    Write-Host ">>> Starting MinIO..."
    $env:MINIO_ROOT_USER = "minioadmin"
    $env:MINIO_ROOT_PASSWORD = "minioadmin"
    Start-Process -FilePath $minioExe -ArgumentList "server", $MinioData, "--console-address", "127.0.0.1:$MinioConsolePort", "--address", "127.0.0.1:$MinioApiPort" -WindowStyle Hidden
    Start-Sleep -Seconds 2
  }
  for ($i = 1; $i -le 15; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$MinioApiPort/minio/health/live" -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { return $true }
    } catch {}
    Start-Sleep -Seconds 1
  }
  return $true
}

# MinIO: アプリ用 IAM ユーザーを起動毎に作り直す（CREDENTIAL_ROTATION=1 時）
# ルート minioadmin は既存データ互換のため維持。Next.js が使う AWS_* だけローテーション。
function Invoke-MinioAppCredentialRotation {
  $rotationEnabled = ($env:CREDENTIAL_ROTATION -eq "1" -or $env:CREDENTIAL_ROTATION -eq "true")
  if (-not $rotationEnabled) { return }

  $mcExe = Join-Path $BinDir "mc.exe"
  if (-not (Test-Path $mcExe)) {
    Write-Host ">>> Downloading MinIO Client (mc.exe) for S3 credential rotation..."
    Invoke-WebRequest -Uri "https://dl.min.io/client/mc/release/windows-amd64/mc.exe" -OutFile $mcExe -UseBasicParsing
  }

  $bucket = if ($env:S3_BUCKET) { $env:S3_BUCKET.Trim() } else { "" }
  if ([string]::IsNullOrWhiteSpace($bucket)) { $bucket = "my-bucket" }

  $rootUser = "minioadmin"
  $rootPass = "minioadmin"
  $aliasName = "gacharb"
  $endpoint = "http://127.0.0.1:$MinioApiPort"
  $mcConfigDir = Join-Path $DataDir "mc-config"
  New-Item -ItemType Directory -Force -Path $mcConfigDir | Out-Null
  $env:MC_CONFIG_DIR = $mcConfigDir

  $null = & $mcExe alias set $aliasName $endpoint $rootUser $rootPass 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> MinIO S3 rotation: mc alias failed (is MinIO running?)" -ForegroundColor Yellow
    return
  }

  $null = & $mcExe mb --ignore-existing "${aliasName}/${bucket}" 2>&1

  function New-MinioAccessKey {
    "gba" + [Guid]::NewGuid().ToString("N").Substring(0, 17)
  }
  function New-MinioSecretKey {
    $bytes = 1..24 | ForEach-Object { [byte](Get-Random -Maximum 256 -Minimum 0) }
    [Convert]::ToBase64String($bytes)
  }

  $appUserFile = Join-Path $MinioData ".app-s3-user"
  $runtimeS3File = Join-Path $DataDir ".runtime-s3-env"
  $oldKey = $null
  if (Test-Path $appUserFile) {
    $oldKey = (Get-Content $appUserFile -Raw).Trim()
  }

  $newKey = New-MinioAccessKey
  $newSecret = New-MinioSecretKey

  $null = & $mcExe admin user add $aliasName $newKey $newSecret 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> MinIO S3 rotation: mc admin user add failed" -ForegroundColor Yellow
    return
  }

  $null = & $mcExe admin policy attach $aliasName readwrite --user $newKey 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> MinIO S3 rotation: policy attach failed; removing new user" -ForegroundColor Yellow
    $null = & $mcExe admin user remove $aliasName $newKey 2>&1
    return
  }

  if ($oldKey -and $oldKey -ne $newKey) {
    $null = & $mcExe admin user remove $aliasName $oldKey 2>&1
  }

  Set-Content $appUserFile -Value $newKey -NoNewline
  $line1 = "AWS_ACCESS_KEY_ID=`"$newKey`""
  $line2 = "AWS_SECRET_ACCESS_KEY=`"$newSecret`""
  Set-Content $runtimeS3File -Value ($line1 + "`n" + $line2) -NoNewline
  Write-Host ">>> MinIO S3 rotation: app access key rotated" -ForegroundColor Cyan
}

# sync-server
function Start-SyncServer {
  $tcp = New-Object System.Net.Sockets.TcpClient
  try {
    $tcp.Connect("127.0.0.1", [int]$SyncPort)
    $tcp.Close()
    return $true
  } catch {}
  finally { try { $tcp.Close() } catch {} }
  # Stop existing sync-server if port in use, then start
  $conn = Get-NetTCPConnection -LocalPort $SyncPort -ErrorAction SilentlyContinue
  if ($conn) {
    Write-Host ">>> Stopping existing sync-server..."
    $conn.OwningProcess | Select-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
  }
  $syncDir = Join-Path $RootDir "nextjs-web\sync-server"
  if (-not (Test-Path (Join-Path $syncDir "node_modules"))) {
    Write-Host ">>> Installing sync-server dependencies (first run)..."
    Push-Location $syncDir
    npm install 2>&1 | Out-Null
    Pop-Location
  }
  Write-Host ">>> Starting sync-server..."
  $env:PORT = $SyncPort
  $env:HOST = "0.0.0.0"
  $env:YPERSISTENCE = $SyncData
  Start-Process -FilePath "node" -ArgumentList "server.mjs" -WorkingDirectory $syncDir -WindowStyle Hidden
  Start-Sleep -Seconds 1
  return $true
}

Set-Location $RootDir
if (-not (Start-Postgres)) { exit 1 }
Invoke-CredentialRotation
Start-Minio | Out-Null
Invoke-MinioAppCredentialRotation
Start-SyncServer | Out-Null
Write-Host ">>> Services ready: PostgreSQL, MinIO, sync-server"
