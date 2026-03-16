"use client";

import { useCallback } from "react";
import { Editor, type TLRecord } from "@cmpd/compound";

/**
 * 新規シェイプ（矢印以外）に createdBy / createdByAvatarUrl を自動付与するフック。
 * placeFile() 経由以外（付箋・長方形など）でも名前ラベル・Discord アイコンが出るようにする。
 */
export function useAutoCreatedBy(
  userId: string,
  userName: string,
  avatarUrl?: string | null
) {
  const registerListener = useCallback(
    (editor: Editor) => {
      editor.store.listen(
        (entry) => {
          const addedShapes = Object.values(entry.changes.added).filter(
            (r): r is TLRecord & { typeName: "shape"; type: string; meta?: Record<string, unknown> } =>
              r.typeName === "shape" && r.type !== "arrow" && r.type !== "draw"
          );
          if (addedShapes.length === 0) return;

          const metaBase: Record<string, unknown> = {
            createdBy: userName,
            createdById: userId,
            createdAt: Date.now(),
            ...(avatarUrl && { createdByAvatarUrl: avatarUrl }),
          };
          const updates = addedShapes
            .filter((s) => !s.meta?.createdBy)
            .map((s) => ({
              ...s,
              meta: { ...s.meta, ...metaBase } as Record<string, unknown>,
            }));

          if (updates.length > 0) {
            editor.store.put(updates as TLRecord[]);
          }
        },
        { source: "user", scope: "document" }
      );
    },
    [userId, userName, avatarUrl]
  );

  return { registerListener };
}
