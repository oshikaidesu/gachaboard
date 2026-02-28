# Tailscaleベース P2Pホワイトボード アーキテクチャ

## なぜTailscaleで成立するか

このシステムはインターネット上のクラウドサービスに依存せず、**Tailscaleネットワーク（tailnet）内のローカルサーバー1台**で全員が使えるように設計されています。

### 仕組み

```
[メンバーA PC]                [ホストPC]
  ブラウザ  ──Tailscale P2P──  Docker
                               ├── nextjs-web  :3000
                               ├── sync-server :5858
                               └── postgres    :5432

[メンバーB PC]
  ブラウザ  ──Tailscale P2P──  同上
```

- **Tailscale** は各端末間にP2P暗号化トンネルを張る（WireGuardベース）
- ホストPCがDockerでサーバーを動かすだけでよく、グローバルIPやポート開放は不要
- メンバーはTailscaleネットワークに参加していれば、ホストのTailscaleアドレスでアクセスできる
- 無料プランで **最大100台** まで参加可能

### アクセスURL

```
https://desktop-hn7hdbv-1.tail16829c.ts.net
```

Tailscaleが自動でHTTPS証明書を発行するため、`wss://` WebSocketも安全に使える。

---

## サービス構成

| サービス | ポート | 役割 |
|---------|--------|------|
| nextjs-web | 3000 | Next.jsフロントエンド・APIサーバー |
| sync-server | 5858 | tldrawリアルタイム同期（WebSocket） |
| postgres | 5432 | データベース（ユーザー・ボード・アセット） |

---

## 認証フロー

1. ユーザーがTailscaleネットワーク内からアクセス
2. Discordでログイン（OAuthコールバックはTailscaleのURLを使用）
3. Discord ID・表示名・アバターURLをDBに保存
4. ボードURLを共有するだけで、同じTailscaleネットワーク内のメンバーが参加可能

---

## 新メンバーの追加手順

1. **管理者**が [Tailscale Admin Console](https://login.tailscale.com/admin/invite) でメンバーを招待
2. メンバーが自分のPCに [Tailscale](https://tailscale.com/download) をインストールしてログイン
3. ブラウザで `https://desktop-hn7hdbv-1.tail16829c.ts.net` にアクセス
4. Discordでログインして完了

---

## 起動・停止コマンド

```bash
# 停止 → クリーンビルド → 起動
docker compose down && docker compose build --no-cache && docker compose up -d

# ログ確認
docker compose logs -f

# 停止のみ
docker compose down
```

---

## ホストPCが落ちている場合

サーバーはホストPC上のDockerで動いているため、ホストPCがスリープ・シャットダウンしているとアクセスできません。

- ホストPCを常時起動にするか、使用前に起動しておく
- スリープ設定をオフにすることを推奨

---

## セキュリティ

- Tailscaleネットワーク外からはアクセス不可（インターネットに公開されない）
- 通信はWireGuardで暗号化済み
- アプリ側はDiscord OAuthで認証（Tailscaleに参加していてもDiscordログインが必要）
