# Phase 2: DB/スキーマ基盤

## 目的

- Guild分離をDBで保証できる最小スキーマを構築する。

## 実装対象

- `nextjs-web/prisma/schema.prisma`
- `nextjs-web/src/lib/db.ts`
- `nextjs-web/prisma/migrations/*`
- `docker-compose.yml`（Postgres永続化）

## 最小モデル

- `User`
- `Guild`
- `GuildMember`
- `Project`（`guildId` 必須）
- `Board`（`projectId` 必須）
- `Asset`（削除GUI・変換状態に備える）
- `MediaComment`（時刻コメント）
- `ObjectReaction`（`shapeId` / `emoji` / `userId`）
- `Connector`（`sourceShapeId` / `targetShapeId` / `routingMode` / `waypoints`）

## タスク

1. Prisma導入と接続設定。
2. 外部キー/ユニーク制約を確定。
3. 初期マイグレーション作成。
4. シード方針（ローカル用）を定義。

## 依存

- 先行: `Phase 0`
- 並行可: `Phase 1`
- 後続に提供: `Phase 3`, `Phase 4`, `Phase 6`, `Phase 7`

## 完了条件

- `Project` と `Board` がGuild境界を越えて参照できない制約になっている。
- `MediaComment` と `ObjectReaction` が `guildId` 境界付きで管理される。
- `Connector` が `guildId/projectId/boardId` 境界付きで管理される。
