# 運用モードと ENV 設定

> 「今どのモードで動かしたいか」から逆引きできるガイド。

---

## 運用モード一覧

| モード | 用途 | NEXTAUTH_URL | 主な想定 |
|--------|------|--------------|----------|
| **local** | PC の localhost のみ | `http://localhost:3000` | 開発・一人で使う |
| **tailscale** | スマホ・他端末から Tailscale 経由でアクセス | `https://<自分のTailscaleホスト>`（Caddy 前提） | 身内共有・リモートアクセス |
| **production** | Linux 本番サーバー | `https://...` または `http://<IP or ドメイン>:3000` | サーバー運用 |

---

## モード別の設定手順

### local（ローカルのみ）

1. `NEXTAUTH_URL=http://localhost:3000` を `.env.local` に設定
2. Discord OAuth の Redirect に `http://localhost:3000/api/auth/callback/discord` を追加
3. `npm run dev` で起動 → http://localhost:3000 でアクセス

### tailscale（スマホ・他端末から・HTTPS）

1. **Tailscale アプリ**をインストール・起動（VPN 接続用）
2. **Tailscale CLI** をインストール（ホスト名取得用）: `brew install tailscale jq`
3. **Caddy で HTTPS を構築**: `npm run setup:tailscale-https` で自動化（[TAILSCALE_HTTPS_SETUP.md](TAILSCALE_HTTPS_SETUP.md) 参照）
4. **Tailscale のホスト名を調べる**（下記参照）
5. `npm run env:tailscale` で NEXTAUTH_URL を切り替え（`https://<ホスト>` に設定）
6. Discord OAuth の Redirect に `https://<あなたのTailscaleホスト>/api/auth/callback/discord` を追加
7. Next.js を再起動
8. スマホ等で `https://<Tailscaleホスト>` にアクセス

### production（本番）

1. `NEXTAUTH_URL` を本番の URL に設定（HTTPS 推奨）
2. Discord OAuth の Redirect に本番の callback URL を追加
3. `DATABASE_URL` を本番 DB に変更
4. Docker または systemd でサービス起動

---

## Tailscale ホスト名の調べ方

Tailscale を使う場合、`NEXTAUTH_URL` と Discord Redirect にあなたのマシンの Tailscale ホスト名が必要です。

### Tailscale CLI のインストール（推奨）

Tailscale アプリ（GUI）は起動しているが `tailscale` コマンドが見つからない場合、CLI を別途インストールします。

```bash
# macOS (Homebrew)
brew install tailscale jq
```

- **tailscale**: ホスト名取得や `npm run env:tailscale` の自動検出に必要
- **jq**: `tailscale status --json` の結果をパースするために使用

インストール後、`tailscale status` が使えるようになります。

Homebrew がない場合は、[方法 3: Tailscale Admin Console](#方法-3-tailscale-admin-console) でブラウザからホスト名を確認し、`TAILSCALE_HOST=<ホスト名> npm run env:tailscale` で手動指定してください。

### 方法 1: tailscale status（CLI）

Tailscale CLI がインストールされていれば:

```bash
tailscale status
```

表示例:
```
100.x.x.x   your-machine-name    user@   -
```

`your-machine-name` の部分。ただし DNS 名（`xxx.tail12345.ts.net`）が必要な場合は方法 2 を参照。

### 方法 2: tailscale status --json（推奨）

```bash
tailscale status --json --peers=false | jq -r .Self.DNSName
```

出力例: `your-machine.tail12345.ts.net`（末尾の `.` があれば削除して使用）

### 方法 3: Tailscale Admin Console

1. [Tailscale Admin Console](https://login.tailscale.com/admin/machines) にログイン
2. マシン一覧で自分のマシンを探す
3. 「DNS name」または「Machine name」をコピー（`xxx.tail12345.ts.net` 形式）

---

## NEXTAUTH_URL の切り替えスクリプト

`nextjs-web` で以下を実行すると `.env.local` の **NEXTAUTH_URL** を切り替えられます。

| 用途 | コマンド | 更新される変数 |
|------|----------|----------------|
| ローカル（localhost） | `npm run env:local` | NEXTAUTH_URL |
| Tailscale | `npm run env:tailscale` | NEXTAUTH_URL |

Tailscale のホスト名を指定する場合:

```bash
TAILSCALE_HOST=your-machine.tail12345.ts.net npm run env:tailscale
```

**S3_PUBLIC_URL は自動導出:** NEXTAUTH_URL から自動的に決まるため、手動設定は不要です。

| NEXTAUTH_URL | S3_PUBLIC_URL（自動） | 経路 |
|---|---|---|
| `http://localhost:3000` | `http://localhost:9000` | ブラウザ → MinIO に直接接続 |
| `https://<Tailscaleホスト>` | `https://<Tailscaleホスト>/minio` | ブラウザ → Next.js API route → MinIO |

**注意:** 切り替えたら Next.js を再起動（`Ctrl+C` → `npm run dev`）してください。`.env.local` はホットリロードされません。

**ワンコマンド起動:** env 切り替え + Docker 起動 + Next.js 起動 + ブラウザ起動をまとめて実行:
- Tailscale: `cd nextjs-web && npm run start:tailscale`
- ローカル: `cd nextjs-web && npm run start:local`
- リセット＆再起動: `npm run start:tailscale:reset` / `start:local:reset`（`--reset` で Docker 停止 → 再起動）

起動スクリプトの詳細は [SETUP.md](SETUP.md) の「起動スクリプトが自動で行うこと」を参照。

---

## Tailscale 使用時の WebSocket について

`NEXTAUTH_URL` を Tailscale URL にすると、ブラウザは `ws://<Tailscaleホスト>:3000/ws/...` に WebSocket 接続します。

- **Docker で sync-server を起動している場合**: Next.js の rewrite が `/ws/*` を sync-server に転送するため、同一オリジン（Tailscale URL）経由で WebSocket も動作します。
- **Docker なしで `npm run dev` のみの場合**: `sync-server` というホスト名が解決できず、WebSocket がつながらないことがあります。この場合は `npm run env:local` に戻して localhost 経由で使うか、sync-server を別途起動して `NEXT_PUBLIC_SYNC_WS_URL` を設定してください。

## Tailscale 使用時の MinIO（ポート 9000）について

Tailscale モードでは、MinIO へのアクセスは Next.js の API route (`/minio/*`) が自動でプロキシします。Caddy や Tailscale Serve の設定は不要です。

**仕組み:**
1. Presigned URL を `http://localhost:9000` で署名
2. URL のホスト部分を `/minio` パスに書き換えてブラウザに返す
3. ブラウザが `/minio/*` にリクエスト → Next.js API route が `Host: localhost:9000` を設定して MinIO に転送
4. MinIO は署名と Host が一致するため認証 OK

これにより HTTPS ページから MinIO に安全にアクセスでき、Mixed Content エラーも発生しません。

---

## 関連ドキュメント

- [ENV-REFERENCE.md](ENV-REFERENCE.md) - 全環境変数の一覧
- [SETUP.md](SETUP.md) - 初回セットアップ
- [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) - 認証エラーの対処
