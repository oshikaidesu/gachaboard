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

  Write-Host ">>> Starting PostgreSQL..."
  $logFile = Join-Path $DataDir "postgres.log"
  & pg_ctl -D $PgData -l $logFile -o "-p $PostgresPort" start

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
Start-Minio | Out-Null
Start-SyncServer | Out-Null
Write-Host ">>> Services ready: PostgreSQL, MinIO, sync-server"
