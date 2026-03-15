# Discord OAuth ログインエラー トラブルシューティング

## 症状

ログイン画面で「Sign in with Discord」を押した後、
**"Try signing in with a different account."** と表示され、ログインできない。

NextAuth がエラーページ（`/auth-error?error=Callback`）にリダイレクトする。

---

## 原因の特定

Next.js のターミナルログを確認する。以下のどれかが出ている。

### パターン 1: `ECONNREFUSED`（最も多い）

```
PrismaClientKnownRequestError:
  code: 'ECONNREFUSED'
```

**PostgreSQL が起動していない。** 認証コールバック内の `db.user.upsert()` が DB に接続できず失敗している。

### パターン 2: テーブルが存在しない

```
relation "User" does not exist
```

PostgreSQL は起動しているが、Prisma のスキーマが適用されていない。

### パターン 3: Discord OAuth の設定不正

```
[next-auth][error][OAUTH_CALLBACK_ERROR]
  error: invalid_grant
```

Discord Developer Portal の設定が間違っている。

---

## 解決手順

### 1. Docker (PostgreSQL) を起動する

```bash
# Docker Desktop を起動（macOS）
open -a Docker

# PostgreSQL コンテナを起動（プロジェクトルートで）
docker compose up -d postgres

# 起動確認
docker compose ps
# STATUS が "Up ... (healthy)" になるまで待つ
```

### 2. Prisma スキーマを適用する

```bash
cd nextjs-web
npx prisma db push
```

`🚀 Your database is now in sync with your Prisma schema.` と表示されれば、スキーマの適用は成功しています。

### 3. Next.js を再起動（必要に応じて）

DB 接続プールがエラー状態のままの場合がある。

```bash
# Ctrl+C で停止してから
npm run dev
```

### 4. ブラウザで再試行

http://localhost:18580 を開き、Discord ログインを試す。

---

## 事前チェックリスト

| チェック項目 | 確認方法 |
|---|---|
| Docker Desktop が起動しているか | `docker ps` が実行できる |
| PostgreSQL コンテナが起動しているか | `docker compose ps` で healthy |
| DB スキーマが適用されているか | `npx prisma db push` を実行 |
| `.env.local` に `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` があるか | ファイルを確認 |
| `.env.local` に `NEXTAUTH_SECRET` があるか | ファイルを確認 |
| `.env.local` の `DATABASE_URL` のポートが `18581` か | `postgresql://...@localhost:18581/...` |
| Discord Developer Portal の Redirect URL | `http://localhost:18580/api/auth/callback/discord` |

---

## Tailscale 経由でスマホからアクセスする場合

Tailscale URL 経由でアクセスしている場合、Discord ログイン後にリダイレクトが正しく動作しないことがあります。

**原因:** `NEXTAUTH_URL` が `localhost` のままの場合、Discord のコールバック先も localhost となり、スマートフォン側では端末自身の localhost へリダイレクトされてしまうためです。

**対処:** [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) の「tailscale モード」を参照し、`npm run env:tailscale` で NEXTAUTH_URL を切り替え、Discord Redirect に `https://<Tailscaleホスト名>/api/auth/callback/discord` を追加してください。

### コンソールの Hydration 警告（data-kantu）

「A tree hydrated but some attributes of the server rendered HTML didn't match」と表示され、`<html>` に `data-kantu="1"` の差分が出る場合は、**Kantu などのブラウザ拡張**が HTML を書き換えていることが原因です。認証や NEXTAUTH_URL の設定とは無関係です。拡張を無効にするか、シークレットウィンドウで開くと解消されます。無視しても動作に影響しない場合がほとんどです。

---

## 起動コマンドまとめ（毎回の手順）

```bash
# 1. Docker Desktop を起動（macOS）
open -a Docker
# 少し待つ（30秒程度）

# 2. PostgreSQL を起動（プロジェクトルートで）
docker compose up -d postgres

# 3. sync-server を起動（別ターミナル）
cd nextjs-web/sync-server
PORT=18582 npm run start

# 4. Next.js を起動（別ターミナル）
cd nextjs-web
npm run dev

# → http://localhost:18580 でアクセス
```

---

## 補足: エラーが再発する典型的なタイミング

- **Mac の再起動後**: Docker Desktop が自動起動しない設定の場合
- **Docker Desktop のアップデート後**: コンテナが停止していることがある
- **`docker compose down` 実行後**: 明示的に停止した場合
- **長時間スリープ後**: PostgreSQL コンテナがヘルスチェックに失敗して停止
