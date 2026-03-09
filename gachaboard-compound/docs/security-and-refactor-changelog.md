# セキュリティ・リファクタリング変更履歴

認証・DB・API 周りのセキュリティ改善とライブラリ活用のための組み替えを記録する。

---

## Phase 1: 緊急修正

### 1-1. E2E テストモードの本番無効化
- **ファイル**: `src/lib/env.ts`
- **内容**: `E2E_TEST_MODE` が有効かつ `NODE_ENV === "production"` のとき、起動時に throw してアプリを落とす
- **目的**: 本番での認証バイパス（X-E2E-User-Id ヘッダー等）を防止

### 1-2. パストラバーサル修正
- **新規**: `src/lib/validators.ts`（`isValidUploadId`, `isValidChunkIndex`）
- **対象**:
  - `api/assets/upload/[uploadId]/[chunkIndex]`: chunkIndex を非負整数のみ許可、uploadId を UUID 形式で検証
  - `api/assets/upload/[uploadId]/complete`: uploadId 検証
  - `api/assets/upload/[uploadId]/status`: uploadId 検証
  - `api/assets/upload/s3/complete`: storageKey・fileName 等をクライアントから受け取らず、`S3UploadSession` から取得。uploaderId の照合を追加

### 1-3. OGP SSRF 対策
- **ファイル**: `src/app/api/ogp/route.ts`
- **内容**: `isAllowedUrl()` を追加。localhost、127.0.0.1、プライベート IP、非 HTTP プロトコルを拒否

---

## Phase 2: 認可チェック強化

### 2-1. 認可ヘルパー追加
- **ファイル**: `src/lib/authz.ts`
- **追加関数**:
  - `assertAssetReadAccess(assetId)`: ワークスペースオーナー / アップロード者 / 所属ボードアクセス可のユーザーを許可
  - `assertAssetWriteAccess(assetId)`: ワークスペースオーナー / アップロード者のみ許可（trash/restore/delete 用）
  - `assertWorkspaceWriteAccess(workspaceId)`: オーナーのみ許可（アップロード用）

### 2-2. 各 API への適用
| ルート | 変更内容 |
|--------|----------|
| `assets/[assetId]` GET | `assertAssetReadAccess` |
| `assets/[assetId]` PATCH/DELETE | `assertAssetWriteAccess` |
| `assets/[assetId]/file` HEAD/GET | `assertAssetReadAccess` → 302 リダイレクト（Presigned URL）で S3 直接取得 |
| `assets/[assetId]/thumbnail` GET | `assertAssetReadAccess` → 302 リダイレクト |
| `assets/[assetId]/waveform` GET | `assertAssetReadAccess` → Next.js 経由でプロキシ（fetch CORS 回避） |
| `assets/[assetId]/waveform` GET | `assertAssetReadAccess` |
| `assets` POST | `assertWorkspaceWriteAccess` で workspace 書き込み権限を確認 |
| `assets` GET | `workspaceId` または `boardId` 必須。boardId なら `assertBoardAccess`、workspaceId なら `assertWorkspaceAccess`（SERVER_OWNER モード対応） |
| `workspaces/[workspaceId]` PATCH | 全アクションで `assertWorkspaceOwner` を先に実行（rename の認可漏れを修正） |

---

## Phase 3: Zod 入力バリデーション

### 3-1. 新規ファイル
- **`src/lib/parseJsonBody.ts`**: `parseJsonBody(req, schema)`, `formatZodError(err)`
- **`src/lib/apiSchemas.ts`**: 各 API 用 Zod スキーマ定義

### 3-2. スキーマ適用済みルート
| ルート | スキーマ |
|--------|----------|
| `comments` POST | `createCommentSchema` |
| `workspaces` POST | `createWorkspaceSchema` |
| `assets/upload/s3/complete` POST | `s3CompleteSchema` |

### 3-3. 未適用ルート（将来対応）
- boards, reactions, workspace PATCH, board PATCH, upload/init 等

---

## Phase 4: セキュリティヘッダー・アップロード制限

### 4-1. セキュリティヘッダー
- **ファイル**: `next.config.ts`
- **追加ヘッダー**:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 4-2. アップロードサイズ制限
- **ファイル**: `src/lib/env.ts`, `api/assets/route.ts`, `api/assets/upload/init/route.ts`, `api/assets/upload/s3/init/route.ts`
- **内容**: `MAX_UPLOAD_SIZE`（デフォルト 100GB）でファイルサイズをチェック
- **補足**: 実際の転送はチャンク（S3: 100MB/part）で行うため、メモリ負荷は小さい

### 4-3. その他
- **puppeteer**: `dependencies` → `devDependencies` へ移動

---

## 新規・変更ファイル一覧

| ファイル | 種別 |
|----------|------|
| `src/lib/validators.ts` | 新規 |
| `src/lib/parseJsonBody.ts` | 新規 |
| `src/lib/apiSchemas.ts` | 新規 |
| `src/lib/env.ts` | 変更（E2E ガード、MAX_UPLOAD_SIZE） |
| `src/lib/authz.ts` | 変更（assertAssetReadAccess 等追加） |
| `src/app/api/ogp/route.ts` | 変更（SSRF 対策） |
| `src/app/api/assets/route.ts` | 変更（認可、サイズ制限） |
| `src/app/api/assets/[assetId]/route.ts` | 変更（認可） |
| `src/app/api/assets/[assetId]/file/route.ts` | 変更（認可） |
| `src/app/api/assets/[assetId]/thumbnail/route.ts` | 変更（認可） |
| `src/app/api/assets/[assetId]/waveform/route.ts` | 変更（認可） |
| `src/app/api/assets/upload/[uploadId]/[chunkIndex]/route.ts` | 変更（パストラバーサル対策） |
| `src/app/api/assets/upload/[uploadId]/complete/route.ts` | 変更（uploadId 検証） |
| `src/app/api/assets/upload/[uploadId]/status/route.ts` | 変更（uploadId 検証） |
| `src/app/api/assets/upload/init/route.ts` | 変更（サイズ制限） |
| `src/app/api/assets/upload/s3/init/route.ts` | 変更（サイズ制限） |
| `src/app/api/assets/upload/s3/complete/route.ts` | 変更（セッションから取得、認可、Zod） |
| `src/app/api/workspaces/route.ts` | 変更（Zod） |
| `src/app/api/workspaces/[workspaceId]/route.ts` | 変更（PATCH 認可） |
| `src/app/api/comments/route.ts` | 変更（Zod） |
| `next.config.ts` | 変更（ヘッダー、bodySizeLimit 100gb） |
| `package.json` | 変更（zod 追加、puppeteer → devDeps） |
| `env.local.template` | 変更（MAX_UPLOAD_SIZE コメント、SERVER_OWNER_DISCORD_ID） |

---

## Phase 5: サーバーオーナーモード（ページアクセス制御）

### 5-1. ページのアクセス制御
- **`/workspaces`**: `SERVER_OWNER_DISCORD_ID` 設定時、非オーナーは `/` へリダイレクト
- **`/workspace/[workspaceId]`**: 未ログインはサインインへ、`assertWorkspaceAccess` 失敗時は `/` へリダイレクト
- **`/board/[boardId]`**: `assertBoardAccess` 失敗時は `/` へリダイレクト

### 5-2. API の認可統一
- **`boards/[boardId]` PATCH**: `requireLogin` → `assertWorkspaceAccess` に変更

---

## Phase 6: 招待リンク・ワークスペースメンバー

### 6-1. DB スキーマ
- **Workspace**: `inviteToken String? @unique` 追加
- **WorkspaceMember**: 新規（workspaceId, userId）

### 6-2. 招待リンク API
- `GET /api/workspaces/[workspaceId]/invite`: 現在の招待 URL（オーナーのみ）
- `POST /api/workspaces/[workspaceId]/invite`: 発行・リセット（オーナーのみ）。発行のたびに前のリンクは無効
- `GET /api/invite/[token]`: トークン検証・WS 情報
- `POST /api/invite/[token]/join`: メンバー追加

### 6-3. 認可の拡張
- `assertWorkspaceAccess`, `assertBoardAccess`, `assertWorkspaceWriteAccess`: オーナー or 招待メンバーを許可
- `assertAssetReadAccess`, `assertAssetWriteAccess`: 招待メンバーも許可

### 6-4. メンバー一覧・キック
- **API**
  - `GET /api/workspaces/[workspaceId]/members`: オーナー＋招待メンバー一覧（アクセス可ユーザー）
  - `DELETE /api/workspaces/[workspaceId]/members`: Body `{ userId }` でキック（オーナーのみ）
- **キック権限**: オーナー、または参加から24時間経過した招待メンバー。オーナー不在時の対応を想定
- **キック時の挙動**: 招待リンクを自動リセット（`inviteToken` → null）。旧リンク無効化により、オーナーが再発行すれば再招待可能
- **UI**: WS 詳細ヘッダーにメンバーアイコン（クリックでポップアップ一覧）、オーナーは招待メンバーにキックボタン表示

### 6-5. アクセス拒否ページ
- **`/access-denied`**: 許可されていないときの専用ページ
- オーナーに招待リンクの発行を依頼するよう案内
- `?reason=workspaces`: ワークスペース一覧のオーナー制限用メッセージ
- リダイレクト元: `/workspaces`（非オーナー）、`/workspace/[id]`、`/board/[id]`（招待外）、WorkspaceDetailClient の API 403

---

## Phase 7: Board.reactionEmojiPreset 削除（Y.Doc 統合完了）

- **削除**: `Board.reactionEmojiPreset` カラム（Prisma スキーマ）
- **移行先**: `snapshotData.reactionEmojiPreset`（Y.Doc の reactionEmojiPreset yMap と双方向同期）
- **マイグレーション**: 全 Board の reactionEmojiPreset を snapshotData にコピー後、`prisma db push` でカラム削除

---

## Phase 8: OGP プレビュー XSS 対策

### 8-1. 問題
- **useOgp**: API が 400 を返した場合、未検証の `url` をフォールバックとして返していた
- **OgpCard**: `href={data.url}` に `javascript:` 等が入るとクリックで XSS が発生
- **攻撃経路**: 共同編集者が geo シェイプに `meta.ogpUrls = ["javascript:..."]` を設定し、他ユーザーのクリックで実行

### 8-2. 対策
- **新規**: `src/lib/safeUrl.ts` - `getSafeHref(url)` で `url-sanitizer` により http/https のみ許可。`getSafeColor(color)` で hex のみ許可（CSS インジェクション防止）
- **useOgp**: API 失敗時はフォールバックを返さず `null` を返す
- **OgpPreview**: OgpCard で `data.url` と `data.image` を `getSafeHref` で検証。安全でない場合はリンク・画像を無効化
- **YoutubeCard**: `youtubeId` を正規表現で検証（11 文字の英数字・ハイフン・アンダースコアのみ）

### 8-3. Yjs Awareness 由来データの検証（Phase 8 追加）
- **CollaboratorCursor**: `meta.avatarUrl` を `getSafeHref` で検証
- **UserSharePanel**: `avatarUrl` を `getSafeHref`、`color` を `getSafeColor` で検証
- **AwarenessSync**: store に格納する前に `avatarUrl` と `color` を検証
- **WorkspaceMembersPopover**: API 由来の `avatarUrl` を `getSafeHref` で検証（防御の二重化）

---

## Phase 9: YouTube iframe sandbox & assetId バリデーション

### 9-1. YouTube iframe sandbox 属性の追加
- **問題**: `OgpPreview.tsx` の YouTube embed iframe に `sandbox` 属性がなく、埋め込みコンテンツが親ウィンドウをナビゲートしたりポップアップを開く余地があった
- **対策**: `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"` を追加し、必要最小限の機能のみ許可

### 9-2. assetId CSS injection / パストラバーサル防止
- **問題**: Y.Doc 由来の `shape.props.assetId` が未検証のまま URL パス（`/api/assets/${assetId}/file`）や CSS `backgroundImage: url(...)` に埋め込まれていた。悪意ある共同編集者が:
  - `assetId` に `)`, `url(https://evil.com/...` を仕込んで **CSS injection** で外部 URL を読み込ませる（ユーザートラッキング）
  - `../` 等を仕込んで **パストラバーサル** で意図しない API エンドポイントにリクエストさせる
- **対策**: `src/lib/safeUrl.ts` に `getSafeAssetId()` を追加。英数字・ハイフン・ドット・アンダースコアのみ許可、`/`, `\`, `..` を拒否
- **適用箇所**:
  - `AssetLoader.tsx` - `backgroundImage` の URL 構築
  - `FileIconShape.tsx` - `<img src>` と `<DownloadButton>`
  - `VideoShape.tsx` - `<video src>`, `poster`, `<DownloadButton>`
  - `AudioShape.tsx` - `<audio src>`, `<DownloadButton>`
  - `TextFileShape.tsx` - `<DownloadButton>`
  - `NativeShapeWrappers.tsx` - `WrappedImageShapeUtil` の `apiAssetId`
  - `downloadAsset.ts` - `fetch()` の URL パス
  - `useAssetStatus.ts` - HEAD リクエストの URL パス
  - `useWaveform.ts` - 波形データ取得の URL パス

---

## Phase 10: バックエンド assetId バリデーション

- **目的**: フロントの検証をバイパスして直接 API を叩かれた場合の防御の二重化
- **対策**: `src/lib/validators.ts` に `assetIdSchema`（Zod）を追加。フロントの `getSafeAssetId` と同等ルール
- **適用箇所**:
  - `api/assets/[assetId]/file/route.ts` - HEAD, GET
  - `api/assets/[assetId]/thumbnail/route.ts` - GET
  - `api/assets/[assetId]/waveform/route.ts` - GET
  - `api/assets/[assetId]/route.ts` - GET, PATCH, DELETE
