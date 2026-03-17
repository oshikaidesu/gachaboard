# 👤 ユーザー・管理者向けガイド

Gachaboard の**導入・設定・運用**に関するドキュメントです。

---

## 🗺️ ガイドマップ

### 1. 導入 (Setup)
- **[SETUP.md](SETUP.md)**: **【必須】** Discord アプリの作成から起動までの全手順。
- **[WSL2-SETUP.md](WSL2-SETUP.md)**: Windows 向け WSL2 セットアップ。
- **[WSL2-RESULT.md](WSL2-RESULT.md)**: Windows での起動結果まとめ（start.bat 一発起動）。
- **[WSL2-24H-SETUP.md](WSL2-24H-SETUP.md)**: 24時間運用・AE 共存・自動起動の設定。
- **[ENV-REFERENCE.md](ENV-REFERENCE.md)**: 設定可能な環境変数の一覧と解説。

### 2. 本番ビルド・運用 (Build & Operation)
- **[PRODUCTION-BUILD.md](PRODUCTION-BUILD.md)**: 本番ビルドの作成手順（`npm start` 前の `npm run build`）。
- **[AUTO-RESTART.md](AUTO-RESTART.md)**: 落ちたときに自動で再起動する（Docker / systemd / PM2）。
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
- **[WSL2-HELP.md](WSL2-HELP.md)**: Windows（WSL2）で詰まりやすいポイントと対処法。
- **[discord-auth-troubleshooting.md](discord-auth-troubleshooting.md)**: Discord ログインで問題が発生した場合の対処方法。

---

## 📋 ドキュメント一覧

| ファイル | 概要 |
|:---|:---|
| [SETUP.md](SETUP.md) | ステップバイステップの構築ガイド |
| [WSL2-SETUP.md](WSL2-SETUP.md) | Windows 向け WSL2 セットアップ |
| [WSL2-RESULT.md](WSL2-RESULT.md) | Windows での起動結果まとめ |
| [WSL2-HELP.md](WSL2-HELP.md) | Windows（WSL2）ヘルプ・詰まりポイントと対処 |
| [WSL2-24H-SETUP.md](WSL2-24H-SETUP.md) | 24時間運用・AE 共存・自動起動 |
| [PRODUCTION-BUILD.md](PRODUCTION-BUILD.md) | 本番ビルドの作成手順 |
| [AUTO-RESTART.md](AUTO-RESTART.md) | 落ちたときに自動で再起動する |
| [24-7-OPERATION.md](24-7-OPERATION.md) | 24時間運用時の注意点 |
| [ENV-REFERENCE.md](ENV-REFERENCE.md) | 環境変数の詳細リファレンス |
| [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) | 接続モードと Tailscale の設定 |
| [ownership-design.md](ownership-design.md) | 権限設計と招待システムの仕様 |
| [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) | 認証エラーの解決策 |

---

[← ドキュメント TOP](../README.md)
