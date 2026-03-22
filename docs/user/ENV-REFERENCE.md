# 環境変数リファレンス

> Gachaboard で使う環境変数は **`nextjs-web/.env.local`** に置きます。ルートの `.env.example` がテンプレートです。`npm run setup:env` で `.env.local` を作成し、ポート・DB・S3 派生値を同期できます。

---

## 必須変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DISCORD_CLIENT_ID` | Discord OAuth の Client ID。[Discord Developer Portal](https://discord.com/developers/applications) でアプリ作成後、OAuth2 から取得 | `1234567890123456789` |
| `DISCORD_CLIENT_SECRET` | Discord OAuth の Client Secret。同上 | `abcdef123456...` |
| `NEXTAUTH_SECRET` | セッション暗号化用。任意の長いランダム文字列。`openssl rand -base64 32` で生成できます。 | `xYz123...` |
| `NEXTAUTH_URL` | アプリのベース URL。**未設定可**：未設定時はリクエストの Host（Tailscale serve 等）から自動的に判別するため、HTTPS のみ使うなら env で固定する必要はありません。スクリプトやフォールバック用に設定してもよい。 | モード別は下表参照 |
| `DATABASE_URL` | PostgreSQL 接続文字列 | `postgresql://gachaboard:gachaboard@localhost:18581/gachaboard` |

---

## オプション変数

### ポート・バインド（他サービスと衝突する場合 / Tailscale）

| 変数 | 設定場所 | デフォルト | 説明 |
|------|----------|------------|------|
| `HOST_BIND` | `nextjs-web/.env.local` | `127.0.0.1` | 各サービスの待機 IP（バインド先）。**Tailscale で他端末から直に届けたい場合は `0.0.0.0`**。テンプレはルートの `.env.example`（`npm run setup:env` で `.env.local` にコピー）。 |
| `PORT` | `nextjs-web/.env.local` | `18580` | Next.js のポート |
| `POSTGRES_HOST_PORT` | `nextjs-web/.env.local` | `18581` | PostgreSQL。`DATABASE_URL` のポートと一致させる |
| `SYNC_SERVER_HOST_PORT` | `nextjs-web/.env.local` | `18582` | sync-server。`NEXT_PUBLIC_SYNC_WS_URL` のポートと一致させる |
| `MINIO_API_HOST_PORT` | `nextjs-web/.env.local` | `18583` | MinIO。`S3_ENDPOINT` / `S3_PUBLIC_URL` のポートと一致させる |
| `MINIO_CONSOLE_HOST_PORT` | `nextjs-web/.env.local` | `18584` | MinIO 管理 UI |

他サービス（AE、他プロジェクト等）とポートが衝突する場合、上記ポート変数で変更できます。

**自動同期**: `PORT`、`POSTGRES_HOST_PORT`、`SYNC_SERVER_HOST_PORT`、`MINIO_API_HOST_PORT` を編集するだけで、`DATABASE_URL`、`S3_*`、`NEXT_PUBLIC_SYNC_WS_URL` 等は `npm run setup:env` および起動時に自動反映されます。手動で合わせる必要はありません。

### 開発用（Next.js）

| 変数名 | デフォルト | 説明 |
|--------|------------|------|
| `ALLOWED_DEV_ORIGINS` | （未設定） | 開発時の Hot Reload 等で許可するオリジン。カンマ区切り（例: `https://a.tailxxx.ts.net,https://b.tailxxx.ts.net`）。未設定時は空配列 |
| `E2E_TEST_MODE` | （未設定） | E2E テスト用の認証バイパス。`1` のとき `X-E2E-User-Id` 等で擬似セッションを生成。**本番では使用禁止**（本番起動時にエラーで無効化されます） |

### 認証・権限

| 変数名 | デフォルト | 説明 |
|--------|------------|------|
| `SERVER_OWNER_DISCORD_ID` | （未設定） | サーバーオーナーの Discord ID。設定時はこのユーザーのみワークスペース一覧・作成が可能。未設定なら全ログインユーザーがアクセス可。詳細は [ownership-design.md](ownership-design.md) |
| `CREDENTIAL_ROTATION` | （未設定） | `1` または `true` で起動毎に **PostgreSQL パスワード**と **MinIO 用アプリ IAM ユーザー**（`mc` で作成）をローテーション。`.env.local` の `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` は実行時に `data/.runtime-s3-env` が上書き。MinIO **ルート**（`minioadmin`）は既存データ互換のため据え置き（127.0.0.1 のみバインド）。`data/postgres/.db-password`・`data/minio/.app-s3-user` を参照。 |

### データベース・ストレージ

| 変数名 | デフォルト | 説明 |
|--------|------------|------|
| `MAX_UPLOAD_SIZE` | `107374182400` (100GB) | アップロード上限（バイト）。stem 等の大容量ファイル用 |

### S3 / MinIO（必須）

ファイルアップロードには S3/MinIO が必須です。`nextjs-web/env.local.template` およびルートの `.env.example` にデフォルト値があります。MinIO は `scripts/entry/start.bat` / `scripts/entry/start.sh` 実行時に自動で起動します。

| 変数名 | デフォルト | 説明 |
|--------|------------|------|
| `S3_BUCKET` | （空） | バケット名。MinIO のデフォルトは `my-bucket` |
| `AWS_ACCESS_KEY_ID` | （空） | MinIO の場合は `minioadmin` |
| `AWS_SECRET_ACCESS_KEY` | （空） | MinIO の場合は `minioadmin` |
| `S3_ENDPOINT` | （空） | Next.js が MinIO に接続する URL。通常は `http://localhost:18583`（ポート変更時は `MINIO_API_HOST_PORT` に合わせる） |
| `S3_REGION` | `us-east-1` | リージョン。MinIO は `us-east-1` 等でよい |
| `S3_PUBLIC_URL` | `http://localhost:18583` | ブラウザが Presigned URL でアクセスするベース URL。**重要**: アップロード・配信ともクライアントは S3 に直接アクセスし、Next.js API が Presigned URL を発行してアクセスを許可します。 |

### 同期（sync-server / Hocuspocus）

sync-server は [Hocuspocus](https://github.com/ueberdosis/hocuspocus) ベースです。認証・永続化（SQLite）・接続数制限を内蔵しています。

| 変数名 | デフォルト | 説明 |
|--------|------------|------|
| `SYNC_SERVER_URL` | `http://127.0.0.1:18582` | サーバー内部から sync-server への URL。通常は `http://localhost:18582`（`SYNC_SERVER_HOST_PORT` に合わせる） |
| `NEXT_PUBLIC_SYNC_WS_URL` | `ws://localhost:18582` | クライアント用 WebSocket URL。localhost では直接接続。Tailscale 等では `/ws` 経由で Next.js が転送 |
| `SYNC_SERVER_INTERNAL_URL` | `http://127.0.0.1:18582` | Next.js の `/ws` リライト先。通常は `http://127.0.0.1:18582`（sync-server のホストポート） |
| `SYNC_MAX_CLIENTS_PER_ROOM` | `100` | 1ボードあたりの最大同時 WebSocket 接続数。超過時は拒否。sync-server の環境変数で渡す（起動スクリプトが設定） |
| `YPERSISTENCE` | `sync-server/sync-data`（CWD 基準） | Y.Doc 永続化用 SQLite の配置ディレクトリ。`nextjs-web/sync-server` から起動なら `nextjs-web/sync-server/sync-data` |

### 運用・チューニング

| 変数名 | デフォルト | 説明 |
|--------|------------|------|
| `FFMPEG_MAX_CONCURRENT` | `10` | 動画・音声変換（ffmpeg）の同時実行数上限。Next.js の `nextjs-web/.env.local` で設定 |

---

## 本番デプロイ時の必須変更

本番で使用する前に、以下の認証情報をデフォルトから変更してください。詳細は [SECURITY.md](../../SECURITY.md) の「本番デプロイ時の推奨事項」を参照。

| 対象 | 環境変数 | 説明 |
|------|----------|------|
| PostgreSQL | `DATABASE_URL` | 接続文字列内のパスワード（デフォルト `gachaboard`）を変更 |
| MinIO | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | デフォルトの `minioadmin` を変更 |
| NextAuth | `NEXTAUTH_SECRET` | 推測困難な長い乱数（例: `openssl rand -base64 32`）に設定 |

---

## モード別推奨値

運用モードの詳細は [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) を参照してください。

| 変数 | local | tailscale | production |
|------|-------|-----------|------------|
| `NEXTAUTH_URL` | 未設定可（リクエストの Host から自動）。フォールバック用に `http://localhost:18580` を設定しても可 | 未設定可（Tailscale serve 等でアクセスした Host から自動） | 未設定可（同上） |
| `S3_PUBLIC_URL` | `http://localhost:18583` | `https://<Tailscaleホスト名>/minio` | 本番の MinIO/S3 公開 URL |
| `DATABASE_URL` | `postgresql://gachaboard:gachaboard@localhost:18581/gachaboard` | 同上 | 本番 DB の接続文字列 |
| `NEXT_PUBLIC_SYNC_WS_URL` | `ws://localhost:18582` | （自動: 同一オリジン `/ws` を使用） | 同上 |

NEXTAUTH_URL は未設定でよく、アクセスした URL（例: `https://<ホスト>.ts.net`）から動的に決まります。`npm run env:local` / `npm run env:tailscale` は S3_PUBLIC_URL 等の切り替えに利用できます。

---

## 取得手順の例

### NEXTAUTH_SECRET の生成

```bash
openssl rand -base64 32
```

### Discord Client ID / Secret

1. [Discord Developer Portal](https://discord.com/developers/applications) にログイン
2. 「New Application」でアプリを作成
3. OAuth2 → Redirects に `http://localhost:18580/api/auth/callback/discord` を追加（Tailscale 使用時は別途追加）
4. OAuth2 → General で Client ID と Client Secret をコピー

### サーバーオーナーの Discord ID

1. Discord で「開発者モード」を有効化（設定 → アプリの設定 → 詳細）
2. プロフィール（ユーザーアイコン）を右クリック → 「ID をコピー」を選択

---

## 関連ドキュメント

- [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) - 運用モード（local / tailscale / production）の説明
- [SETUP.md](SETUP.md) - 初回セットアップの手順
- [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) - 認証エラーのトラブルシューティング
