# fresh → compound 移行プラン

## 方針候補: fresh クローン + SDK 差し替え

**内部のSDKを変えるだけ**なので、fresh をクローンして SDK 層だけ差し替える方が効率的かもしれない。

- fresh には Docker, Tailscale, アセット, メディア, コラボ, コネクタ等が既に揃っている
- compound は tldraw のフォーク（Apache 2.0）なので API がほぼ互換
- 差し替え対象:
  - `@tldraw/tldraw` → `@cmpd/compound`（import パス変更）
  - `@tldraw/sync` → `useYjsStore`（Yjs + y-websocket）
  - sync-server: Fastify + tldraw sync-core → y-websocket
  - `Tldraw` コンポーネント → `Compound` コンポーネント
- 影響ファイル: 約25ファイル（shapes, hooks, tools, board, collaboration 等）
- メリット: 既存の fresh のインフラ・機能をそのまま流用できる

---

## 前提

**このシステムの違いは内部SDKのみである。**

| 項目 | gachaboard-compound（移行先） | gachaboard-fresh（参照元） |
|------|------------------------------|----------------------------|
| 描画エンジン | compound (`@cmpd/compound`) | tldraw (`@tldraw/tldraw`) |
| 同期プロトコル | Yjs + y-websocket | @tldraw/sync + Fastify |
| その他 | 認証・Workspace・Board・API・DB 等は同一設計 | 同上 |

認証、Workspace、Board、Asset、API、Prisma スキーマ、導線などは共通設計。**ほぼ全ての機能を compound に移植する予定**であり、**compound が本番候補**である。

---

## 移行パス（2通り）

| パス | 内容 | 工数イメージ |
|------|------|--------------|
| **A. compound に移植** | 現行 compound に fresh の機能を1つずつ移植 | 大（Phase 4〜8 を順に実装） |
| **B. fresh クローン + SDK 差し替え** | fresh をベースに、tldraw → compound の import と sync 層だけ差し替え | 中（約25ファイルの import と sync-server 差し替え） |

**B を推奨**: Docker, Tailscale, 全機能が既に揃っている fresh をベースにした方が早い。

---

## 移植対象の整理

### compound に既にあるもの（Phase 1〜3 完了）

| カテゴリ | 内容 |
|----------|------|
| 認証 | Discord OAuth, NextAuth, セッション拡張 |
| データモデル | User, Workspace, Board, Asset, MediaComment, ObjectReaction, Connector, AuditLog |
| 導線 | / → /workspaces → /workspace/[id] → /board/[id] |
| 認可 | middleware, workspace 境界 |
| カスタムシェイプ | FileIcon, TextFile, Audio, Video, WrappedImage/Note/Geo/Text/Arrow |
| 同期 | Yjs + y-websocket（同期オン）/ persistenceKey（同期オフ） |
| ゴミ箱 | trash/restore API, ゴミ箱ページ |

### fresh から compound に移植するもの

| カテゴリ | fresh の実装 | compound での対応 |
|----------|--------------|-------------------|
| カスタムシェイプ | AudioShape, TextFileShape, VideoShape | compound 用 ShapeUtil に移植 |
| アセット API | アップロード, 取得, waveform, サムネイル, チャンク, S3 presign | API ルート一式を compound に追加 |
| メディア | YouTube, OGP, wav→mp3, 動画変換, GIF | 変換・プレビュー処理を移植 |
| コラボ | リアクション, タイムラインコメント | API + UI を compound 用に移植 |
| コネクタ | ConnectHandles, SmartHandTool, アンカー, ルーティング, 障害物回避 | compound の API に合わせて移植 |
| ファイルドロップ | useFileDropHandler, placeFile, placeAsset | compound 用に実装 |
| その他 | NativeShapeWrappers, 作成者表示 | 必要に応じて移植 |

---

## 移植タスク（マスター）

### Phase 4: アセット・ConnectHandles・SmartHandTool（compound 既存 Phase 4）

- [x] SmartHandTool（select を万能ハンドに差し替え）
- [x] UI overrides（actions 削除, tools 上書き, geo 即配置）
- [x] アセット API 一式（アップロード, 取得, waveform, サムネイル, チャンク, S3）
- [x] ConnectHandles / ShapeConnectHandles（drawio風接続点）
- [x] ファイルドロップ・アップロード（useFileDropHandler, placeFile, placeholderShape）
- [x] AudioShape, TextFileShape, VideoShape

### Phase 5: メディア拡張

- [x] YouTube 埋め込み（EmbedShapeUtil）
- [x] OGP 取得 API（/api/ogp）
- [x] wav→mp3 変換（storage.ts, API route）
- [x] 動画変換（transcodeVideoToLight, サムネイル）
- [ ] GIF 対応（要確認）

### Phase 6: コラボ機能

- [x] リアクション API + UI（BoardReactionProvider, ShapeReactionPanel）
- [x] タイムラインコメント API + UI（/api/comments, Audio/VideoShape）
- [x] 作成者表示（NativeShapeWrappers, CreatorLabel）

### Phase 7: コネクタ体験

- [ ] 固定・浮動アンカー
- [ ] ルーティング（直線/直交）
- [ ] 障害物回避
- [ ] Waypoint 手動編集
- [ ] Connector CRUD API

### Phase 8: その他

- [x] チャンクアップロード, S3 presign（API 実装済み）
- [ ] E2E テスト導線の統一
- [ ] 環境変数・設定の統一

---

## 完了条件

- compound が本番候補として、fresh の機能をほぼ網羅している
- 認証 → Workspace → Board → アセット → リアクション → コメント → コネクタ の一連フローが compound で成立
- 同期オン/オフの両モードで永続化が成立
- fresh は参照元として残し、本番は compound に一本化

---

## 依存関係

- compound Phase 1〜3 は完了済み
- fresh の実装を compound の compound/Yjs API に合わせて移植
- データ形式の互換性は不要（Yjs と sync-core は別プロトコル）

---

## 更新履歴

- 2026-03-06: Phase 4〜6, 8 の完了項目を更新（アセット, ConnectHandles, ファイルドロップ, メディア変換, リアクション, コメント, 作成者表示, S3/チャンク）
- 2026-03-06: 初版作成（移行先は compound、fresh から移植）
