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

# PostgreSQL コンテナを起動
cd gachaboard-compound
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

`🚀 Your database is now in sync with your Prisma schema.` が出れば OK。

### 3. Next.js を再起動（必要に応じて）

DB 接続プールがエラー状態のままの場合がある。

```bash
# Ctrl+C で停止してから
npm run dev
```

### 4. ブラウザで再試行

http://localhost:3000 を開き、Discord ログインを試す。

---

## 事前チェックリスト

| チェック項目 | 確認方法 |
|---|---|
| Docker Desktop が起動しているか | `docker ps` が実行できる |
| PostgreSQL コンテナが起動しているか | `docker compose ps` で healthy |
| DB スキーマが適用されているか | `npx prisma db push` を実行 |
| `.env.local` に `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` があるか | ファイルを確認 |
| `.env.local` に `NEXTAUTH_SECRET` があるか | ファイルを確認 |
| `.env.local` の `DATABASE_URL` のポートが `5433` か | `postgresql://...@localhost:5433/...` |
| Discord Developer Portal の Redirect URL | `http://localhost:3000/api/auth/callback/discord` |

---

## Tailscale 経由でスマホからアクセスする場合

Tailscale で `http://uooooooooooo.tail16829c.ts.net:3000` などにアクセスしているとき、Discord ログイン後に「無」に飛ばされる（リダイレクト先が効かない）ことがある。

### ワンクリックで NEXTAUTH_URL を切り替える

`.env.local` の `NEXTAUTH_URL` を **ローカル用** と **Tailscale 用** で切り替えるスクリプトがある。`nextjs-web` で以下を実行する。

| 用途 | コマンド |
|------|----------|
| ローカル開発（通常・WebSocket も動作） | `npm run env:local` |
| Tailscale（スマホからログインするとき） | `npm run env:tailscale` |

```bash
cd gachaboard-compound/nextjs-web
npm run env:local      # → NEXTAUTH_URL=http://localhost:3000
npm run env:tailscale  # → NEXTAUTH_URL=http://uooooooooooo.tail16829c.ts.net:3000
```

切り替えたら **Next.js を再起動**（`Ctrl+C` で止めてから `npm run dev`）。別の Tailscale ホストを使う場合は `TAILSCALE_HOST=desktop-hn7hdbv-1.tail16829c.ts.net npm run env:tailscale` のように環境変数で指定する。

### 原因

`NEXTAUTH_URL` が `localhost` のままだと、Discord のコールバック先も localhost になり、スマホ側の localhost（=スマホ自身）に飛んでしまうため。

### 解決手順

1. **`.env.local` の `NEXTAUTH_URL` を Tailscale URL に変更**

   ```bash
   NEXTAUTH_URL=http://uooooooooooo.tail16829c.ts.net:3000
   # または
   NEXTAUTH_URL=http://desktop-hn7hdbv-1.tail16829c.ts.net:3000
   ```

2. **Discord Developer Portal で Redirect URL を追加**

   - [Discord Developer Portal](https://discord.com/developers/applications) を開く
   - アプリを選択 → OAuth2 → Redirects
   - 「Add Redirect」で以下を追加（localhost は残しておいてよい）:
     ```
     http://uooooooooooo.tail16829c.ts.net:3000/api/auth/callback/discord
     ```
     または `desktop-hn7hdbv-1` を使う場合は:
     ```
     http://desktop-hn7hdbv-1.tail16829c.ts.net:3000/api/auth/callback/discord
     ```

3. **Next.js を再起動**

   ```bash
   npm run dev
   ```

これで Tailscale URL 経由のログイン後、正しくアプリに戻れる。

### NEXTAUTH_URL を Tailscale にしたときの WebSocket 失敗

`NEXTAUTH_URL` を Tailscale URL にすると、ブラウザは `ws://uooooooooooo.tail16829c.ts.net:3000/ws/...` に WebSocket 接続する。Next.js の rewrite は `/ws/*` を `http://sync-server:5858` に転送するが、**Docker なしで `npm run dev` している環境では** `sync-server` は名前解決できず、WebSocket がつながらない。

**対処:** いったん **`NEXTAUTH_URL=http://localhost:3000` に戻す**と、localhost 経由では WebSocket も含めて動作する。Tailscale からスマホでログインしたいときだけ Tailscale URL に切り替え、使ったら localhost に戻す運用でもよい。

### コンソールの Hydration 警告（data-kantu）

「A tree hydrated but some attributes of the server rendered HTML didn't match」で `<html>` に `data-kantu="1"` の差分が出る場合、**Kantu などのブラウザ拡張**が HTML を書き換えていることが原因。認証や NEXTAUTH_URL とは無関係。拡張を無効にするか、シークレットウィンドウで開くと出なくなる。無視しても動作には影響しないことが多い。

---

## 起動コマンドまとめ（毎回の手順）

```bash
# 1. Docker Desktop を起動（macOS）
open -a Docker
# 少し待つ（30秒程度）

# 2. PostgreSQL を起動
cd gachaboard-compound
docker compose up -d postgres

# 3. sync-server を起動（別ターミナル）
cd nextjs-web/sync-server
PORT=5858 npm run start

# 4. Next.js を起動（別ターミナル）
cd nextjs-web
npm run dev

# → http://localhost:3000 でアクセス
```

---

## 補足: エラーが再発する典型的なタイミング

- **Mac の再起動後**: Docker Desktop が自動起動しない設定の場合
- **Docker Desktop のアップデート後**: コンテナが停止していることがある
- **`docker compose down` 実行後**: 明示的に停止した場合
- **長時間スリープ後**: PostgreSQL コンテナがヘルスチェックに失敗して停止
