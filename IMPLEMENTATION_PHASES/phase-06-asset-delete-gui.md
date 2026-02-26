# Phase 6: 資産削除GUI

## 目的

- 作業後に不要資産をアプリ内GUIで安全に削除できるようにする。

## 実装対象

- `nextjs-web/src/app/(dashboard)/assets/page.tsx`
- `nextjs-web/src/app/api/assets/[assetId]/route.ts`
- `nextjs-web/src/lib/storage.ts`
- `nextjs-web/src/lib/audit.ts`

## タスク

1. アクセス可能な資産のみ一覧表示（Guild境界付き）。
2. 資産単位削除API（DB + 実体）を実装。
3. 削除確認ダイアログを追加。
4. 削除ログ（`userId`, `assetId`, `deletedAt`）を記録。

## 依存

- 先行: `Phase 2`, `Phase 4`, `Phase 5`

## 完了条件

- GUI削除後に対象資産が再取得できない。
