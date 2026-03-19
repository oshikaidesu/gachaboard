/**
 * ゴミ箱画面のユーティリティ（ソート等）。
 */

import type { TrashAsset, SortKey } from "./types";

export function sortTrashAssets(assets: TrashAsset[], key: SortKey): TrashAsset[] {
  return [...assets].sort((a, b) => {
    switch (key) {
      case "deletedAt_desc":
        return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
      case "deletedAt_asc":
        return new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
      case "size_desc":
        return Number(b.sizeBytes) - Number(a.sizeBytes);
      case "size_asc":
        return Number(a.sizeBytes) - Number(b.sizeBytes);
    }
  });
}
