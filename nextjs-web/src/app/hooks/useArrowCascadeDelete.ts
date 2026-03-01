"use client";

import { useCallback } from "react";
import { Editor, type TLRecord, type TLShapeId } from "@tldraw/tldraw";

/**
 * シェイプ削除時に紐づくアローを連鎖削除するフック。
 * Editor の onMount 内で store.listen を登録する関数を返す。
 */
export function useArrowCascadeDelete() {
  const registerListener = useCallback((editor: Editor) => {
    editor.store.listen(
      (entry) => {
        const removedRecords = Object.values(entry.changes.removed);
        const removedShapeIds = new Set(
          removedRecords
            .filter((r): r is TLRecord & { typeName: "shape" } => r.typeName === "shape")
            .map((r) => r.id)
        );
        if (removedShapeIds.size === 0) return;

        const arrowIds = new Set<TLShapeId>();
        for (const record of removedRecords) {
          if (record.typeName !== "binding") continue;
          if (!("type" in record) || record.type !== "arrow") continue;
          if (!("fromId" in record) || !("toId" in record)) continue;
          if (removedShapeIds.has(record.toId as TLShapeId)) {
            arrowIds.add(record.fromId as TLShapeId);
          }
        }

        if (arrowIds.size > 0) {
          editor.deleteShapes([...arrowIds]);
        }
      },
      { source: "user", scope: "document" }
    );
  }, []);

  return { registerListener };
}
