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

# PostgreSQL
function Start-Postgres {
  $pgCtlPath = $null
  $pgCtl = Get-Command pg_ctl -ErrorAction SilentlyContinue
  if ($pgCtl) { $pgCtlPath = Split-Path $pgCtl.Source }
  if (-not $pgCtlPath) {
    $found = Get-ChildItem -Path $BinDir -Filter "pg_ctl.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $pgCtlPath = Split-Path $found.FullName }
  }
  if (-not $pgCtlPath) {
    Write-Host ">>> Downloading PostgreSQL (first run)..."
    $pgZip = Join-Path $BinDir "postgres.zip"
    $pgUrls = @(
      "https://get.enterprisedb.com/postgresql/postgresql-16.13-1-windows-x64-binaries.zip",
      "https://sourceforge.net/projects/pgsqlportable/files/16.1/postgresql-16.1-1-windows-x64-full.zip/download"
    )
    $downloaded = $false
    foreach ($pgUrl in $pgUrls) {
      try {
        Invoke-WebRequest -Uri $pgUrl -OutFile $pgZip -UseBasicParsing -TimeoutSec 120
        if ((Get-Item $pgZip).Length -gt 10000000) { $downloaded = $true; break }
      } catch {}
    }
    if (-not $downloaded) {
      Write-Host "PostgreSQL download failed. Install manually: https://www.postgresql.org/download/windows/"
      return $false
    }
    Expand-Archive -Path $pgZip -DestinationPath $BinDir -Force
    Remove-Item $pgZip -Force
    $found = Get-ChildItem -Path $BinDir -Filter "pg_ctl.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $pgCtlPath = Split-Path $found.FullName }
    if (-not $pgCtlPath) {
      Write-Host "PostgreSQL extract failed."
      return $false
    }
  }
  $env:PATH = $pgCtlPath + ";" + $env:PATH

  try {
    $ec = (Start-Process -FilePath "pg_isready" -ArgumentList "-h","127.0.0.1","-p",$PostgresPort,"-U","gachaboard" -Wait -NoNewWindow -PassThru).ExitCode
  } catch { $ec = 1 }
  if ($ec -eq 0) { return $true }

  if (-not (Test-Path $PgData)) {
    Write-Host ">>> Initializing PostgreSQL (first run)..."
    & initdb -D $PgData -U gachaboard --auth=trust --locale=C
    Add-Content -Path (Join-Path $PgData "pg_hba.conf") -Value "host all all 127.0.0.1/32 trust"
    $conf = Join-Path $PgData "postgresql.conf"
    (Get-Content $conf) -replace 'dynamic_shared_memory_type = posix', 'dynamic_shared_memory_type = windows' | Set-Content $conf
    (Get-Content $conf) -replace "log_timezone = 'Etc/UTC'", "log_timezone = 'UTC'" | Set-Content $conf
    (Get-Content $conf) -replace "timezone = 'Etc/UTC'", "timezone = 'UTC'" | Set-Content $conf
  }
  Write-Host ">>> Starting PostgreSQL..."
  & pg_ctl -D $PgData -l (Join-Path $DataDir "postgres.log") -o "-p $PostgresPort" start
  Start-Sleep -Seconds 2
  $dbExists = & psql -h 127.0.0.1 -p $PostgresPort -U gachaboard -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='gachaboard'" 2>&1
  if (-not $dbExists) {
    & psql -h 127.0.0.1 -p $PostgresPort -U gachaboard -d postgres -c "CREATE DATABASE gachaboard"
  }
  return $true
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
  $syncDir = Join-Path $RootDir "nextjs-web\sync-server"
  if (-not (Test-Path (Join-Path $syncDir "node_modules"))) {
    Write-Host ">>> Installing sync-server dependencies (first run)..."
    Push-Location $syncDir
    npm install 2>$null | Out-Null
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
