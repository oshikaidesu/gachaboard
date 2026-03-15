# Tailscale HTTPS セットアップガイド

Tailscale の HTTPS 機能を使って、gachaboard を HTTPS で提供する手順。コード変更不要。

---

## 前提

- Tailscale がインストールされ、マシンが Tailscale ネットワークに参加している
- [Admin Console](https://login.tailscale.com/admin/dns) で **MagicDNS** と **HTTPS Certificates** を有効化済み（[手順](https://tailscale.com/docs/how-to/set-up-https-certificates)）

---

## 方法 A: 自動セットアップ（推奨）

Caddy 2.5+ は `*.ts.net` ドメインで Tailscale から**自動証明書取得**します。`tailscale cert` の手動実行は不要です。

```bash
cd nextjs-web
npm run setup:tailscale-https
```

または:

```bash
cd gachaboard-compound
bash scripts/setup-tailscale-https.sh
```

これで以下が自動実行されます:

- ホスト名の取得（`tailscale status` から）
- Caddyfile の生成
- env の切り替え（NEXTAUTH_URL, S3_PUBLIC_URL）

続いて Caddy をインストール・起動:

```bash
brew install caddy
cd gachaboard-compound
caddy run --config Caddyfile
```

---

## 方法 B: 手動セットアップ

### 1. Caddy をインストール

```bash
# macOS (Homebrew)
brew install caddy
```

### 2. Caddyfile を作成

プロジェクトルート（例: `gachaboard-compound/Caddyfile`）に作成。Caddy 2.5+ なら `tls` 指定不要（自動取得）:

```
<hostname>.ts.net {
    # Next.js
    reverse_proxy localhost:3000

    # MinIO (Presigned URL 用)
    handle_path /minio/* {
        reverse_proxy localhost:9000
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

1. Docker Compose で DB / MinIO / sync-server を起動:

   ```bash
   cd gachaboard-compound
   docker compose up -d
   ```

2. Next.js を起動:

   ```bash
   cd nextjs-web
   npm run dev
   # または本番: npm start
   ```

3. Caddy を起動（HTTPS:443 で待ち受け）:

   ```bash
   cd gachaboard-compound
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

## 関連ドキュメント

- [運用モードと ENV 設定](./ENV-AND-DEPLOYMENT-MODES.md)
- [ENV リファレンス](./ENV-REFERENCE.md)
