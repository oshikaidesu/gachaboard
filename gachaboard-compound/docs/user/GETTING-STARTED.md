# 開発環境セットアップ

> 開発者が Gachaboard をローカルで動かすための詳細手順。

**初回セットアップ**は [FIRST-TIME-SETUP.md](FIRST-TIME-SETUP.md) を参照。**環境変数の詳細**は [ENV-REFERENCE.md](ENV-REFERENCE.md) を参照。

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

必須変数: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`

全変数の一覧・モード別推奨値は [ENV-REFERENCE.md](ENV-REFERENCE.md) を参照。

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
docker compose up -d
```

- postgres: `localhost:5433`
- sync-server: `localhost:5858`
- minio: `localhost:9000`（ファイルアップロードに必須）

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

## 5. ファイル保存（MinIO）

アップロードは MinIO（S3 互換）に保存されます。`docker compose up -d` で MinIO を起動してください。

ffmpeg が入っていないと動画・音声の変換は失敗します。

---

## 6. Tailscale 経由でアクセス（スマホ等）

運用モード・Tailscale ホスト名の調べ方・切り替え手順は [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) を参照。

```bash
cd nextjs-web
npm run env:tailscale   # Tailscale ホストに切り替え（未指定時は自動検出を試みる）
# 切り替えたら Next.js を再起動
```

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
