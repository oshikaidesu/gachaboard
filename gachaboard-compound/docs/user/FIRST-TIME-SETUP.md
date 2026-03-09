# 初回セットアップガイド

> 初めて Gachaboard を動かす方向けのチェックリスト形式ガイド。

---

## 事前準備チェックリスト

以下が揃っているか確認してください。

- [ ] **Node.js 18 以上** … `node -v` で確認
- [ ] **Docker** … [Docker Desktop](https://www.docker.com/products/docker-desktop/) をインストールし、起動できること
- [ ] **Discord アカウント** … ログインに使用

---

## ステップ 1: リポジトリをクローン

```bash
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard
```

（または既にクローン済みなら `cd gachaboard-compound`）

---

## ステップ 2: Discord OAuth アプリを作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にログイン
2. 「New Application」をクリックし、名前を入力して作成
3. 左メニュー「OAuth2」→「Redirects」を開く
4. 「Add Redirect」で以下を追加:
   ```
   http://localhost:3000/api/auth/callback/discord
   ```
5. 「OAuth2」→「General」で **Client ID** と **Client Secret** をコピー（後で使います）

**ここまでで OK:** Redirect に `http://localhost:3000/api/auth/callback/discord` が表示されていれば OK。

---

## ステップ 3: 環境変数を設定

```bash
cd gachaboard-compound/nextjs-web
cp env.local.template .env.local
```

`.env.local` を編集し、以下を埋めます。

| 変数 | どこで取得 | 例 |
|------|------------|-----|
| `DISCORD_CLIENT_ID` | ステップ 2 でコピー | `1234567890123456789` |
| `DISCORD_CLIENT_SECRET` | 同上 | `abcdef123456...` |
| `NEXTAUTH_SECRET` | 下記コマンドで生成 | `openssl rand -base64 32` の出力 |
| `NEXTAUTH_URL` | そのまま | `http://localhost:3000` |
| `DATABASE_URL` | そのまま（Docker 用） | `postgresql://gachaboard:gachaboard@localhost:5433/gachaboard` |
| `SERVER_OWNER_DISCORD_ID` | 任意。自分の Discord ID を入れるとオーナー限定になる | 未設定でも可 |

**ストレージ（S3/MinIO）:** `env.local.template` にデフォルト値が入っています。そのままで OK。MinIO は Docker で起動します（ステップ 4）。

NEXTAUTH_SECRET の生成:

```bash
openssl rand -base64 32
```

**ここまでで OK:** `.env.local` に上記が入っていれば OK。詳細は [ENV-REFERENCE.md](ENV-REFERENCE.md) を参照。

---

## ステップ 4: Docker でインフラを起動

```bash
cd gachaboard-compound
docker compose up -d
```

postgres、sync-server、MinIO が起動します。

起動確認:

```bash
docker compose ps
```

`postgres`、`sync-server`、`minio` の STATUS が `Up` または `healthy` になっていれば OK。

---

## ステップ 5: アプリをセットアップ・起動

```bash
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
npm run dev
```

**ここまでで OK:** ターミナルに `Ready` と表示され、ブラウザで http://localhost:3000 を開けること。

---

## ステップ 6: ログインして動作確認

1. http://localhost:3000 を開く
2. 「Sign in with Discord」をクリック
3. Discord でログイン
4. ワークスペースを作成 → ボードを作成 → 編集できることを確認

**ここまでで OK:** ボード上にシェイプを置けて、保存できればセットアップ完了です。

---

## 分岐: Tailscale でスマホからアクセスしたい場合

PC の localhost だけでなく、スマホや他端末から Tailscale 経由でアクセスしたい場合は以下を追加で行います。

### 6a. Tailscale のホスト名を調べる

```bash
tailscale status --json --peers=false | jq -r .Self.DNSName
```

出力例: `your-machine.tail12345.ts.net`（`jq` がなければ [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) の「Tailscale ホスト名の調べ方」を参照）

### 6b. NEXTAUTH_URL を切り替え

```bash
cd nextjs-web
TAILSCALE_HOST=your-machine.tail12345.ts.net npm run env:tailscale
```

（ホスト名は 6a で調べた値に置き換え。未指定時はスクリプトが自動検出を試みます）

### 6c. Discord Redirect を追加

Discord Developer Portal → OAuth2 → Redirects に以下を追加:

```
http://your-machine.tail12345.ts.net:3000/api/auth/callback/discord
```

### 6d. Next.js を再起動

`Ctrl+C` で止めてから `npm run dev` で再起動。

### 6e. スマホでアクセス

スマホに Tailscale を入れ、同じアカウントでログイン。ブラウザで `http://your-machine.tail12345.ts.net:3000` にアクセス。

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| Discord ログイン後にエラー | [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) を参照 |
| PostgreSQL 接続エラー | Docker が起動しているか `docker compose ps` で確認。`docker compose up -d postgres` で再起動 |
| ポートが使われている | 3000, 5433, 5858 が他プロセスで使用されていないか確認 |

---

## 関連ドキュメント

- [ENV-REFERENCE.md](ENV-REFERENCE.md) - 環境変数の詳細
- [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) - 運用モード（local / tailscale / production）
- [GETTING-STARTED.md](GETTING-STARTED.md) - 開発者向け詳細セットアップ
- [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) - 認証エラーの対処
