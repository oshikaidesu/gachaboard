# 運用モードと ENV 設定

> 「今どのモードで動かしたいか」から逆引きできるガイド。

---

## 運用モード一覧

| モード | 用途 | NEXTAUTH_URL | 主な想定 |
|--------|------|--------------|----------|
| **local** | PC の localhost のみ | `http://localhost:3000` | 開発・一人で使う |
| **tailscale** | スマホ・他端末から Tailscale 経由でアクセス | `http://<自分のTailscaleホスト>:3000` | 身内共有・リモートアクセス |
| **production** | Linux 本番サーバー | `https://...` または `http://<IP or ドメイン>:3000` | サーバー運用 |

---

## モード別の設定手順

### local（ローカルのみ）

1. `NEXTAUTH_URL=http://localhost:3000` を `.env.local` に設定
2. Discord OAuth の Redirect に `http://localhost:3000/api/auth/callback/discord` を追加
3. `npm run dev` で起動 → http://localhost:3000 でアクセス

### tailscale（スマホ・他端末から）

1. **Tailscale のホスト名を調べる**（下記参照）
2. `npm run env:tailscale` で NEXTAUTH_URL を切り替え（または手動で `.env.local` に設定）
3. Discord OAuth の Redirect に `http://<あなたのTailscaleホスト>:3000/api/auth/callback/discord` を追加
4. Next.js を再起動
5. スマホ等で Tailscale 経由の URL にアクセス

### production（本番）

1. `NEXTAUTH_URL` を本番の URL に設定（HTTPS 推奨）
2. Discord OAuth の Redirect に本番の callback URL を追加
3. `DATABASE_URL` を本番 DB に変更
4. Docker または systemd でサービス起動

---

## Tailscale ホスト名の調べ方

Tailscale を使う場合、`NEXTAUTH_URL` と Discord Redirect にあなたのマシンの Tailscale ホスト名が必要です。

### 方法 1: tailscale status（CLI）

Tailscale がインストールされていれば:

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

`jq` がなければ:

```bash
# macOS (Homebrew)
brew install jq
```

### 方法 3: Tailscale Admin Console

1. [Tailscale Admin Console](https://login.tailscale.com/admin/machines) にログイン
2. マシン一覧で自分のマシンを探す
3. 「DNS name」または「Machine name」をコピー（`xxx.tail12345.ts.net` 形式）

---

## NEXTAUTH_URL の切り替えスクリプト

`nextjs-web` で以下を実行すると `.env.local` の `NEXTAUTH_URL` を切り替えられます。

| 用途 | コマンド |
|------|----------|
| ローカル（localhost） | `npm run env:local` |
| Tailscale | `npm run env:tailscale` |

Tailscale のホスト名を指定する場合:

```bash
TAILSCALE_HOST=your-machine.tail12345.ts.net npm run env:tailscale
```

**注意:** 切り替えたら Next.js を再起動（`Ctrl+C` → `npm run dev`）してください。

---

## Tailscale 使用時の WebSocket について

`NEXTAUTH_URL` を Tailscale URL にすると、ブラウザは `ws://<Tailscaleホスト>:3000/ws/...` に WebSocket 接続します。

- **Docker で sync-server を起動している場合**: Next.js の rewrite が `/ws/*` を sync-server に転送するため、同一オリジン（Tailscale URL）経由で WebSocket も動作します。
- **Docker なしで `npm run dev` のみの場合**: `sync-server` というホスト名が解決できず、WebSocket がつながらないことがあります。この場合は `npm run env:local` に戻して localhost 経由で使うか、sync-server を別途起動して `NEXT_PUBLIC_SYNC_WS_URL` を設定してください。

---

## 関連ドキュメント

- [ENV-REFERENCE.md](ENV-REFERENCE.md) - 全環境変数の一覧
- [FIRST-TIME-SETUP.md](FIRST-TIME-SETUP.md) - 初回セットアップ
- [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) - 認証エラーの対処
