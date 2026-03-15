# セットアップガイド

初めて Gachaboard を動かす方向けの手順です。チェックリスト形式で進められます。

---

## 前提条件

- [ ] **Node.js 18 以上** … `node -v` で確認
- [ ] **Docker** … [Docker Desktop](https://www.docker.com/products/docker-desktop/) をインストールし、起動できること
- [ ] **Discord アカウント** … ログインに使用

---

## ステップ 1: リポジトリをクローン

```bash
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard
```
※ リポジトリが親フォルダで管理されている場合は `cd Gachaboard` でプロジェクトルートへ。

---

## ステップ 2: Discord OAuth アプリを作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にログイン
2. 「New Application」でアプリを作成
3. OAuth2 → Redirects に `http://localhost:3000/api/auth/callback/discord` を追加
4. OAuth2 → General で **Client ID** と **Client Secret** をコピー

---

## ステップ 3: 環境変数を設定

```bash
cd nextjs-web
cp env.local.template .env.local
```

`.env.local` を編集し、以下を設定します。

| 変数 | 取得元 | 例 |
|------|--------|-----|
| `DISCORD_CLIENT_ID` | ステップ 2 | `1234567890123456789` |
| `DISCORD_CLIENT_SECRET` | 同上 | `abcdef123456...` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` で生成 | - |
| `NEXTAUTH_URL` | そのまま | `http://localhost:3000` |
| `DATABASE_URL` | そのまま（Docker 用） | `postgresql://gachaboard:gachaboard@localhost:5433/gachaboard` |
| `SERVER_OWNER_DISCORD_ID` | 任意。自分の Discord ID を入れるとオーナー限定 | 未設定でも可 |

**S3/MinIO**: `env.local.template` にデフォルト値あり。そのままで OK。MinIO はステップ 4 で Docker 起動。

詳細は [ENV-REFERENCE.md](ENV-REFERENCE.md) を参照。

---

## ステップ 4: インフラを起動

```bash
docker compose up -d
```

postgres、sync-server、MinIO が起動します。

```bash
docker compose ps
```

`postgres`、`sync-server`、`minio` が `Up` または `healthy` になっていれば OK。

**アプリ側からまとめて確認**（DB 接続・MinIO・sync・Next.js）:

```bash
cd nextjs-web && npm run status
```

---

## ステップ 5: アプリを起動

### ワンコマンド起動（env 切り替え込み）

```bash
cd nextjs-web
npm run start:tailscale   # Tailscale モード（スマホ等からアクセス用・デフォルト）
npm run start:local       # ローカルモード（localhost のみ）
npm run start:tailscale:reset   # リセット＆再起動（Docker 停止 → 再起動）
npm run start:local:reset
```

初回のみ、先に `npm install --legacy-peer-deps` と `npx prisma generate`、`npx prisma db push` を実行してください。

#### 起動スクリプトが自動で行うこと

| ステップ | 内容 |
|----------|------|
| 1. env 切り替え | `.env.local` の `NEXTAUTH_URL` を自動設定（Tailscale モードは Tailscale CLI からホスト名を自動取得して `https://<ホスト>` に設定） |
| 2. Docker 起動 | `docker compose up -d` を実行。失敗時は Docker Desktop の状態を判定し、自動で起動・再起動を試みる（macOS のみ、最大 5 分待機） |
| 3. Next.js 起動 | ポート 3000 を解放（既存プロセスの停止）→ `npm run dev` を実行 |
| 4. 起動確認 | Next.js が応答するまで最大 60 秒待機 |
| 5. ブラウザを開く | 起動成功時のみ、ブラウザでアプリ URL を開く（macOS: 前面のブラウザに新タブで追加） |

**Docker 自動起動の詳細（macOS）:**

- Docker Desktop が**未起動** → `open -a Docker` で起動し、Engine の準備完了まで待機
- Docker Desktop の GUI は動いているが **Engine がハング** → 完全終了 → 再起動 → Engine の準備完了まで待機
- Docker 接続以外のエラー → エラーメッセージを表示して終了

**`--reset` オプション:** Docker コンテナを一度停止してから再起動します。DB やストレージのデータは保持されます。

### 手動起動

```bash
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
npm run env:local   # または npm run env:tailscale
npm run dev
```

ブラウザで http://localhost:3000（ローカル）または Tailscale URL（Tailscale モード）を開き、Discord でログイン → ワークスペース作成 → ボード作成 → 編集開始。

---

## ステップ 6: 動作確認

1. ボード上にシェイプを配置できること
2. ファイルをドラッグ＆ドロップで配置できること
3. 保存・同期が動作すること

---

## 分岐: Tailscale でスマホからアクセス

PC 以外から Tailscale 経由でアクセスする場合:

1. **Tailscale CLI をインストール**（`tailscale` コマンドが見つからない場合）:
   ```bash
   brew install tailscale jq
   ```
2. **ホスト名を調べる**: `tailscale status --json --peers=false | jq -r .Self.DNSName`
3. **NEXTAUTH_URL を切り替え**: `cd nextjs-web && npm run env:tailscale`（未指定時は自動検出を試みる）
4. **Discord Redirect を追加**: `https://<ホスト名>/api/auth/callback/discord`
5. **Next.js を再起動**

詳細は [ENV-AND-DEPLOYMENT-MODES.md](ENV-AND-DEPLOYMENT-MODES.md) を参照。

---

## 補足

### ポート一覧

| サービス | ポート | 用途 |
|----------|--------|------|
| Next.js | 3000 | Web アプリ |
| PostgreSQL | 5433 | DB（ホスト側） |
| sync-server | 5858 | Yjs WebSocket |
| MinIO | 9000, 9001 | S3 互換ストレージ |

### ffmpeg

動画・音声の変換に必要。未インストールだと変換が失敗します。

### sync-server を単体で起動

Docker を使わない場合:

```bash
cd nextjs-web/sync-server
npm install
PORT=5858 HOST=0.0.0.0 npm start
```

### E2E テスト

```bash
cd nextjs-web
npm run e2e:server   # 別ターミナルでサーバ起動
npm run test:e2e     # テスト実行
```

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| Discord ログイン後にエラー（Callback） | `npm run status` で PostgreSQL を確認。[discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) も参照 |
| PostgreSQL 接続エラー | `docker compose ps` で確認。`docker compose up -d postgres` で再起動 |
| Docker に接続できない | Docker Desktop を起動。起動スクリプト経由なら自動起動を試みる |
| MinIO 403 エラー | `.env.local` に `S3_PUBLIC_URL` が残っていないか確認（自動導出されるため不要） |
| ポートが使われている | 3000, 5433, 5858 が他プロセスで使用されていないか確認 |
| `.env.local` の変更が反映されない | Next.js を再起動（`Ctrl+C` → `npm run dev`）。ホットリロードでは反映されない |
