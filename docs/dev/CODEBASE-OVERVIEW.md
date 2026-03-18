# Gachaboard nextjs-web コードベース概要

並列エージェントによる探索結果をまとめたドキュメント（2025年3月時点）。

---

## 1. アーキテクチャ・設計

### 1.1 構成（App Router・ページ・レイアウト）

- **App Router**: `src/app/` 配下で App Router を採用。ルートレイアウトは 1 つのみ（`src/app/layout.tsx`）。`/board` や `/workspace` 配下にネストした `layout.tsx` はなし。
- **ルートレイアウト**: `ThemeProvider` → `AuthProvider`（next-auth `SessionProvider`）で子をラップ。`ThemeToggleFloating`、sonner の Toaster、`globals.css` を読み込み。フォントは Geist / Geist Mono。

**主要ルート**

| パス | 説明 |
|------|------|
| `/` | トップ。未認証はサインイン案内、認証済みは「ワークスペースへ」リンク |
| `/auth/signin` | サインイン（SignInContent） |
| `/auth-error` | 認証エラー用 |
| `/access-denied` | 権限不足時のリダイレクト先 |
| `/workspaces` | ワークスペース一覧（WorkspacesClient） |
| `/workspace/[workspaceId]` | ワークスペース詳細（WorkspaceDetailClient） |
| `/workspace/[workspaceId]/assets` | ワークスペース内アセット一覧 |
| `/board/[boardId]` | ボード画面。CompoundBoard を dynamic import（ssr: false）で表示 |
| `/board/[boardId]/trash` | ゴミ箱（BoardTrashClient） |
| `/board/[boardId]/reaction-preset` | リアクションプリセット（ReactionPresetClient） |
| `/invite/[token]` | 招待リンク（InviteClient） |

- **サーバー/クライアント境界**: 各ページはサーバーコンポーネントで認証・権限・DB 取得を行い、結果をクライアントコンポーネント（`*Client`）に props で渡す。ボード本体は `BoardClient` → `CompoundBoard` でクライアント専用。

### 1.2 状態管理

- **React Context**: `ThemeProvider`、`BoardContext`、`BoardCommentProvider`、`BoardReactionProvider`。認証は next-auth の `SessionProvider`（AuthProvider 内）。
- **Zustand**: 未使用。
- **ボードの実体状態**: `CompoundBoard` 内の `useYjsStore` が Yjs の `Y.Doc` と compound の TLStore を双方向同期。IndexedDB 永続化（`useYjsPersistence`）と WebSocket 同期（`useYjsSync`）、Awareness（`useYjsAwareness`）を組み合わせた協調編集状態。
- **サーバー/クライアント境界**: セッションは `getServerSession(authOptions)` でサーバー、`useSession` 等でクライアント。ボード・ワークスペースのメタ情報やアクセス可否はサーバーで Prisma と `assertWorkspaceAccess` / `assertBoardAccess` で判定。

### 1.3 API・データ

**API ルート（`src/app/api/`）**

- **認証**: `api/auth/[...nextauth]/route.ts`
- **ワークスペース**: `workspaces/route.ts`、`[workspaceId]/route.ts`、`[workspaceId]/boards/`、`[boardId]/route.ts`、`[boardId]/snapshot/route.ts`、`members/route.ts`、`invite/route.ts`
- **アセット**: `assets/route.ts`、`[assetId]/route.ts`、`[assetId]/file`、`thumbnail`、`waveform`、S3 アップロード（upload/s3/init, presign, complete, status）
- **その他**: `ogp/route.ts`、`minio/[...path]/route.ts`（MinIO プロキシ）

**インフラ**

- **DB**: Prisma + PostgreSQL（`src/lib/db/db.ts`、`env.DATABASE_URL`）
- **S3**: `@aws-sdk/client-s3`。アップロードは init → presign → クライアントから S3 直アップロード → complete。セッションは DB に保存。
- **WebSocket**: 同期用に y-websocket。`getSyncWsUrl()`（`src/lib/syncWsUrl.ts`）で URL 取得。ローカルでは `NEXT_PUBLIC_SYNC_WS_URL`、それ以外は同一オリジンの `/ws`。

### 1.4 技術スタック

- **Next.js**: 16.1.6（React 18.2）
- **UI・スタイル**: Tailwind CSS v4。ダークモードは `html` に `.dark` を付与。
- **認証**: next-auth v4.24。Discord プロバイダーのみ（identify）。JWT セッション。
- **エディタ・ボード**: @cmpd/compound 系（editor, state, store, tlschema, assets, utils, validate）
- **協調編集**: Yjs 13.6、y-websocket 2.1、y-indexeddb 9.0
- **その他**: Zod 4、@t3-oss/env-nextjs、sonner、date-fns、Playwright（E2E）

---

## 2. テスト・品質・技術的負債

### 2.1 テスト

- **単体テスト**: `*.test.ts` / `*.spec.ts` は src 配下に存在しない。Vitest / Jest は未使用。
- **E2E**: Playwright のみ。
  - `e2e/smoke.spec.ts` … ボード表示のスモーク
  - `e2e/sync-ui.spec.ts` … 2 ユーザーでのヘッダー・シェイプ同期
  - `e2e/screenshots.spec.ts` … ドキュメント用スクリーンショット
  - `e2e/shapes-screenshots.spec.ts` … シェイプ別スクリーンショット
- **カバー範囲**: スモーク・同期 UI・スクリーンショットが中心。単体・コンポーネント・API のテストはなし。

### 2.2 技術的負債

- **TODO / FIXME / HACK**: 該当コメントはなし。
- **非推奨 API**: `src/lib/validators.ts` に @deprecated 付きの `isValidUploadId` / `isValidChunkIndex` が定義。他ファイルからは未使用。
- **重複コード**: 顕著なコピペパターンは見当たらない。

### 2.3 型・Lint

- **strict モード**: `tsconfig.json` で `"strict": true` 有効。
- **ESLint**: eslint-config-next の `core-web-vitals` と `typescript` を利用。
- **any の使用**:
  - `src/lib/auth/authz.ts` … E2E 擬似セッションを `as any` で返している（1 箇所）
  - `src/app/components/board/boardOverrides.ts` … ツールラベルを `as any`（2 箇所）
  - `src/app/components/collaboration/AwarenessSync.tsx` … `currentPageId as any`（1 箇所）
  - `src/app/shapes/NativeShapeWrappers.tsx` … `ShapeUtil<any>`・`Base as any`・`shape: any` 等、複数箇所
- **型チェック除外**: `tsconfig.json` の `exclude` に `AudioShape.tsx` / `VideoShape.tsx` / `TextFileShape.tsx` / `NativeShapeWrappers.tsx` が含まれており、これらのファイルはコンパイル・型チェック対象外。

---

## 3. セキュリティ・認証・環境変数

### 3.1 認証

- **ログイン方式**: NextAuth.js。Discord OAuth のみ（scope: identify）。セッションは JWT。
- **認可チェック**:
  - **Middleware**: なし（`middleware.ts` は存在しない）
  - **API**: 各 Route Handler 内で `requireLogin()` / `assertWorkspaceAccess()` / `assertBoardAccess()` / `assertAssetReadAccess()` / `assertAssetWriteAccess()` / `assertWorkspaceOwner()` / `assertServerOwner()` 等（`src/lib/auth/authz.ts`）
  - **ページ**: `getServerSession(authOptions)` により未ログイン時は redirect
- **E2E 用バイパス**: `E2E_TEST_MODE` が有効なとき、`X-E2E-User-Id` / `X-E2E-User-Name` ヘッダーで擬似セッションを生成。本番では `env.ts` で `E2E_TEST_MODE && NODE_ENV === "production"` のとき throw して無効化。

### 3.2 環境変数

- **サーバー専用**: NEXTAUTH_SECRET, NEXTAUTH_URL, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DATABASE_URL, MAX_UPLOAD_SIZE, S3 系, SYNC_SERVER_URL, SERVER_OWNER_DISCORD_ID, E2E_TEST_MODE, NODE_ENV 等。
- **クライアント公開**: `NEXT_PUBLIC_SYNC_WS_URL` のみ。
- **テンプレート**: ルートに `.env.example` があり、`npm run setup:env` で `nextjs-web/.env.local` を生成する。nextjs-web 単体の場合は `env.local.template` をコピーして `.env.local` としても可。
- **秘密情報**: @t3-oss/env-nextjs + zod でバリデーション。サーバー用は `server` にのみ定義。

### 3.3 セキュリティ

- **CSRF / XSS**: 同一オリジン前提で明示的 CSRF トークンはなし。XSS 対策として `safeUrl.ts` で http/https のみ許可（`getSafeHref`）、`getSafeAssetId` でパストラバーサル・`../`・`\` を禁止、`getSafeColor` で hex のみ許可。
- **入力バリデーション**: zod を利用（`env.ts`、`validators.ts`、`apiSchemas.ts`）。API では `parseJsonBody` で JSON を zod スキーマで parse。招待トークンは `inviteTokenSchema` で検証。
- **API 認可**: 認証が必要な API は上記の `requireLogin` / `assert*` で保護。認証なしで意図的に公開しているのは **GET /api/invite/[token]** のみ（招待トークン検証・ワークスペース名・ID 返却用）。

---

## 4. パフォーマンス・バンドル・本番ビルド

### 4.1 バンドル

- **next/dynamic**: `BoardClient.tsx` で `CompoundBoard` を `dynamic(..., { ssr: false, loading: ... })` で 1 箇所のみ使用。
- **大きな依存**:
  - fluent-ffmpeg: サーバー側で動的 import のみ。クライアントバンドルには含まれない。
  - yjs / y-websocket: 通常 import でクライアントに含まれる。
  - puppeteer: devDependencies のみ（E2E 用）。

### 4.2 パフォーマンス

- **next/image**: 未使用。OGP は `<img>`。`next.config.ts` の `images.remotePatterns` は Discord CDN のみ許可。
- **キャッシュ**: `useAssetStatus.ts` で `fetch(..., { cache: "no-store" })`。`revalidate` や `unstable_cache` の利用はなし。
- **N+1 / 重いクエリ**: 多くの API は findUnique / findMany を 1 リクエストあたり 1〜2 回に留めている。**snapshot/route.ts** では GET/PUT/PATCH の 3 ハンドラで同じ E2E 分岐＋board 取得ロジックが重複しており、共通化でコード削減の余地あり。

### 4.3 本番ビルド

- **next.config**: `outputFileTracingRoot`、`logging` 抑制、セキュリティヘッダー（X-Frame-Options, X-Content-Type-Options 等）、`experimental.serverActions.bodySizeLimit`、`images.remotePatterns`、`rewrites`（/ws → sync サーバー）等。
- **出力形式**: `output: "standalone"` は未指定。デフォルトの `.next` ビルド。
- **Turbopack**: 未使用。`next build --webpack` で webpack ビルドを明示。

---

## 5. アクション候補（優先度例）

| 優先度 | 内容 |
|--------|------|
| 高 | tsconfig の exclude からメディア系シェイプを外し型チェックを通す、または any を減らす |
| 中 | @deprecated の `isValidUploadId` / `isValidChunkIndex` を削除または利用箇所を整理 |
| 中 | snapshot/route.ts の board 取得ロジックを共通ヘルパーに集約 |
| 低 | 単体テスト（Vitest 等）の導入検討 |
| 低 | .env.example を用意するか README で env.local.template の旨を明示 |
