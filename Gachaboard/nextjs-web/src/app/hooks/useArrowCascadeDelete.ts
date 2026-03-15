"use client";

import { useCallback } from "react";
import { Editor, type TLRecord, type TLShapeId } from "@cmpd/compound";

type ArrowProps = {
  start?: { type?: string; boundShapeId?: TLShapeId };
  end?: { type?: string; boundShapeId?: TLShapeId };
};

function arrowRefersTo(props: ArrowProps, targetIds: Set<TLShapeId>): boolean {
  if (props.start?.type === "binding" && props.start.boundShapeId && targetIds.has(props.start.boundShapeId)) return true;
  if (props.end?.type === "binding" && props.end.boundShapeId && targetIds.has(props.end.boundShapeId)) return true;
  return false;
}

/**
 * シェイプ削除時に紐づくアローを連鎖削除するフック。
 *
 * compound (tldraw v2) では binding が矢印の props 内にあるため、
 * (1) 削除されたレコード自身が矢印かつ boundShapeId が削除対象
 * (2) ページに残っている矢印の boundShapeId が削除対象
 * (3) 更新された矢印（binding → point に変換された）の旧 props を確認
 * の 3 経路で検出する。
 */
export function useArrowCascadeDelete() {
  const registerListener = useCallback((editor: Editor) => {
    editor.store.listen(
      (entry) => {
        const removedRecords = Object.values(entry.changes.removed);
        const nonArrowRemovedIds = new Set<TLShapeId>(
          removedRecords
            .filter((r) => r.typeName === "shape" && (r as { type?: string }).type !== "arrow")
            .map((r) => r.id as TLShapeId)
        );
        if (nonArrowRemovedIds.size === 0) return;

        const arrowIds = new Set<TLShapeId>();

        // (1) 削除レコード内の矢印をチェック
        for (const record of removedRecords) {
          if (record.typeName !== "shape" || (record as { type?: string }).type !== "arrow") continue;
          if (arrowRefersTo((record as { props: ArrowProps }).props, nonArrowRemovedIds)) {
            // すでに削除済みなので追加不要
          }
        }

        // (2) ページに残っている矢印をチェック
        for (const shape of editor.getCurrentPageShapes()) {
          if (shape.type !== "arrow") continue;
          if (arrowRefersTo(shape.props as ArrowProps, nonArrowRemovedIds)) {
            arrowIds.add(shape.id);
          }
        }

        // (3) 更新された矢印の旧 props をチェック（binding → point 変換を検出）
        for (const [before] of Object.values(entry.changes.updated)) {
          if (before.typeName !== "shape" || (before as { type?: string }).type !== "arrow") continue;
          if (arrowRefersTo((before as { props: ArrowProps }).props, nonArrowRemovedIds)) {
            const id = before.id as TLShapeId;
            if (editor.getShape(id)) arrowIds.add(id);
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
