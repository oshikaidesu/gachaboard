# WSL2 仮想ディスク（vhdx）の圧縮
# 削除したファイルの容量を戻す。通常のディスクと違い、WSL2 は自動で縮まない
#
# 実行: 管理者 PowerShell で
#   .\scripts\setup\wsl2-compact.ps1
#
# 注意: WSL がシャットダウンされ、実行中の Gachaboard 等は停止する

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host ">>> WSL2 仮想ディスクの圧縮" -ForegroundColor Cyan
Write-Host ""

# WSL をシャットダウン
Write-Host "1. WSL をシャットダウンしています..." -ForegroundColor Yellow
wsl --shutdown
Start-Sleep -Seconds 3

# vhdx を検索
$packagesPath = "$env:LOCALAPPDATA\Packages"
$vhdxPaths = Get-ChildItem -Path $packagesPath -Filter "ext4.vhdx" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match "LocalState" }

if ($vhdxPaths.Count -eq 0) {
  Write-Host "エラー: ext4.vhdx が見つかりません" -ForegroundColor Red
  exit 1
}

foreach ($vhdx in $vhdxPaths) {
  $path = $vhdx.FullName
  $sizeBefore = [math]::Round($vhdx.Length / 1GB, 2)
  Write-Host "2. 圧縮対象: $path" -ForegroundColor Gray
  Write-Host "   現在のサイズ: ${sizeBefore} GB" -ForegroundColor Gray

  # Optimize-VHD（Hyper-V がある場合）
  if (Get-Command Optimize-VHD -ErrorAction SilentlyContinue) {
    Write-Host "3. Optimize-VHD で圧縮中..." -ForegroundColor Yellow
    Optimize-VHD -Path $path -Mode Full
  } else {
    # diskpart で圧縮（Hyper-V がなくても動く）
    Write-Host "3. diskpart で圧縮中..." -ForegroundColor Yellow
    $diskpartScript = @"
select vdisk file="$path"
compact vdisk
exit
"@
    $diskpartScript | diskpart
  }

  $vhdx.Refresh()
  $sizeAfter = [math]::Round($vhdx.Length / 1GB, 2)
  Write-Host "   圧縮後: ${sizeAfter} GB" -ForegroundColor Green
}

Write-Host ""
Write-Host "✓ 完了。WSL を起動すると Gachaboard 等を再起動してください。" -ForegroundColor Green
Write-Host ""
