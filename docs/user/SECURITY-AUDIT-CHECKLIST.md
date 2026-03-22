# セキュリティ棚卸しチェックリスト（Tailscale 公開時）

本番運用前に [SECURITY.md](../../SECURITY.md) 推奨の設定を確認するためのチェックリストです。`scripts/entry/start.bat` のオプション 1（Tailscale 本番）で公開する場合の重点項目を整理しています。

## 1. NEXTAUTH_SECRET

**目的**: セッション JWT と sync-server のトークンゲートに使用。推測困難な長い乱数が必要。

**確認**:
- [ ] `nextjs-web/.env.local` に `NEXTAUTH_SECRET` が設定されている
- [ ] 値が空でなく、`REPLACE` やデフォルトプレースホルダではない
- [ ] 32 バイト以上推奨: `openssl rand -base64 32` で生成可能

**現在の状態**: 設定されている場合は ✓。未設定・空の場合は起動時に Discord チェックで弾かれる。

---

## 2. PostgreSQL 認証情報

**目的**: デフォルト `gachaboard:gachaboard` のままは危険。tailnet 内から直接 DB に接続された場合の突破を防ぐ。

**確認**:
- [ ] `DATABASE_URL` のパスワードをデフォルトから変更済み
- [ ] PostgreSQL の `gachaboard` ユーザーパスワードを `ALTER USER` で変更し、`DATABASE_URL` と一致させた

**手順** (portable PostgreSQL 使用時):
```sql
-- pgAdmin または psql で接続後
ALTER USER gachaboard WITH PASSWORD '推測困難な新パスワード';
```
その後 `nextjs-web/.env.local` の `DATABASE_URL` を更新。

**代替: 起動毎ローテーション**  
`CREDENTIAL_ROTATION=1` を `.env.local` に設定すると、起動のたびに **PostgreSQL パスワード**と **MinIO のアプリ用アクセスキー**（`mc admin user` で `readwrite` ユーザーを作り直し）が自動で変更されます。漏洩しても次回起動で無効化されやすくなります。MinIO ルート `minioadmin` はデータ互換のため変えず、Next.js が使う S3 キーだけ差し替わります（初回に `portable/bin` へ `mc` を自動取得する場合あり）。

---

## 3. MinIO 認証情報

**目的**: デフォルト `minioadmin`/`minioadmin` のままは危険。オブジェクトストレージ直アクセスの突破を防ぐ。

**確認**:
- [ ] `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` をデフォルトから変更済み
- [ ] MinIO の環境変数（起動スクリプトで渡す `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`）も同一に更新した

**手順**: MinIO の認証変更は初回起動時の環境変数で行う。既存データがある場合は [MinIO ドキュメント](https://min.io/docs/minio/linux/integrations/change-minio-root-credentials.html) を参照。

---

## 4. E2E_TEST_MODE

**目的**: 本番で認証バイパスを無効化する。

**確認**:
- [ ] `E2E_TEST_MODE` が未設定、または `0` / `false`
- [ ] `nextjs-web/src/lib/env.ts` により本番環境では `E2E_TEST_MODE=1` 時は起動エラーで停止する（実装済み）

**現在の状態**: 未設定なら ✓。

---

## 5. /ws（WebSocket）のアクセス制限

**目的**: sync-server への接続を tailnet（または localhost）のみに制限し、無差別な接続や DoS を防ぐ。

### Windows（Tailscale Serve 使用時）

`scripts/entry/start.bat` のオプション 1 では **Tailscale Serve** が使われ、Caddy は使用しない。

- **挙動**: Tailscale Serve は tailnet 内のクライアントのみがアクセス可能。インターネットには直接露出しない。
- **確認**: [ ] オプション 1（Tailscale production）で起動している
- [ ] `tailscale serve` で Next.js と `/ws` が同じホスト名にプロキシされている（run.ps1 で自動設定）

### Linux / Mac（Caddy 使用時）

`npm run setup:tailscale-https`（`scripts/setup/tailscale-https.sh`）で生成した Caddyfile には、`/ws` を Tailscale IP（100.64.0.0/10）と localhost（127.0.0.0/8）のみ許可するブロックが含まれる。

- **検証**: `npm run verify:ws-config` で Caddyfile の内容を確認できる（`scripts/verify-ws-config.sh`）
- **確認**: [ ] `config/Caddyfile` に以下のブロックがある（`reverse_proxy` より前に配置）:
```caddy
handle_path /ws/* {
    @allow remote_ip 100.64.0.0/10 127.0.0.0/8
    handle @allow {
        reverse_proxy localhost:18582
    }
    handle {
        respond "Forbidden" 403
    }
}
```
- [ ] Caddy を起動し、HTTPS（wss）でアクセスしている

---

## 6. sync-server トークンゲート

**目的**: 無作為な room 名での接続による DoS を防ぎ、`assertBoardAccess` 通過者のみ sync に参加させる。

**確認**:
- [ ] `NEXTAUTH_SECRET` が設定されている（トークンゲートはこれが設定されているときのみ有効）
- [ ] 起動時に sync-server へ `NEXTAUTH_SECRET` が渡されている（start スクリプトが `nextjs-web/.env.local` を読み込む前提）

**現在の状態**: `NEXTAUTH_SECRET` が設定されていれば有効。未設定ならゲートはオフ（sync-server がトークン検証なしで動作）。

---

## 7. SERVER_OWNER_DISCORD_ID（任意）

**目的**: ワークスペース作成を特定の Discord ユーザーに限定。荒らし・スプレー作成の抑止。

**確認**:
- [ ] 本番で制限したい場合は、オーナーの Discord ID を設定済み
- [ ] 全員に作成を許可する場合は未設定のままでよい

---

## 8. Tailscale ACL（運用）

**目的**: サーバーに届くトラフィックを「必要なユーザーのみ」に限定。詳細は [ config/tailscale-acl.example.json](../../config/tailscale-acl.example.json) および [Tailscale ACL セットアップ](TAILSCALE-ACL-SETUP.md) を参照。

---

## 棚卸しの実施タイミング

- **初回公開前**: 1〜7 を一通り確認し、チェックを付ける
- **定期確認**: 認証情報のローテーションや依存関係更新時に 1〜3 を見直す
