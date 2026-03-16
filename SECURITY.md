# セキュリティ方針

本ドキュメントおよびセキュリティ検討には **AI エージェント（LLM ベースのコーディング支援）** を利用しています。実装・運用前にご自身の環境で確認してください。

**セキュリティ水準**: 一般的なセルフホスト Web アプリと同程度。強固な保証や監査は行っておらず、クローズドネットワーク・信頼できる運用者を前提としている。

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

（`Caddyfile` の `reverse_proxy localhost:18580` より前に置く。`npm run setup:tailscale-https`（実体は `scripts/setup/tailscale-https.sh`）で生成した Caddyfile には既に `/ws` の IP 制限付きブロックが含まれるため追加不要。手動で Caddyfile を書いている場合のみ、上記ブロックを `reverse_proxy localhost:18580` より前に追加してください。）

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
- **ルーム ID 不要の DoS（対策済み）**: y-websocket-server は接続時に指定された room 名ごとに 1 本の Y.Doc をメモリに作成する。**sync-server にはトークン検証ゲートを実装済み**。`NEXTAUTH_SECRET` が設定されているとき、ゲートが起動し「有効な boardId を含む短期トークン」を検証してからバックエンドに転送する。トークンは Next.js の `GET /api/sync-token?boardId=xxx` で発行（`assertBoardAccess` 通過者のみ）。無作為な room 名での接続は 403 となり、メモリ枯渇 DoS を防止する。`NEXTAUTH_SECRET` が未設定のときはゲートは動かず y-websocket-server をそのまま起動（従来どおり）。
- **接続数・レート制限**: 招待 API・OGP API には in-memory レートリミットを実装済み。sync-server の接続数上限は未実装。必要ならプロキシで同一 IP あたりの上限を検討。

**推奨**  
- `/ws` の前面に Caddy を置き、Tailscale（100.64.0.0/10）および localhost（127.0.0.0/8）以外を拒否する IP 制限を入れる（本番では必須に近い）。
- Docker で sync-server を動かす場合は `docker-compose.yml` で `NEXTAUTH_SECRET` を渡してゲートを有効にすること。

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

### 4.1 他オリジン・他サイトから触られるリスク

**懸念**  
悪意あるサイト（別オリジン）から、ログイン済みユーザーの Cookie を利用したリクエストや、ログイン後のリダイレクト先の書き換え、iframe によるクリックジャックなどが行われるのでは。

**現状**  
- **クリックジャック**: `Content-Security-Policy: frame-ancestors 'none'` および `X-Frame-Options: DENY` により、本アプリを他サイトの iframe に埋め込めない。
- **オープンリダイレクト**: NextAuth の `redirect` コールバックで、**同一オリジン（baseUrl）の URL または相対パスのみ**を許可している。`/auth/signin?callbackUrl=https://evil.com` のように他ドメインを指定しても、ログイン後は baseUrl に戻る。
- **CORS**: Next.js の API ルートはデフォルトで `Access-Control-Allow-Origin` を付与しない。他オリジンからの `fetch(..., { credentials: "include" })` はブラウザが Cookie を送ってもレスポンスをスクリプトに渡さない。MinIO プロキシは `NEXTAUTH_URL` のオリジンのみ許可。
- **CSRF（ state-changing な POST）**: セッション Cookie は SameSite 未指定時は Lax。他サイトから `<form action="https://本アプリ/api/..." method=POST>` で送ると、トップレベルナビゲーションとして Cookie が送られうる。招待参加（`/api/invite/[token]/join`）等は POST のため、攻撃者が招待リンクのトークンを知っていれば、被害者をそのワークスペースに参加させるリクエストを他サイトのフォームで送ることは理論上可能。招待トークンは推測困難で、参加先が攻撃者制御下である必要があるため、影響は限定的。
- **OGP プレビュー iframe**: 外部 URL の OGP を表示する iframe に `sandbox="allow-scripts allow-same-origin ..."` を付けている。`allow-same-origin` は同一オリジン扱いになるため、読み込み先が悪意ある場合にリスクがある。読み込み先はユーザーが貼ったリンクに依存する。

**推奨**  
重要な操作（ワークスペース作成・削除・招待参加など）をさらに堅牢にしたい場合は、Custom Header（例: `X-Requested-With: XMLHttpRequest`）の必須化や、CSRF トークンの導入を検討する。OGP プレビューは必要に応じて iframe をやめサーバー側でメタデータのみ取得して表示する構成に変更する。

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

## 運用者（オーナー）から見える情報

サーバー・PostgreSQL・MinIO へのアクセス権がある運用者（セルフホストのオーナーや VPS 管理者）は、以下の情報を直接参照・取得できる。利用者は「自前で立てたサーバーなら自分だけ」「他人が立てたインスタンスならその運用者には見える」と理解したうえで利用すること。

| 対象 | 内容 |
|------|------|
| **User** | Discord ID（`discordId`）、表示名（`discordName`）、アバター URL、作成・更新日時。Discord アカウントと紐づく。 |
| **Workspace** | ワークスペース名・説明・招待トークン・オーナー・メンバー一覧・削除日時。 |
| **WorkspaceMember** | 誰がどのワークスペースに参加しているか。 |
| **Board** | ボード名・所属ワークスペース・**snapshotData（JSON）**。`snapshotData` には **ボード上の全シェイプ（図形・テキスト・画像配置・矢印等）の内容と座標**、リアクション、コメント、リアクション絵文字プリセット、保存日時が含まれる。 |
| **Asset** | ファイル名（`fileName`）、MIME 型、サイズ、**ストレージキー**（S3/MinIO 上のオブジェクトキー）。MinIO に直接アクセスすれば **ファイル本体（画像・音声・動画等）** を読み出せる。 |
| **S3UploadSession** | マルチパートアップロード中のセッション情報（アップロード者・ボード・ファイル名・キー等）。 |
| **AuditLog** | 誰がいつどの操作（ワークスペース作成・ボード作成・招待参加・メンバーキック・削除等）をしたか。`userId`・`workspaceId`・`action`・`target`・任意の `metadata`。 |

このほか、**NEXTAUTH_SECRET** を知っていればセッション JWT の検証・偽造が可能であり、**sync-server** のメモリやログを取得すればリアルタイム同期中の Y.Doc 内容を理論上は参照できる（永続化は DB の snapshot に依存）。

**結論**: ボードの描画内容・アップロードファイル・誰が何をしたかの履歴は、運用者からすべて参照可能。機密性の高い利用は「自分が運用するインスタンス」に限定するか、運用者を信頼できる環境で行うこと。

---

## 既知の制限

- **OGP API**: SSRF 対策として localhost・プライベート IP を拒否していますが、DNS rebinding には対応していません。セルフホスト環境では実害は限定的です。
- **E2E テストモード** (`E2E_TEST_MODE=1`): 認証をバイパスするため、本番環境では起動時にエラーで無効化されます。本番では使用しないでください。
- **Server Actions bodySizeLimit**: 大容量アップロード用に 100GB まで許可しています。必要に応じてリバースプロキシで制限してください。

## 脆弱性の報告

セキュリティ上の問題を発見した場合は、次のいずれかの方法で非公開にてプロジェクト管理者まで連絡してください。

- **GitHub**: リポジトリの Security タブから「Private vulnerability report」を送信する
- **Issue**: 非公開で共有できる場合は、タイトルに `[SECURITY]` を付けて Issue を作成する

報告後、数日以内に受領確認の返答をします。修正リリースまでは内容を非公開（embargo）で扱い、修正公開後に謝辞する場合があります。
