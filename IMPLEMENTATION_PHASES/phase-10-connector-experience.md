# Phase 10: コネクタ体験（draw.io風）

## 目的

- draw.ioのような「吸い付く」ノード接続体験を再現する。
- 単なる線描画ではなく、アンカー管理と経路計算をUI/データ両面で成立させる。

## 実装対象

- `nextjs-web/src/app/project/[projectId]/board/[boardId]/page.tsx`
- `nextjs-web/src/lib/connectors.ts`
- `nextjs-web/src/app/api/connectors/route.ts`
- `nextjs-web/src/app/api/connectors/[connectorId]/route.ts`
- `nextjs-web/prisma/schema.prisma`

## 機能要件

- 接続点（Anchors）
  - 固定接続: 図形の相対位置に固定（回転/移動後も維持）。
  - 浮動接続: 図形外周へ最短距離で追従。
  - 吸着: ポインタ接近時に候補点へスナップ。
- ルーティング
  - 直線/直交（Orthogonal）を切り替え可能。
  - 障害物回避を含む自動再ルーティング。
  - ウェイポイントの手動編集と保持。
- 操作UX
  - 接続中の候補点ハイライト。
  - ドラッグ中のリアルタイムプレビュー。
  - Auto-connect（新規ノード作成と接続の同時実行）。

## 非機能要件

- 500ノード/1000エッジ規模で体感操作を維持。
- 再ルーティング遅延は通常操作で 100ms 以内を目標。
- 大規模時は「ドラッグ中簡易計算 -> ドロップ後精密計算」の2段階処理。

## 想定データモデル（最小）

- `Connector`
  - `id`, `guildId`, `projectId`, `boardId`
  - `sourceShapeId`, `sourceAnchor`
  - `targetShapeId`, `targetAnchor`
  - `routingMode`（`straight|orthogonal`）
  - `waypoints`（JSON）
  - `createdAt`, `updatedAt`, `deletedAt`

## タスク

1. アンカー定義（固定/浮動）とスナップ閾値を実装。
2. コネクタ作成/更新/削除APIを実装。
3. 直交ルーティングと障害物回避を実装。
4. Auto-connectの最小UXを実装。
5. テレメトリ（接続失敗率・再接続率）を計測。

## 依存

- 先行: `Phase 2`, `Phase 3`, `Phase 4`
- 並行可: `Phase 9`

## 完了条件

- ノード移動後も接続が破綻せず、ルールに従い再ルーティングされる。
- 接続候補点への吸着が視覚的に確認できる。
- 他Guildデータに対する接続作成/更新/取得ができない。
