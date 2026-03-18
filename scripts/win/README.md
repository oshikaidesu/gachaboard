# Windows 起動スクリプト

## 構成

| ファイル | 説明 |
|----------|------|
| **run.ps1** | メイン起動（PostgreSQL/MinIO/sync-server + Next.js） |
| **reset-services.ps1** | 全サービス停止 |
| **sync-env-tailscale.ps1** | Tailscale HTTPS 用 .env.local 更新 |
| **setup-auto-start.ps1** | ログオン時自動起動のタスク登録 |

## 入り口

**start.bat**（プロジェクトルート）が唯一の起動入口です。

| 番号 | 内容 |
|------|------|
| 1 | ローカル起動 (localhost) |
| 2 | Tailscale HTTPS 起動 |
| 3 | リセットして再起動 |
| 0 | 終了 |

## 直接実行

`start.bat 1` のように番号を渡すとメニューをスキップして実行できます。

## 自動起動

```powershell
.\scripts\win\setup-auto-start.ps1
```
