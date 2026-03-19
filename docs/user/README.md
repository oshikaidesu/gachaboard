# 👤 ユーザー・管理者向けガイド

Gachaboard の**導入・設定・運用**に関するドキュメントです。

---

## 🗺️ ガイドマップ

### 1. 導入 (Setup)
- **[SETUP.md](SETUP.md)**: **【必須】** Discord アプリの作成から起動までの全手順。
- **[WINDOWS-NATIVE-SETUP.md](WINDOWS-NATIVE-SETUP.md)**: Windows 起動（start.bat）。
- **[ENV-REFERENCE.md](ENV-REFERENCE.md)**: 設定可能な環境変数の一覧と解説。

### 2. 本番ビルド・運用 (Build & Operation)
- **[PRODUCTION-BUILD.md](PRODUCTION-BUILD.md)**: 本番ビルドの作成手順（`npm start` 前の `npm run build`）。
- **[AUTO-RESTART.md](AUTO-RESTART.md)**: 落ちたときに自動で再起動する（systemd / PM2）。
- **[24-7-OPERATION.md](24-7-OPERATION.md)**: 24時間運用時の注意点（プロセス管理・ディスク・バックアップ・ログ等）。

### 3. ネットワーク・アクセス (Network)
- **[ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md)**: 
  - `local`: 単一マシン（localhost）のみで利用
  - `tailscale`: Tailscale 経由で複数端末から安全にアクセス（スマートフォン対応）
  - `production`: 本番サーバーでの運用

### 4. チーム運用 (Management)
- **[ownership-design.md](ownership-design.md)**: 
  - サーバーオーナーとワークスペースオーナーの役割
  - 招待リンクによるメンバー追加の仕組み
  - 権限管理（メンバー削除・編集制限など）

### 5. トラブル解決 (Troubleshooting)
- **[discord-auth-troubleshooting.md](discord-auth-troubleshooting.md)**: Discord ログインで問題が発生した場合の対処方法。

---

## 📋 ドキュメント一覧

| ファイル | 概要 |
|:---|:---|
| [SETUP.md](SETUP.md) | ステップバイステップの構築ガイド |
| [WINDOWS-NATIVE-SETUP.md](WINDOWS-NATIVE-SETUP.md) | Windows 起動（start.bat） |
| [PRODUCTION-BUILD.md](PRODUCTION-BUILD.md) | 本番ビルドの作成手順 |
| [AUTO-RESTART.md](AUTO-RESTART.md) | 落ちたときに自動で再起動する |
| [24-7-OPERATION.md](24-7-OPERATION.md) | 24時間運用時の注意点 |
| [ENV-REFERENCE.md](ENV-REFERENCE.md) | 環境変数の詳細リファレンス |
| [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) | 接続モードと Tailscale の設定 |
| [ownership-design.md](ownership-design.md) | 権限設計と招待システムの仕様 |
| [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) | 認証エラーの解決策 |
| [UPDATE.md](UPDATE.md) | 更新手順（アプリ・ZIP・Git） |

---

[← ドキュメント TOP](../README.md)
