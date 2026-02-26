# Phase 8: タイムラインコメント

## 目的

- SoundCloudのように、音声波形上の時刻にコメントを紐づける。
- 同様に動画タイムライン上の時刻にもコメントを紐づける。
- コメントを共同編集文脈（Guild境界・URL参加）で安全に共有する。

## 実装対象

- `nextjs-web/src/app/project/[projectId]/board/[boardId]/page.tsx`
- `nextjs-web/src/app/api/media/comments/route.ts`
- `nextjs-web/src/app/api/media/comments/[commentId]/route.ts`
- `nextjs-web/src/lib/media-comments.ts`
- `nextjs-web/prisma/schema.prisma`

## 想定データモデル（最小）

- `MediaComment`
  - `id`
  - `assetId`
  - `projectId`
  - `guildId`
  - `authorUserId`
  - `timeSec`（コメント時刻）
  - `body`
  - `createdAt`
  - `updatedAt`
  - `deletedAt`

## タスク

1. コメントAPI（作成/一覧/更新/削除）を実装。
2. 再生ヘッド時刻と連動するコメントUIを実装。
3. コメントクリックで指定時刻へシークする。
4. Guild境界をAPIとDBクエリで強制する。
5. 大量コメント時のページング/仮想化を導入する。

## UX仕様（初期）

- 音声: 波形クリックで `timeSec` をセットし、その時刻にコメント投稿。
- 動画: 再生バー位置でコメント投稿し、コメント一覧クリックでその時刻にジャンプ。
- 同一時刻に複数コメントがある場合はスレッド風に束ねる。

## 依存

- 先行: `Phase 2`, `Phase 4`, `Phase 7`

## 完了条件

- 音声/動画の時刻にコメントを付与して再生位置と相互ジャンプできる。
- 他Guildユーザはコメントを閲覧/投稿できない。
- コメント削除/編集が監査ログに残る。
