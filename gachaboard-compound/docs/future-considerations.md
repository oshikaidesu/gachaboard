# 将来検討事項

セキュリティ・ライブラリ置き換えのうち、工数が大きいものや現状のスケールでは過剰なものを将来の検討対象として記録する。

---

## 実装済み（Phase 1-4）

- E2E テストモード本番無効化
- パストラバーサル修正（chunkIndex, uploadId, S3 storageKey）
- OGP SSRF 対策
- 認可チェック強化（assertAssetAccess, assertWorkspaceOwner 等）
- Zod 入力バリデーション（comments, workspaces, s3/complete）
- セキュリティヘッダー（X-Frame-Options, X-Content-Type-Options 等）
- ファイルアップロードサイズ制限（MAX_UPLOAD_SIZE, デフォルト 100GB）
- puppeteer を devDependencies へ移動

---

## 1. sync-server 認証

**現状**: y-websocket-server に認証なし。boardId を知っていれば誰でも WebSocket 接続・編集可能。

**選択肢**:
- **プロキシ認証**: Next.js や nginx で WebSocket プロキシを挟み、JWT/Cookie を検証
- **Hocuspocus**: 認証付きの Yjs バックエンド
- 同一ネットワーク内のみ公開で現状維持

**工数**: 大

---

## 2. 型安全 API 層: tRPC / ts-rest

**現状**: フロント↔バック間は `shared/apiTypes.ts` で型を手動共有。API 呼び出しは素の `fetch` で型安全性なし。

**候補**: tRPC, ts-rest, Hono RPC

**注**: Zod バリデーション導入が先決。全面移行は工数大。

**工数**: 大

---

## 3. メディア変換のジョブキュー (pg-boss)

**現状**: ffmpeg 変換が fire-and-forget。同時実行制御なし。

**候補**: pg-boss（PostgreSQL ベース、Redis 不要）, bullmq

**注**: ユーザー数・アップロード頻度が増えたら検討。

**工数**: 大

---

## 4. 小規模ライブラリ置き換え（優先度低）

| 項目 | 現状 | 候補 | 効果 |
|------|------|------|------|
| IndexedDB | `s3UploadSessionStore.ts` 自前 | idb | 可読性向上、型安全 |
| File System Access | `lib/fileAccess.ts` 自前 | browser-fs-access | メンテ済み実装、エッジケース対応 |
| IntersectionObserver | `useVisibility` 等で自前 | react-intersection-observer | SSR 対応 |
| デバウンス | 各所で自前 | lodash.debounce | わずかなコード削減 |
| フォーム | 各所で自前 | react-hook-form + Zod | バリデーション統一 |
| ファイルサイズ表示 | `formatFileSize` (shared/utils) | pretty-bytes | 軽量、多言語対応 |
| 時刻表示 | `formatTime` (lib/formatTime) | date-fns format | 日付も統一可能 |

---

## 5. 依存関係のアップデート

- NextAuth v5 (Auth.js) への移行
- y-websocket v3 へのアップグレード
- Prisma 7.4.2 へのアップデート
