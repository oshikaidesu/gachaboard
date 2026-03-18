# Stop all Gachaboard services (PostgreSQL, MinIO, sync-server, Next.js)
$ErrorActionPreference = "SilentlyContinue"
$ports = @(18580, 18581, 18582, 18583)
foreach ($p in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
  if ($conns) {
    $conns.OwningProcess | Select-Object -Unique | ForEach-Object {
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
      Write-Host "  Port $p freed (PID $_)"
    }
  }
}
Get-Process -Name postgres, minio -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Write-Host ">>> All services stopped"
