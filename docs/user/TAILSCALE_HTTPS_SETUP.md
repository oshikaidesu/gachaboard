# Tailscale HTTPS セットアップガイド

Tailscale の HTTPS 機能を用いて、Gachaboard を HTTPS で提供する手順です。コードの変更は不要です。

---

## 前提

- Tailscale がインストールされ、マシンが Tailscale ネットワークに参加している
- [Admin Console](https://login.tailscale.com/admin/dns) で **MagicDNS** と **HTTPS Certificates** を有効化済み（[手順](https://tailscale.com/docs/how-to/set-up-https-certificates)）

### Docker で Tailscale からアクセスする場合

Docker Compose のポートはデフォルトで `127.0.0.1` にしかバインドされていないため、**他端末（スマホ・外出先）から Tailscale でアクセスできません**。プロジェクトルートの `.env` に次を追加してから `docker compose up -d` し直してください。

```env
HOST_BIND=0.0.0.0
```

これで全インターフェース（Tailscale 含む）で待ち受けます。**Caddy をホストで動かし `reverse_proxy localhost:18580` で HTTPS 化しているだけの場合は、`HOST_BIND` はそのままで問題ありません**（Caddy が Tailscale から受け、localhost でコンテナに届くため）。`HOST_BIND=0.0.0.0` が必要なのは、Caddy を使わず Tailscale の IP:ポート（例: `http://100.x.x.x:18580`）に直接アクセスしたい場合です。

---

## 方法 A: 自動セットアップ（推奨）

Caddy 2.5 以降では、`*.ts.net` ドメインに対して Tailscale から**証明書が自動取得**されます。`tailscale cert` の手動実行は不要です。

```bash
cd nextjs-web
npm run setup:tailscale-https
```

または（プロジェクトルートで）:

```bash
bash scripts/setup/tailscale-https.sh
```

これで以下が自動実行されます:

- ホスト名の取得（`tailscale status` から）
- Caddyfile の生成
- env の切り替え（NEXTAUTH_URL, S3_PUBLIC_URL）

続いて Caddy をインストール・起動:

```bash
brew install caddy
caddy run --config Caddyfile
```
（プロジェクトルートで実行）

---

## 方法 B: 手動セットアップ

### 1. Caddy をインストール

```bash
# macOS (Homebrew)
brew install caddy
```

### 2. Caddyfile を作成

プロジェクトルートに `Caddyfile` を作成。Caddy 2.5+ なら `tls` 指定不要（自動取得）:

ポートは `.env` の `PORT`（Next.js）と `MINIO_API_HOST_PORT`（MinIO）に合わせてください。デフォルトは 18580 / 18583 です。

```
<hostname>.ts.net {
    # Next.js（.env の PORT、デフォルト 18580）
    reverse_proxy localhost:18580

    # MinIO（.env の MINIO_API_HOST_PORT、デフォルト 18583）
    handle_path /minio/* {
        reverse_proxy localhost:18583
    }
}
```

Caddy 2.4 以前の場合は、`tailscale cert <hostname>.ts.net` で証明書を取得し、`tls` でパスを指定してください。

### 3. 環境変数を変更

`npm run env:tailscale` で自動設定。または手動で `nextjs-web/.env.local`:

```env
NEXTAUTH_URL=https://<hostname>.ts.net
S3_PUBLIC_URL=https://<hostname>.ts.net/minio
```

---

## 起動手順

1. Docker Compose で DB / MinIO / sync-server を起動（プロジェクトルートで）:

   ```bash
   docker compose up -d
   ```

2. Next.js を起動:

   ```bash
   cd nextjs-web
   npm run dev
   # または本番: npm start
   ```

3. Caddy を起動（HTTPS:443 で待ち受け。プロジェクトルートで）:

   ```bash
   caddy run --config Caddyfile
   ```

  バックグラウンドで動かす場合:

   ```bash
   caddy start --config Caddyfile
   ```

4. ブラウザで `https://<hostname>.ts.net` にアクセス

---

## Discord OAuth の設定

Discord Developer Console → アプリ → OAuth2 → Redirects に追加:

```
https://<hostname>.ts.net/api/auth/callback/discord
```

---

## トラブルシューティング

### 証明書エラー（Caddy 2.5+ 利用時）

- Admin Console で HTTPS が有効か確認
- Caddy が 2.5 以上か確認: `caddy version`
- [Caddy certificates on Tailscale](https://tailscale.com/kb/1190/caddy-certificates) を参照

### MinIO の Presigned URL が 404 になる

- `S3_PUBLIC_URL` が `https://<hostname>.ts.net/minio` であること（末尾スラッシュなし）
- Caddy の `handle_path /minio/*` が正しく設定されていること

### Caddy が 443 で起動できない

macOS では 1024 未満のポート利用に管理者権限が必要な場合があります:

```bash
sudo caddy run --config Caddyfile
```

または、別ポート（例: 8443）で待ち受けて Tailscale の Funnel やポートフォワードで利用する方法もあります。

---

## 別ネットワークからの E2E 動作確認

Tailscale URL（別ネットワーク相当）向けに E2E テストを実行し、セッション・Cookie・HTTPS・getBaseUrl が別オリジンでも正しく動くことを検証できます。

### 同一マシンで実行

1. アプリを Tailscale モードで起動（`npm run start:tailscale` 等）
2. Tailscale serve で `https://<host>.ts.net` が有効な状態にする
3. 以下を実行（webServer は起動せず、既存のアプリに接続）:

   ```bash
   cd nextjs-web
   E2E_BASE_URL=https://<host>.ts.net npm run test:e2e:tailscale
   ```

### 別マシン（真の別ネットワーク）で実行

1. サーバ側でアプリを Tailscale モードで起動済み
2. Tailscale で接続した別 PC や CI ランナーから:

   ```bash
   cd nextjs-web
   E2E_BASE_URL=https://<サーバの.ts.net> npm run test:e2e:tailscale
   ```

`E2E_BASE_URL` が `https://` で始まる場合、Playwright は webServer を起動しません。既に起動しているアプリに向けてテストを実行します。

---

## 関連ドキュメント

- [運用モードと環境変数](./ENV-AND-DEPLOYMENT-MODES.md)
- [環境変数リファレンス](./ENV-REFERENCE.md)
