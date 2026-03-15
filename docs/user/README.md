# 👤 ユーザー・管理者向けガイド

Gachaboard の**導入・設定・運用**に関するドキュメントです。

---

## 🗺️ ガイドマップ

### 1. 導入 (Setup)
- **[SETUP.md](SETUP.md)**: **【必須】** Discord アプリの作成から起動までの全手順。
- **[ENV-REFERENCE.md](ENV-REFERENCE.md)**: 設定可能な環境変数の一覧と解説。

### 2. 本番ビルド (Build)
- **[PRODUCTION-BUILD.md](PRODUCTION-BUILD.md)**: 本番ビルドの作成手順（`npm start` 前の `npm run build`）。

### 3. ネットワーク・アクセス (Network)
- **[ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md)**: 
  - `local`: 自分だけで使う
  - `tailscale`: 仲間と安全に繋ぐ（スマホ対応）
  - `production`: 本格運用

### 4. チーム運用 (Management)
- **[ownership-design.md](ownership-design.md)**: 
  - サーバーオーナーとワークスペースオーナーの違い
  - 招待リンクによるメンバー追加の仕組み
  - 権限管理（キック・編集制限など）

### 5. トラブル解決 (Troubleshooting)
- **[discord-auth-troubleshooting.md](discord-auth-troubleshooting.md)**: Discord ログインがうまくいかない場合の対処法。

---

## 📋 ドキュメント一覧

| ファイル | 概要 |
|:---|:---|
| [SETUP.md](SETUP.md) | ステップバイステップの構築ガイド |
| [PRODUCTION-BUILD.md](PRODUCTION-BUILD.md) | 本番ビルドの作成手順 |
| [ENV-REFERENCE.md](ENV-REFERENCE.md) | 環境変数の詳細リファレンス |
| [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) | 接続モードと Tailscale の設定 |
| [ownership-design.md](ownership-design.md) | 権限設計と招待システムの仕様 |
| [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) | 認証エラーの解決策 |

---

[← ドキュメント TOP](../README.md)
