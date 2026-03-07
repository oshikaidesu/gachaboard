# 開発環境セットアップ

> 開発者が Gachaboard をローカルで動かすための詳細手順。

---

## 1. 前提条件

- **Node.js** 18 以上
- **Docker** と Docker Compose（PostgreSQL, sync-server 用）
- **Discord アプリケーション**（OAuth 用。[Discord Developer Portal](https://discord.com/developers/applications) で作成）
- **ffmpeg**（動画・音声変換用。`fluent-ffmpeg` が利用）

---

## 2. Discord OAuth の設定

1. [Discord Developer Portal](https://discord.com/developers/applications) でアプリを作成
2. OAuth2 → Redirects に `http://localhost:3000/api/auth/callback/discord` を追加
3. Client ID と Client Secret を取得

---

## 3. 環境変数

```bash
cp nextjs-web/env.local.template nextjs-web/.env.local
```

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `DISCORD_CLIENT_ID` | ○ | Discord OAuth Client ID |
| `DISCORD_CLIENT_SECRET` | ○ | Discord OAuth Client Secret |
| `NEXTAUTH_SECRET` | ○ | セッション暗号化用（任意の長いランダム文字列） |
| `NEXTAUTH_URL` | ○ | アプリ URL（ローカル: `http://localhost:3000`） |
| `DATABASE_URL` | ○ | PostgreSQL 接続文字列 |
| `NEXT_PUBLIC_SYNC_WS_URL` | - | sync-server の WebSocket URL（例: `ws://localhost:5858`） |
| `SERVER_OWNER_DISCORD_ID` | - | サーバーオーナーの Discord ID。未設定なら全員アクセス可。設定時はオーナーのみ WS にアクセス。運用詳細は [ownership-design.md](ownership-design.md) |
| `S3_BUCKET` 等 | - | 未設定ならローカル `uploads/` に保存 |

**Docker Compose 利用時の DATABASE_URL 例:**

```
postgresql://gachaboard:gachaboard@localhost:5433/gachaboard
```

（Docker は 5433 をホストにマッピング、postgres のデフォルトは 5432）

---

## 4. 起動手順

### 4.1 インフラ（Docker）

```bash
cd gachaboard-compound
docker compose up -d postgres sync-server
```

- postgres: `localhost:5433`
- sync-server: `localhost:5858`

MinIO を使う場合:

```bash
docker compose up -d
```

### 4.2 アプリ（nextjs-web）

```bash
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push   # 初回またはスキーマ変更時
npm run dev
```

http://localhost:3000 でアクセス。

---

## 5. ローカル保存でプレビュー

S3 系を設定しないと、アップロードは `nextjs-web/uploads/` に保存されます。

- `uploads/assets/` - 元ファイル
- `uploads/converted/` - 変換後（mp3, 720p mp4）
- `uploads/thumbnails/` - 動画サムネイル
- `uploads/waveforms/` - 音声波形 JSON

ffmpeg が入っていないと動画・音声の変換は失敗します。

---

## 6. Tailscale 経由でアクセス（スマホ等）

1. `NEXTAUTH_URL` を Tailscale の URL に変更（例: `http://xxx.tail16829c.ts.net:3000`）
2. Discord OAuth の Redirect に同じ URL を追加
3. `nextjs-web` で `npm run env:tailscale` で切り替え可能（`scripts/switch-env.sh`）

詳細は [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md)。

---

## 7. sync-server を単体で起動

```bash
cd gachaboard-compound/nextjs-web
# sync-server は nextjs-web 内
cd sync-server
npm install
PORT=5858 HOST=0.0.0.0 npm start
```

Docker を使わない場合は、PostgreSQL と sync-server を別途用意する必要があります。

---

## 8. テスト

```bash
cd nextjs-web
npm run e2e:server   # 別ターミナルでサーバ起動
npm run test:e2e     # E2E テスト実行
```
