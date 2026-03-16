# インフラ周りの確認事項

Gachaboard 運用時に起こりがちなインフラ不備のチェックリスト。

## 自動チェック

```bash
cd nextjs-web && npm run infra:check
```

主要な接続・環境変数を自動検証し、手動確認が必要な項目を表示します。

---

## 認証・セッション

- [ ] `NEXTAUTH_URL` が環境と一致しているか（HTTP/HTTPS、localhost か本番ドメインか）
- [ ] OAuth callback URL が Discord Developer Portal の Redirects に登録されているか
- [ ] Cookie の SameSite / Secure 設定が HTTPS 環境で正しいか
- [ ] リバースプロキシ経由の場合、`X-Forwarded-Proto` 等のヘッダが渡されているか

---

## 同期（Yjs / WebSocket）

- [ ] `NEXT_PUBLIC_SYNC_WS_URL` が各環境で正しいか（ws/wss、ホスト名、ポート）
- [ ] sync-server（ホスト側ポート 18582、Docker 内 5858）が起動し、到達可能か
- [ ] プロキシ・ロードバランサで WebSocket が有効か（タイムアウト・Keep-Alive）
- [ ] CORS やプロキシのルーティングで WS 接続が遮断されていないか

---

## ストレージ（S3/MinIO）

- [ ] `S3_PUBLIC_URL` と MinIO 内部 URL の使い分けが正しいか
- [ ] クライアントから Presigned URL のドメインへ到達できるか（Tailscale 内/外）
- [ ] バケットポリシー・IAM がアップロード・取得に十分か
- [ ] Presigned URL の有効期限が不足していないか

---

## ネットワーク

- [ ] Tailscale が接続済みか（身内アクセス時）
- [ ] 必要なポートが開いているか（デフォルトの docker-compose では Next.js 18580, PostgreSQL 18581, sync-server 18582, MinIO 18583。VM 内や別構成の場合は 3000, 5858, 5432, 9000 等）
- [ ] ファイアウォールで必要な通信が許可されているか
- [ ] DNS が正しく解決されているか

---

## データベース（PostgreSQL）

- [ ] 接続文字列・認証情報が正しいか
- [ ] マイグレーション（`prisma migrate`）が適用済みか
- [ ] 接続数上限に達していないか
- [ ] ディスク容量に余裕があるか

---

## リソース

- [ ] Node / PostgreSQL / MinIO のメモリに余裕があるか
- [ ] ディスク容量が枯渇していないか

---

## 24時間運用時

常時稼働させる場合は以下も確認してください。詳細は [24-7-OPERATION.md](24-7-OPERATION.md) を参照。

- [ ] Next.js が落ちたときに自動再起動するか（[AUTO-RESTART.md](AUTO-RESTART.md) 参照: Docker `web` / systemd / PM2）
- [ ] ディスク容量の監視・アラートを設定しているか
- [ ] PostgreSQL の定期バックアップ（pg_dump 等）を用意しているか
- [ ] Docker のログローテーション（`logging.max-size`）または logrotate を設定しているか
- [ ] Tailscale 運用時: ホストのスリープ無効化や UPS を検討したか

---

## 本番デプロイ時

本番で初めてデプロイする際は [SECURITY.md](../../SECURITY.md) の「本番デプロイ時の推奨事項」を確認してください。

- [ ] PostgreSQL / MinIO のデフォルトパスワードを変更したか
- [ ] `NEXTAUTH_SECRET` を推測困難な乱数に設定したか
- [ ] Caddy 等で `/ws` に IP 制限（Tailscale / localhost のみ）を入れているか（`npm run setup:tailscale-https` で生成した Caddyfile には含まれます）

---

## 関連ドキュメント

- [ENV-REFERENCE.md](./ENV-REFERENCE.md) - 環境変数一覧
- [24-7-OPERATION.md](24-7-OPERATION.md) - 24時間運用時の注意点
- [discord-auth-troubleshooting.md](./discord-auth-troubleshooting.md) - Discord 認証のトラブルシューティング
