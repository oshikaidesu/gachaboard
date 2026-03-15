# 環境変数リファレンス

> Gachaboard で使用する環境変数の一覧。`nextjs-web/.env.local` に設定します。

---

## 必須変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DISCORD_CLIENT_ID` | Discord OAuth の Client ID。[Discord Developer Portal](https://discord.com/developers/applications) でアプリ作成後、OAuth2 から取得 | `1234567890123456789` |
| `DISCORD_CLIENT_SECRET` | Discord OAuth の Client Secret。同上 | `abcdef123456...` |
| `NEXTAUTH_SECRET` | セッション暗号化用。任意の長いランダム文字列。`openssl rand -base64 32` で生成可 | `xYz123...` |
| `NEXTAUTH_URL` | アプリのベース URL。ブラウザでアクセスする URL と一致させる | モード別は下表参照 |
| `DATABASE_URL` | PostgreSQL 接続文字列 | `postgresql://gachaboard:gachaboard@localhost:5433/gachaboard` |

---

## オプション変数

### 認証・権限

| 変数名 | デフォルト | 説明 |
|--------|------------|------|
| `SERVER_OWNER_DISCORD_ID` | （未設定） | サーバーオーナーの Discord ID。設定時はこのユーザーのみワークスペース一覧・作成が可能。未設定なら全ログインユーザーがアクセス可。詳細は [ownership-design.md](ownership-design.md) |

### データベース・ストレージ

| 変数名 | デフォルト | 説明 |
|--------|------------|------|
| `MAX_UPLOAD_SIZE` | `107374182400` (100GB) | アップロード上限（バイト）。stem 等の大容量ファイル用 |

### S3 / MinIO（必須）

ファイルアップロードには S3/MinIO が必須です。`env.local.template` にデフォルト値が入っています。`docker compose up -d` で MinIO を起動してください。

| 変数名 | デフォルト | 説明 |
|--------|------------|------|
| `S3_BUCKET` | （空） | バケット名。Docker MinIO のデフォルトは `my-bucket` |
| `AWS_ACCESS_KEY_ID` | （空） | MinIO の場合は `minioadmin` |
| `AWS_SECRET_ACCESS_KEY` | （空） | MinIO の場合は `minioadmin` |
| `S3_ENDPOINT` | （空） | Next.js が MinIO に接続する URL。`npm run dev` 時は `http://localhost:9000`、Next.js を Docker 内で動かすときは `http://minio:9000` |
| `S3_REGION` | `us-east-1` | リージョン。MinIO は `us-east-1` 等でよい |
| `S3_PUBLIC_URL` | `http://localhost:9000` | ブラウザが Presigned URL でアクセスするベース URL。**重要**: アップロード・配信ともクライアントは S3 に直接アクセスし、認可は Next.js API が Presigned URL 発行で行う |

### 同期（sync-server）

| 変数名 | デフォルト | 説明 |
|--------|------------|------|
| `SYNC_SERVER_URL` | `http://sync-server:5858` | サーバー内部から sync-server への URL。Docker 内では `sync-server`、ローカル単体では `http://localhost:5858` |
| `NEXT_PUBLIC_SYNC_WS_URL` | `ws://localhost:5858` | クライアント用 WebSocket URL。localhost では直接接続。Tailscale 等では `/ws` 経由で Next.js が転送 |
| `SYNC_SERVER_INTERNAL_URL` | `http://127.0.0.1:5858` | Next.js の `/ws` リライト先。`npm run dev` 時は localhost。Next.js を Docker 内で動かすときは `http://sync-server:5858` |

---

## モード別推奨値

運用モードの詳細は [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) を参照。

| 変数 | local | tailscale | production |
|------|-------|-----------|------------|
| `NEXTAUTH_URL` | `http://localhost:3000` | `https://<自分のTailscaleホスト>`（Caddy 前提） | `https://...` または `http://<IP or ドメイン>:3000` |
| `S3_PUBLIC_URL` | `http://localhost:9000` | `https://<自分のTailscaleホスト>/minio` | 本番の MinIO/S3 公開 URL |
| `DATABASE_URL` | `postgresql://gachaboard:gachaboard@localhost:5433/gachaboard` | 同上 | 本番 DB の接続文字列 |
| `NEXT_PUBLIC_SYNC_WS_URL` | `ws://localhost:5858` | （自動: 同一オリジン `/ws` を使用） | 同上 |

`npm run env:local` / `npm run env:tailscale` で NEXTAUTH_URL と S3_PUBLIC_URL を一括切り替えできます。

---

## 取得手順の例

### NEXTAUTH_SECRET の生成

```bash
openssl rand -base64 32
```

### Discord Client ID / Secret

1. [Discord Developer Portal](https://discord.com/developers/applications) にログイン
2. 「New Application」でアプリを作成
3. OAuth2 → Redirects に `http://localhost:3000/api/auth/callback/discord` を追加（Tailscale 使用時は別途追加）
4. OAuth2 → General で Client ID と Client Secret をコピー

### サーバーオーナーの Discord ID

1. Discord で「開発者モード」を有効化（設定 → アプリの設定 → 詳細）
2. 自分のプロフィールを右クリック → 「ID をコピー」

---

## 関連ドキュメント

- [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) - 運用モード（local / tailscale / production）の説明
- [SETUP.md](SETUP.md) - 初回セットアップの手順
- [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) - 認証エラーのトラブルシューティング
