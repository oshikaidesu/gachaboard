# Phase 3: App Router画面導線

## 目的

- Discord/Guild前提の情報設計で `projects -> project -> board` 導線を成立させる。

## 実装対象

- `nextjs-web/src/app/page.tsx`
- `nextjs-web/src/app/(dashboard)/projects/page.tsx`
- `nextjs-web/src/app/project/[projectId]/page.tsx`
- `nextjs-web/src/app/project/[projectId]/board/[boardId]/page.tsx`

## タスク

1. `/projects` に所属Guild内プロジェクト一覧を表示。
2. プロジェクト作成時に `guildId` を必須化。
3. ボードURLでの入室ページを作成（認可前提）。
4. 共有URLのコピー導線を配置。

## 依存

- 先行: `Phase 1`, `Phase 2`
- 後続に提供: `Phase 4`, `Phase 7`

## 完了条件

- 画面遷移だけで、対象Guild内のProject/Boardへ到達できる。
