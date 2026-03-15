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

## エンジニア向け: 想定される指摘と対応状況

本節では、Tailscale + ローカルサーバー + WebSocket 構成においてレビューで指摘されがちな項目ごとに、**懸念**・**現状**・**推奨**を整理する。

---

### 1. アプリ層認証 — Tailscale への過度な依存

**懸念**  
VPN 経由でしか届かないからといってアプリ層の認証を省略していると、Tailnet 侵入や端末紛失時に全機能が露出する。

**現状**  
- ボード一覧・作成・アップロード・API のほとんどは **Discord OAuth 必須**。未認証では利用できない。
- 例外: 招待リンクのトークン検証・参加 API は未ログインでもワークスペース名の表示および参加処理に利用可能。招待トークンは 32〜64 文字の乱数（`inviteTokenSchema`）で推測困難。

**推奨**  
Tailscale 管理コンソールの乗っ取りや端末紛失に備え、重要運用では Tailscale の MFA 有効化および ACL によるクライアント制限を推奨する。

---

### 2. リアルタイム同期（WebSocket）— ルーム ID と sync-server 認証

**懸念**  
- ルーム ID が漏れれば第三者がボードに参加できるのでは。
- ルーム ID を知らなくても、sync-server を DoS や濫用の標的にできるのでは。
- 接続時にトークン検証がなければ、ネットワークに届く誰でも接続できる。

**現状**  
- **プロトコル**: WebSocket（Yjs）。WebRTC ではなく sync-server（y-websocket-server）経由。
- **ルーム ID**: ボード ID に Prisma の `cuid()` を使用。推測困難。ボードへの HTTP アクセスは `assertBoardAccess(boardId)` でサーバー側検証済みユーザーのみ可能。そのページで `roomId = boardId` として WebSocket に接続する。  
  **ただし** sync-server 自体は「ルーム ID を知っていれば誰でもそのルームに参加できる」実装であり、接続時のトークン検証は行っていない。実質的な制限は「ネットワークに誰が届くか」（Caddy の IP 制限・Tailscale のみ到達可能）に依存している。
- **ルーム ID 不要の DoS**: y-websocket-server は接続時に指定された room 名ごとに 1 本の Y.Doc をメモリに作成する。そのため、**無作為な room 名で大量に接続すると、正当なルーム ID を一切知らなくてもメモリ枯渇による DoS が可能**。同一ルームへの多重接続とメッセージ flood も可能。
- **接続数・レート制限**: sync-server には接続数上限・メッセージレートリミットは未実装。招待 API・OGP API には in-memory レートリミットを実装済み。

**推奨**  
- `/ws` の前面に Caddy を置き、Tailscale（100.64.0.0/10）および localhost（127.0.0.0/8）以外を拒否する IP 制限を入れる（本番では必須に近い）。
- 必要に応じて、プロキシで同一 IP あたりの同時 WebSocket 接続数に上限を設ける、または sync-server をラップして「有効な boardId + トークン」のみ接続許可する認証を検討する。

---

### 3. ファイル保存 — パストラバーサル・インジェクション

**懸念**  
クライアントから渡されたファイル名やキーをそのままストレージパスに使うと、`../` 等によるパストラバーサルやインジェクションのリスクがある。

**現状**  
- アップロード時の S3 キーはサーバー側で `randomUUID() + 拡張子` のみを使用。クライアントのファイル名は DB の `fileName` にのみ保存し、オブジェクトストレージのキーには用いない。
- `s3KeyAssets(storageKey)` は `assets/${storageKey}` の形のみ。`storageKey` の生成はサーバー側に限定し、`../` を含めない。
- API では `assetIdSchema` により `..` / `/` / `\` を禁止し、パストラバーサル・インジェクションを防止している。

**結論**  
ディレクトリトラバーサル対策は実装済み。運用時もクライアント由来の文字列をストレージキーに直接展開していない。

---

### 4. CORS と Content-Security-Policy

**懸念**  
MinIO プロキシで `Access-Control-Allow-Origin: *` のままにしていると、任意オリジンから presigned URL を叩かれる。また CSP が緩いと XSS やリソース読み込みの悪用につながる。

**現状**  
- **CORS**: MinIO プロキシ（`/minio/*`）は `NEXTAUTH_URL` から導出したオリジンのみを `Access-Control-Allow-Origin` に設定。`*` は使用していない。
- **CSP**: `next.config.ts` で Content-Security-Policy を設定。信頼するオリジン・インラインに限定（Next.js のビルド都合で `script-src` に `unsafe-inline` / `unsafe-eval` を含む）。他ドメインからのスクリプト・リソース読み込みは制限している。

**推奨**  
本番では `script-src` を可能な範囲で絞る（Next.js の制約と相談）。font-src / connect-src 等は運用に合わせて必要最小限に留める。

---

### 5. WebSocket 周辺 — CSWSH・メッセージ検証・TLS

**懸念**  
- Origin を検証していないと、悪意あるサイトから同一ユーザーの WebSocket 接続を踏み台にされうる（CSWSH）。
- メッセージ内容の検証が不十分だと XSS や不正データの混入リスクがある。
- 平文の ws:// のままだと盗聴・改ざんのリスクがある。

**現状**  
- **CSWSH**: sync-server（y-websocket-server）は Origin ヘッダーを検証しない。代替として、Caddy で `/ws` を Tailscale IP 範囲および localhost のみに制限する構成を推奨。Caddy を経由すれば、実質 Tailscale 由来の接続のみに限定できる。
- **メッセージ**: Yjs は Y.Doc / Y.Map 等の構造化データのみ扱う。描画内容は compound（tldraw 系）の TLRecord としてシリアライズされる。テキストシェイプの表示と XSS 対策はレンダラおよび compound 側の責務。
- **TLS**: 本番では wss:// を使用すること。Caddy で Tailscale HTTPS を有効にすれば、同一オリジンで `wss://your-machine.ts.net/ws/...` に接続でき、通信は暗号化される。Tailscale を使わない環境でも、リバースプロキシで TLS 終端し wss にすること。

---

### 6. Tailscale ACL（最小特権）

**懸念**  
デフォルトの Tailnet では同一 Tailnet の全ノードが相互にアクセス可能なため、サーバーが広く露出する。

**現状**  
アプリは「Tailnet 内の認証済みユーザー」を信頼する設計。Tailscale 自体の ACL は本アプリでは設定しないが、運用側で制限可能。

**推奨**  
本番運用では、Tailscale の ACL により **Gachaboard を動かすノードへのアクセスを、必要なユーザー・グループに限定**することを推奨する。下記の Tailscale ACL サンプルを参考に、最小権限で設定すること。

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

サーバーノードに `tag:gachaboard-server` を付与し、`group:gachaboard-users` のメンバーのみが当該ノードにアクセスできるようにする。Tailscale 管理コンソールで ACL を編集し、上記を参考に最小権限で設定すること。

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
