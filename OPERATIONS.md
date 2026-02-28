# 運用ガイド — gachaboard

## アーキテクチャ概要

```
[ブラウザ]
    │ HTTPS / WSS
    ▼
[Tailscale serve] ← uooooooooooo.tail16829c.ts.net
    │
    ├─ /* ──────────────── http://localhost:3000  (Next.js)
    └─ /ws/* ────────────── http://localhost:5858  (sync-server)
                              ↓ WebSocket /sync/:roomId

[Docker Compose]
    ├─ nextjs-web   :3000  ← Next.js + NextAuth + Prisma
    ├─ tldraw-sync  :5858  ← @tldraw/sync-core WebSocket サーバー
    └─ postgres     :5432  ← PostgreSQL 16
```

### 重要: Tailscale URL が変わると壊れる箇所

Tailscale のホスト名（`xxx.tail16829c.ts.net`）はマシンの再セットアップや
アカウント変更で変わることがある。以下の **4箇所** に埋め込まれている。

| ファイル | 設定キー | 役割 |
|---|---|---|
| `nextjs-web/.env.local` | `NEXTAUTH_URL` | セッションCookieのドメイン |
| `docker-compose.yml` | `NEXTAUTH_URL` | コンテナ内の環境変数 |
| `nextjs-web/next.config.ts` | `allowedDevOrigins` | Next.js のオリジン許可 |
| Discord Developer Portal | Redirect URI | OAuth コールバック先 |

---

## Tailscale URL が変わったときの手順

### ステップ 1: セットアップスクリプトを実行

```bash
./scripts/setup-tailscale.sh
```

スクリプトが自動で Tailscale ホスト名を検出し、上記3ファイルを一括更新する。
手動で指定する場合:

```bash
./scripts/setup-tailscale.sh 新しいホスト名.tail16829c.ts.net
```

### ステップ 2: Discord Developer Portal を更新（手動）

1. https://discord.com/developers/applications を開く
2. アプリ（Client ID: `1476047949875380304`）を選択
3. OAuth2 > Redirects に追加:
   ```
   https://新しいホスト名.tail16829c.ts.net/api/auth/callback/discord
   ```

### ステップ 3: tailscale serve を再設定

```bash
# 既存設定をリセット
sudo tailscale serve reset

# Next.js をルートで公開
sudo tailscale serve --bg --set-path=/ http://localhost:3000

# sync-server を /ws パスで公開
sudo tailscale serve --bg --set-path=/ws http://localhost:5858

# 確認
tailscale serve status
```

期待される出力:
```
https://xxx.tail16829c.ts.net (Tailscale HTTPS)
|-- /    proxy http://127.0.0.1:3000
|-- /ws  proxy http://127.0.0.1:5858
```

### ステップ 4: Docker を再起動

```bash
docker compose down
docker compose up -d
```

### ステップ 5: 動作確認

```bash
# Next.js 起動確認
docker compose logs nextjs --tail=5

# sync-server ヘルスチェック
curl http://localhost:5858/health

# ブラウザで確認
open https://新しいホスト名.tail16829c.ts.net
```

---

## 通常の起動・停止

```bash
# 起動
docker compose up -d

# 停止
docker compose down

# ログ確認
docker compose logs -f nextjs
docker compose logs -f sync-server

# 全コンテナの状態確認
docker compose ps
```

---

## E2E テスト（Playwright）

```bash
# バックエンド WebSocket 同期テスト
npm run test:sync:backend

# UI テスト（E2Eモードで起動が必要）
E2E_TEST_MODE=1 docker compose up -d
npm run test:sync:ui
```

E2E テストモードでは Discord 認証をバイパスする。
`?e2e=1&testUserId=xxx&testUserName=xxx` のクエリパラメータでボードに直接アクセス可能。

---

## トラブルシューティング

### 認証ループ（ログインしてもトップに戻る）

**原因**: `NEXTAUTH_URL` のホスト名と実際のアクセス先が不一致。
Cookie のドメインが合わずセッションが保存されない。

**対処**: `./scripts/setup-tailscale.sh` を実行して URL を統一する。

### `CLIENT_TOO_OLD` エラー

**原因**: sync-server の SQLite ルームDB が古いスキーマで保存されている。

**対処**:
```bash
# ルームDB を全削除（キャンバスの内容はリセットされる）
docker exec tldraw-sync sh -c "rm -f /app/.rooms/*.db"
docker compose restart sync-server
```

### `ValidationError: got "file-icon"` エラー

**原因**: `useSync` に `shapeUtils` が渡されていない。

**対処**: `TldrawBoard.tsx` の `useSync` に `shapeUtils: CUSTOM_SHAPE_UTILS` が
あることを確認する。

### sync-server に接続できない（「接続中...」のまま）

**原因**: tailscale serve の `/ws` パス設定が欠けている。

**対処**: ステップ 3 の tailscale serve 設定を再実行する。

---

## 設定ファイル一覧

| ファイル | 用途 |
|---|---|
| `docker-compose.yml` | Docker サービス定義 |
| `nextjs-web/.env.local` | 環境変数（Git管理外推奨） |
| `nextjs-web/next.config.ts` | Next.js 設定 |
| `nextjs-web/sync-server/server.ts` | WebSocket サーバー |
| `nextjs-web/sync-server/rooms.ts` | ルーム管理・スキーマ登録 |
| `nextjs-web/sync-server/shapeSchema.ts` | カスタムシェイプスキーマ定義 |
| `scripts/setup-tailscale.sh` | Tailscale URL 一括更新スクリプト |
