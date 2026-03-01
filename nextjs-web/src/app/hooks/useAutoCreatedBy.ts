"use client";

import { useCallback } from "react";
import { Editor, type TLRecord } from "@tldraw/tldraw";

/**
 * 新規シェイプ（矢印以外）に createdBy を自動付与するフック。
 * placeFile() 経由以外（付箋・長方形など）でも名前ラベルが出るようにする。
 */
export function useAutoCreatedBy(userName: string) {
  const registerListener = useCallback(
    (editor: Editor) => {
      editor.store.listen(
        (entry) => {
          const addedShapes = Object.values(entry.changes.added).filter(
            (r): r is TLRecord & { typeName: "shape"; type: string; meta: Record<string, unknown> } =>
              r.typeName === "shape" && r.type !== "arrow"
          );
          if (addedShapes.length === 0) return;

          const updates = addedShapes
            .filter((s) => !s.meta?.createdBy)
            .map((s) => ({
              ...s,
              meta: { ...s.meta, createdBy: userName },
            }));

          if (updates.length > 0) {
            editor.store.put(updates);
          }
        },
        { source: "user", scope: "document" }
      );
    },
    [userName]
  );

  return { registerListener };
}
