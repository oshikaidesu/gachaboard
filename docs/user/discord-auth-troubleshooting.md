# Discord OAuth ログインエラー トラブルシューティング

## 症状

ログイン画面で「Sign in with Discord」を押した後、
**"Try signing in with a different account."** と表示され、ログインできない。

NextAuth がエラーページ（`/auth-error?error=Callback`）にリダイレクトする。

---

## 原因の特定

Next.js のターミナルログを確認してください。以下のいずれかのエラーが出ているはずです。

### パターン 1: `ECONNREFUSED`（最も多い）

```
PrismaClientKnownRequestError:
  code: 'ECONNREFUSED'
```

**PostgreSQL が起動していない。** ログイン処理中に `db.user.upsert()` が DB に接続できず失敗しています。

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

### 1. PostgreSQL を起動する

PostgreSQL がまだ起動していない場合は、**start スクリプトで依存サービスごと起動**してください。

- **Windows**: `start.bat` → 1（ローカル）または 2（Tailscale）を選択。PostgreSQL・MinIO・sync-server が自動で起動します。
- **Mac / Linux**: `./start.sh` または `start.command` を実行。同じく Postgres・MinIO・sync-server が起動します。

開発モードで Next.js だけ先に起動している場合は、別ターミナルで上記のいずれかを実行するか、`start.bat` / `start.sh` を一度実行してから `npm run dev` してください。PostgreSQL が起動したら `pg_isready -h localhost -p 18581`（Mac/Linux）で確認できます。

### 2. Prisma スキーマを適用する

```bash
cd nextjs-web
npx prisma migrate deploy
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
| PostgreSQL が起動しているか | `start.bat` / `start.sh` を実行したあと、`pg_isready -h localhost -p 18581`（Mac/Linux）やターミナル表示で確認 |
| DB スキーマが適用されているか | `cd nextjs-web && npx prisma migrate deploy` を実行（既存 DB の場合は 24-7-OPERATION.md の「既存の DB」を参照） |
| `.env.local` に `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` があるか | ファイルを確認 |
| `.env.local` に `NEXTAUTH_SECRET` があるか | ファイルを確認 |
| `.env.local` の `DATABASE_URL` のポートが `18581` か | `postgresql://...@localhost:18581/...` |
| Discord Developer Portal の Redirect URL | `http://localhost:18580/api/auth/callback/discord` |

---

## Tailscale 経由でスマホからアクセスする場合

Tailscale URL 経由でアクセスしている場合、Discord ログイン後にリダイレクトが正しく動作しないことがあります。

**原因:** `NEXTAUTH_URL` が `localhost` のままの場合、Discord のコールバック先も localhost となり、スマートフォン側では端末自身の localhost へリダイレクトされてしまうためです。

**対処:** アプリはリクエストの Host からベース URL を決めるため、**NEXTAUTH_URL を env で固定する必要はありません**。Discord Developer Portal の Redirects に、実際に使う URL を追加してください（例: `https://<Tailscaleホスト名>.ts.net/api/auth/callback/discord`）。複数ホストで使う場合はそれぞれ追加します。

---

## 4G で「ワークスペースが存在しない」と出る場合

**DB は共有されています。** 同じサーバー（同じ Tailscale URL）に 4G からアクセスしている限り、PostgreSQL は 1 台で、ワークスペース・ボードのデータは同じです。

**主な原因はセッション（Cookie）のオリジン違いです。**

- 自宅の PC では `http://localhost:18580` や `http://192.168.x.x:18580` で開き、スマホの 4G では `https://<ホスト名>.ts.net` で開いている
- ブラウザの Cookie は**オリジン（スキーム＋ドメイン＋ポート）ごと**に保存されるため、`localhost` でログインしたセッションは `https://xxx.ts.net` には送られない
- その結果、4G 側では「未ログイン」扱いになったり、ログインしても別セッションとして扱われ、ワークスペース一覧が空になったり「ワークスペースが存在しない」ように見える

**対処:**

1. **サーバー側**: `NEXTAUTH_URL` を 4G で使う URL にしておく（`https://<Tailscaleホスト名>.ts.net`）。`scripts/start/tailscale.sh` や `npm run env:tailscale` で設定される。
2. **4G で使う端末**: **最初から** `https://<Tailscaleホスト名>.ts.net` を開き、その URL で Discord ログインする。自宅で localhost だけ使っている場合、4G 側では一度その HTTPS URL でログインし直す。
3. 同じ URL（HTTPS）でログインしていれば、同じ DB の同じワークスペースが表示されます。

### コンソールの Hydration 警告（data-kantu）

「A tree hydrated but some attributes of the server rendered HTML didn't match」と表示され、`<html>` に `data-kantu="1"` の差分が出る場合は、**Kantu などのブラウザ拡張**が HTML を書き換えていることが原因です。認証や NEXTAUTH_URL の設定とは無関係です。拡張を無効にするか、シークレットウィンドウで開くと解消されます。無視しても動作に影響しない場合がほとんどです。

---

## 起動コマンドまとめ（毎回の手順）

```bash
# 1. 依存サービスを起動（プロジェクトルートで）
#    Windows: start.bat → 1 を選択
#    Mac/Linux: ./start.sh または start.command
#   → PostgreSQL・MinIO・sync-server が起動する

# 2. Next.js を起動（別ターミナル）
cd nextjs-web
npm run dev

# → http://localhost:18580 でアクセス
```

---

## 補足: エラーが再発する典型的なタイミング

- **PC の再起動後**: PostgreSQL 等は起動スクリプトで起動していないと停止したまま
- **長時間スリープ後**: ホストがスリープすると Postgres 等も止まる。再度 `start.bat` / `start.sh` で起動する
