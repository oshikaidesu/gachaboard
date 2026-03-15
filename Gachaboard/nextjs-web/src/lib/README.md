# lib 構成

`src/lib` は責務ごとに段階的に整理しています。

## ドメイン別

- `auth/`: 認証・認可（`auth.ts`, `authz.ts`）
- `db/`: Prisma 接続・共通ヘルパー（`db.ts`, `prismaHelpers.ts`）
- `storage/`: S3/ストレージ関連（`s3.ts`, `storage.ts`, `s3Upload.ts`, `s3UploadSessionStore.ts`）
- `ffmpeg/`: 変換処理

## 互換レイヤー

既存 import との互換のため、`src/lib/*.ts` に再エクスポートを残しています。
新規コードは `@/lib/auth/*`, `@/lib/db/*`, `@/lib/storage/*` を優先してください。
