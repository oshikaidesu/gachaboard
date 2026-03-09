# Gachaboard

**音楽・映像・デザインファイルを貼り付けて共有できる、リアルタイム共同ホワイトボード**

Discord コミュニティや身内チーム向け。URL を共有すれば、誰でも同じボードで動画・音声・テキスト・画像を並べて共同編集できます。ローカルサーバー 1 台で完結し、クラウド依存を最小限に抑えた設計です。

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)

---

## ✨ できること

| 機能 | 説明 |
|------|------|
| **ファイル共有** | 動画・音声・テキスト・画像をドラッグ＆ドロップでボードに配置 |
| **リアルタイム共同編集** | 複数人が同時に同じボードを編集。マルチカーソルで誰がどこにいるか表示 |
| **メディアプレビュー** | 動画は 720p に変換、音声は波形表示。テキストはそのままプレビュー |
| **コメント・リアクション** | 動画・音声のタイムラインにコメント、シェイプにリアクション |
| **接続ハンドル** | draw.io 風の接続点でシェイプ同士を矢印でつなげる |
| **ワークスペース** | プロジェクト単位でボードをグループ管理 |

---

## 🚀 クイックスタート

**初めての方は [docs/FIRST-TIME-SETUP.md](docs/FIRST-TIME-SETUP.md) を参照**（チェックリスト形式のセットアップガイド）。

### 必要なもの

- Node.js 18+
- Docker（PostgreSQL と sync-server を起動する場合）
- Discord アプリ（認証に使用）

### 1. リポジトリをクローン

```bash
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard
```

### 2. 環境変数を設定

```bash
cp nextjs-web/env.local.template nextjs-web/.env.local
# .env.local を編集して Discord OAuth や DB 接続を設定
```

**最低限必要な設定：**

- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`（[Discord Developer Portal](https://discord.com/developers/applications) で作成）
- `NEXTAUTH_SECRET`（任意の長いランダム文字列）
- `NEXTAUTH_URL`（ローカルなら `http://localhost:3000`）
- `DATABASE_URL`（PostgreSQL 接続文字列）
- `SERVER_OWNER_DISCORD_ID`（任意）サーバーオーナーの Discord ID。未設定なら全ログインユーザーが WS にアクセス可。設定時はオーナーのみ WS 一覧・作成が可能。詳しくは [ownership-design.md](docs/ownership-design.md)

### 3. インフラを起動（Docker）

```bash
docker compose up -d
```

postgres、sync-server、MinIO が起動します。ファイルアップロードには MinIO が必須です。

### 4. アプリを起動

```bash
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開き、Discord でログイン → ワークスペース作成 → ボード作成 → 編集開始。

---

## 📁 プロジェクト構成

```
gachaboard-compound/
├── nextjs-web/          # メインアプリ（Next.js + compound + API）
├── sync-server/         # リアルタイム同期用 WebSocket サーバ
├── docs/                # ドキュメント
└── docker-compose.yml   # PostgreSQL / sync-server / MinIO
```

---

## 📚 ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [docs/README.md](docs/README.md) | ドキュメント索引 |
| [FIRST-TIME-SETUP.md](docs/FIRST-TIME-SETUP.md) | 初回セットアップ（未経験者向け） |
| [GETTING-STARTED.md](docs/GETTING-STARTED.md) | 開発環境の詳細セットアップ |
| [ENV-REFERENCE.md](docs/ENV-REFERENCE.md) | 環境変数リファレンス |
| [ENV-AND-DEPLOYMENT-MODES.md](docs/ENV-AND-DEPLOYMENT-MODES.md) | 運用モード（local / tailscale / production） |
| [CONCEPT.md](docs/CONCEPT.md) | プロジェクトのコンセプトと設計思想 |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | システムアーキテクチャ |
| [HANDOVER.md](docs/HANDOVER.md) | 引き継ぎ用の体系的ドキュメント |
| [GLOSSARY.md](docs/GLOSSARY.md) | 用語集 |

### 技術仕様

- [yjs-system-specification.md](docs/yjs-system-specification.md) - Yjs 同期の詳細仕様
- [discord-auth-troubleshooting.md](docs/discord-auth-troubleshooting.md) - Discord 認証のトラブルシューティング

---

## 🛠 技術スタック

- **フロント**: Next.js 16, React 18, compound（tldraw 系ホワイトボード）
- **認証**: NextAuth + Discord OAuth
- **DB**: PostgreSQL + Prisma
- **リアルタイム同期**: Yjs + y-websocket
- **ストレージ**: S3 / MinIO（Presigned URL で直接アップロード）

---

## 📄 ライセンス

Apache 2.0（compound / tldraw ベース）
