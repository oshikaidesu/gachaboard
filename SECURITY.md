# セキュリティ方針

本ドキュメントおよびセキュリティ検討には **AI エージェント（LLM ベースのコーディング支援）** を利用しています。実装・運用前にご自身の環境で確認してください。

## 信頼境界（Trust Boundary）

Gachaboard は **セルフホスト・クローズドネットワーク** を前提としています。

- **信頼するもの**: 同一ネットワーク（または Tailscale 等でアクセスを限定した環境）にいるユーザー
- **認証**: Discord OAuth により「誰か」を識別。サーバーオーナー制限（`SERVER_OWNER_DISCORD_ID`）でワークスペース作成を制限可能
- **sync-server（Yjs WebSocket）**: 接続時の認証は行っていません。**ネットワークに到達できるクライアントは誰でもボードの共同編集に参加できます。** インターネットに直接露出させる場合は、リバースプロキシで IP 制限や認証を検討してください。
- **MinIO プロキシ** (`/minio/*`): 認証は行わず、presigned URL の署名に依存しています。URL を知っている者のみが有効に操作できます。CORS はアプリのオリジン（`NEXTAUTH_URL`）のみ許可しています。

## 本番デプロイ時の推奨事項

1. **PostgreSQL / MinIO**: デフォルトのパスワード（`gachaboard` / `minioadmin`）を必ず変更する
2. **NEXTAUTH_SECRET**: 推測困難な長い乱数にする
3. **ネットワーク**: sync-server や MinIO をインターネットに直接公開しない（Next.js アプリ経由または同一ホスト内に留める）
4. **/ws（WebSocket）の IP 制限**: Caddy を使っている場合は、`/ws` を Tailscale（100.64.0.0/10）や localhost（127.0.0.0/8）のみ許可するブロックを入れると安全です。**重くならない**: チェックは接続確立時の 1 回だけ。接続後の WebSocket トラフィックは Caddy がそのまま透過するため、オーバーヘッドはほぼありません。
5. **レートリミット**: 招待 API・OGP API には簡易的な in-memory レートリミットを実装済み。複数インスタンスやより厳しい制限が必要な場合は、リバースプロキシ（nginx / Caddy 等）や Redis ベースのレートリミットを検討すること。

### Caddy で /ws を制限する例

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

（`Caddyfile` の `reverse_proxy localhost:18580` より前に置く。Tailscale HTTPS 用の Caddyfile を `setup-tailscale-https.sh` で生成している場合は、生成後に上記ブロックを先頭付近に追加してください。）

## エンジニア向け: 突っ込みポイントと現状

Tailscale + ローカルサーバー + WebSocket 構成でよく指摘される点と、本プロジェクトの対応状況です。

### 1. 「Tailscale の信頼に依存しすぎていないか」— アプリ層認証

- **現状**: **Discord OAuth 必須**。ログインしないとボード一覧・作成・アップロード・API のほとんどにアクセスできません。Tailnet 内だからといって認証を省略していません。
- **境界**: 招待リンクの「トークン検証」「参加」API は未ログインでも一部利用可能（ワークスペース名の表示・参加処理）。招待トークンは 32〜64 文字の乱数（`inviteTokenSchema`）で推測困難です。
- **推奨**: VPN 管理コンソールの乗っ取りや端末紛失に備え、重要な運用では Tailscale の MFA や ACL でクライアントを制限してください。

### 2. ホワイトボードのリアルタイム通信（WebSocket）— ルーム ID と認証

- **方式**: **WebSocket（Yjs）**。WebRTC ではなく sync-server（y-websocket-server）経由です。
- **ルーム ID**: ボード ID = **Prisma の `cuid()`**。連番や短い文字列ではなく、推測困難です。ボードへのアクセスは `assertBoardAccess(boardId)` でサーバー側検証済みのユーザーだけがページを開け、そのページで `roomId = boardId` として WebSocket に接続します。
- **突っ込み「他人のボードに忍び込めないか」**: ボード ID を知らないとルームに入れません。ID は「ボード一覧・招待・URL」でアクセス権があるユーザーにのみ開示されます。**ただし** sync-server 自体は「ルーム ID を知っていれば誰でも購読できる」実装です。ネットワーク層（Caddy の IP 制限や Tailscale のみ到達可能）で「誰が接続できるか」を制限している前提です。
- **Handshake 認証**: sync-server（y-websocket-server）は **接続時のトークン検証をしていません**。アプリ層では「ボードページを開ける = 認証済み」であり、そのページだけが `roomId` を知っている設計です。プロキシで `/ws` を Tailscale または localhost のみに制限している場合は、実質「Tailnet 内の認証済みユーザーだけがルーム ID を知っている」状態になります。

### 3. ローカルサーバーへのファイル書き込み — パストラバーサル

- **現状**: アップロードファイルの **保存キーはサーバー側で `randomUUID() + 拡張子`**。クライアントのファイル名は DB の `fileName` にのみ保存し、S3 キーには使っていません。`s3KeyAssets(storageKey)` は `assets/${storageKey}` のみで、`storageKey` に `../` は含まれません。
- **assetId**: API では `assetIdSchema` で `..` / `/` / `\` を禁止し、パストラバーサル・インジェクションを防いでいます。
- **結論**: ディレクトリ・トラバーサル対策は実装済みです。

### 4. CORS / CSP

- **CORS**: MinIO プロキシは **`NEXTAUTH_URL` のオリジンのみ**許可。`*` にはしていません。
- **CSP**: `next.config.ts` で **Content-Security-Policy** を設定し、信頼できるオリジン・インラインに限定しています（Next.js のビルド都合で `script-src` に `unsafe-inline` / `unsafe-eval` を含めています）。悪意あるサイトを別タブで開いた場合のクロスオリジン読み取りを抑止します。

### 5. WebSocket まわりの追加ポイント

- **CSWSH（クロスサイト WebSocket ハイジャック）**: sync-server（y-websocket-server）は **Origin ヘッダーを検証していません**。代わりに **Caddy で `/ws` を Tailscale IP 範囲・localhost のみに制限**している構成を推奨しています。同一 Tailnet 内の悪意あるサイトから `ws://` で直接 sync-server に繋がる経路は、Caddy を前に立てれば Tailscale 由来の接続のみに限定できます。
- **メッセージの検証**: Yjs は **構造化データ（Y.Doc / Y.Map）** のみ。描画内容は compound（tldraw 系）の TLRecord としてシリアライズされています。テキストシェイプの表示はレンダラ側に依存しますが、XSS 対策は compound 側の責務です。
- **DoS（接続数・メッセージ量）**: 招待・OGP API にはレートリミットを実装済み。**sync-server には接続数上限・メッセージレートリミットはありません**。同一ネットワーク内の信頼を前提としており、必要ならリバースプロキシや y-websocket-server のラッパーで制限を検討してください。
- **ws と wss**: 本番では **wss://（TLS）** を推奨します。Caddy で Tailscale HTTPS を有効にすると、`https://your-machine.ts.net` 経由でブラウザが `wss://your-machine.ts.net/ws/...` に接続でき、通信は暗号化されます。Tailscale を使わない環境で動かす場合も、リバースプロキシで TLS 終端して wss にしてください。

### 6. Tailscale ACL（最小特権）

- **現状**: デフォルトの Tailnet では「同じ Tailnet の全ノードが相互にアクセス可能」です。本アプリは「Tailnet 内の認証済みユーザー」を信頼する設計です。
- **推奨**: 本番運用では、Tailscale の ACL で **サーバー（Gachaboard を動かすノード）へのアクセスを必要なユーザー・グループに限定**することを推奨します。サンプルは下記「Tailscale ACL サンプル」を参照してください。

#### Tailscale ACL サンプル

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

- サーバーに `tag:gachaboard-server` を付与し、`group:gachaboard-users` だけがそのタグのマシンにアクセスできるようにします。Tailscale の管理コンソールで ACL を編集し、上記を参考に最小権限を設定してください。

---

## バイナリ（画像・ファイル）の扱い

画像貼り付けやファイル添付の **バイナリは WebSocket では送りません**。流れは次のとおりです。

1. **アップロード**: ブラウザ → Next.js API（`/api/assets/upload/s3/init` 等）で認証し、presigned URL を取得 → ブラウザから **S3/MinIO に直接** マルチパートアップロード。
2. **メタデータ**: アップロード完了後、Next.js API で Asset を DB に登録。**WebSocket（Yjs）で同期するのは「どのアセットをボードのどこに置くか」というメタデータ（TLRecord）のみ**です。
3. **取得**: 再生・表示時は `/api/assets/[id]/file` 等で認証し、presigned URL にリダイレクトして S3 から取得します。

そのため「WebSocket 上で巨大バイナリが流れて DoS になる」「描画データにバイナリを埋め込んで XSS」といったリスクは、設計上抑えられています。

---

## 既知の制限

- **OGP API**: SSRF 対策として localhost・プライベート IP を拒否していますが、DNS rebinding には対応していません。セルフホスト環境では実害は限定的です。
- **E2E テストモード** (`E2E_TEST_MODE=1`): 認証をバイパスするため、本番環境では起動時にエラーで無効化されます。本番では使用しないでください。
- **Server Actions bodySizeLimit**: 大容量アップロード用に 100GB まで許可しています。必要に応じてリバースプロキシで制限してください。

## 脆弱性の報告

セキュリティ上の問題を発見した場合は、Issue または非公開でプロジェクト管理者まで連絡してください。
