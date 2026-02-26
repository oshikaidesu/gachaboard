# Phase 4: Guild認可と保護

## 目的

- 他Guildデータを「UI・API・直URL」の全経路で遮断する。

## 実装対象

- `nextjs-web/src/middleware.ts`
- `nextjs-web/src/app/**/page.tsx`（Server Component側ガード）
- `nextjs-web/src/app/api/**/route.ts`（API側ガード）
- `nextjs-web/src/lib/discord.ts`（Guild所属取得）

## タスク

1. 未ログインアクセスをログインへリダイレクト。
2. `project.guildId in userGuildIds` を全クエリで強制。
3. 直URLアクセス時の `403/404` 方針を統一。
4. 監査用ログ（拒否イベント）を最低限残す。

## 依存

- 先行: `Phase 1`, `Phase 2`
- 並行可: `Phase 3`
- 後続に提供: `Phase 6`, `Phase 7`

## 完了条件

- 他Guildの `Project/Board/Asset` は直URLでも取得できない。
