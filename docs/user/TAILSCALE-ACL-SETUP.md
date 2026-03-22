# Tailscale ACL セットアップ

Gachaboard を Tailscale 経由で公開する際、**サーバーに届くトラフィックを必要なユーザーのみに限定**するための ACL 設定手順です。デフォルトでは同一 tailnet の全ノードが相互にアクセス可能なため、本番運用では ACL による制限を推奨します。

## 概要

- **groups**: アクセスを許可するメールアドレスをグループ化
- **acls**: グループ → サーバータグへの接続を許可
- **tagOwners**: 誰がサーバーに `tag:gachaboard-server` を付与できるか

## 手順

### 1. Tailscale Admin Console で ACL を編集

1. [Tailscale Admin Console](https://login.tailscale.com/admin/acls) にログイン
2. **Access control** → **Edit ACL policy** を開く
3. 以下の JSON をベースに、自環境用に編集する

### 2. サンプル設定（コピー用）

[config/tailscale-acl.example.json](../../config/tailscale-acl.example.json) を参照するか、以下をベースにする:

```json
{
  "groups": {
    "group:gachaboard-users": ["user1@example.com", "user2@example.com"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["group:gachaboard-users"],
      "dst": ["tag:gachaboard-server:*"]
    }
  ],
  "tagOwners": {
    "tag:gachaboard-server": ["group:gachaboard-users"]
  }
}
```

### 3. 編集ポイント

| 項目 | 説明 |
|------|------|
| `group:gachaboard-users` | Gachaboard にアクセス可能なメンバーのメールアドレス（Tailscale アカウントと同じ）を列挙 |
| `tag:gachaboard-server` | Gachaboard サーバーとなるノードに付与するタグ |
| `tagOwners` | 上記タグを付与できるユーザー・グループ。運用者だけにしておく |

### 4. サーバーノードにタグを付与

1. Admin Console → **Machines**
2. Gachaboard を動かしているマシンを選択
3. **Edit route settings** 等から **Tags** に `tag:gachaboard-server` を追加
4. 保存

### 5. 動作確認

- **許可されたユーザー**: Tailscale 経由で `https://<your-machine>.ts.net` にアクセスできる
- **非許可ユーザー**: 接続が拒否されるか、到達しない

## 既存 ACL との統合

既に他の ACL ルールがある場合は、`acls` 配列に上記の `action: "accept"` ブロックを追加する。既存の `groups` がある場合は、`group:gachaboard-users` を既存グループ名に置き換えてもよい。

## 関連

- [SECURITY.md](../../SECURITY.md) セクション「Tailscale ACL（最小特権）」
- [SECURITY-AUDIT-CHECKLIST.md](SECURITY-AUDIT-CHECKLIST.md) セクション「Tailscale ACL」
