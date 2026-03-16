"use client";

/**
 * 他ユーザーが指定 shapeId をドラッグ中かどうかを store から取得する。
 * 該当するときのみ { x, y, color } を返し、他シェイプは null のまま再レンダーを抑制。
 */
import type { TLShapeId } from "@cmpd/tlschema";
import { useEditor } from "@cmpd/editor";
import { useValue } from "@cmpd/state";
import { useMemo } from "react";
import { getSafeColor } from "@/lib/safeUrl";

export function usePeerDragging(shapeId: TLShapeId): { x: number; y: number; color: string } | null {
  const editor = useEditor();
  const localUserId = editor.user.getId();

  const $presences = useMemo(
    () =>
      editor.store.query.records("instance_presence", () => ({
        userId: { neq: localUserId },
      })),
    [editor, localUserId]
  );

  return useValue(
    `peerDragging:${shapeId}`,
    () => {
      const presences = $presences.get();
      for (const p of presences) {
        const dragging = (p.meta as { dragging?: { shapeId: string; x: number; y: number } | null })
          ?.dragging;
        if (dragging?.shapeId === shapeId) {
          const color = getSafeColor(p.color) ?? "#888888";
          return { x: dragging.x, y: dragging.y, color };
        }
      }
      return null;
    },
    [shapeId]
  );
}
