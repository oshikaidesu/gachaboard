# Phase 9: オブジェクトリアクション（Twemoji）

## 目的

- ホワイトボード上の任意オブジェクト（shape）に対して、Twemojiリアクションを添付できるようにする。
- 共同編集中にリアクションをリアルタイム共有し、意思表示を軽量化する。

## 実装対象

- `nextjs-web/src/app/project/[projectId]/board/[boardId]/page.tsx`
- `nextjs-web/src/app/api/reactions/route.ts`
- `nextjs-web/src/app/api/reactions/[reactionId]/route.ts`
- `nextjs-web/src/lib/reactions.ts`
- `nextjs-web/prisma/schema.prisma`

## 想定データモデル（最小）

- `ObjectReaction`
  - `id`
  - `guildId`
  - `projectId`
  - `boardId`
  - `shapeId`
  - `emoji`（Unicode、Twemoji対応）
  - `userId`
  - `createdAt`
  - `deletedAt`

## タスク

1. リアクションAPI（追加/解除/一覧）を実装。
2. `shapeId` 単位でリアクション集計（emojiごとの件数）を実装。
3. 同一ユーザの重複リアクション制御（同emojiはトグル）を実装。
4. ボードUIでリアクションピッカーを表示（Twemoji一覧）。
5. Guild境界の認可をAPI/DBで強制する。

## UX仕様（初期）

- オブジェクト選択時にリアクションボタンを表示。
- クリックでTwemojiピッカーを開く。
- 付与済みリアクションは件数バッジ付きで表示。
- 自分のリアクションは再クリックで解除。

## 依存

- 先行: `Phase 2`, `Phase 3`, `Phase 4`
- 並行可: `Phase 8`

## 完了条件

- オブジェクトにTwemojiリアクションを付与/解除できる。
- リアクション件数が複数ユーザで正しく集計表示される。
- 他Guildのオブジェクトへリアクション操作できない。
