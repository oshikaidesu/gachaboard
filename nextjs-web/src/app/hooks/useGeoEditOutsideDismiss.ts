import { useCallback } from "react";
import type { Editor, TLShapeId } from "@cmpd/editor";

/** これ以上動いたらドラッグ扱いにし、編集解除しない（パン・テキスト選択ドラッグと競合させない） */
const MOVE_THRESHOLD_PX = 10;

function isInsideEditingGeoTextChrome(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest(
      ".tl-shape[data-shape-type='geo'] .tl-text-label[data-isediting='true']"
    )
  );
}

/**
 * geo シェイプのテキスト編集中に、シェイプ外を「タップ」したら編集を終了する。
 * pointerdown では解除せず、移動量の小さい pointerup のみ解除（ドラッグ発火に上書きされないようにする）。
 */
export function useGeoEditOutsideDismiss() {
  const registerListener = useCallback((editor: Editor) => {
    const container = document.getElementById("compound-editor");
    if (!container) return () => {};

    const pendingByPointer = new Map<
      number,
      { sx: number; sy: number; editingId: TLShapeId }
    >();

    const onPointerDownCapture = (e: PointerEvent) => {
      if (editor.getInstanceState().isReadonly) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;

      const editingId = editor.getEditingShapeId();
      if (!editingId) return;

      const shape = editor.getShape(editingId);
      if (!shape || shape.type !== "geo") return;

      /* textarea 上のドラッグ選択などはヒットテストの取りこぼしがあっても dismiss 対象にしない */
      if (isInsideEditingGeoTextChrome(e.target)) return;

      const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY });
      const margin = 2 / editor.getZoomLevel();

      if (editor.isPointInShape(shape, pagePoint, { hitInside: true, margin })) {
        pendingByPointer.delete(e.pointerId);
        return;
      }

      pendingByPointer.set(e.pointerId, {
        sx: e.clientX,
        sy: e.clientY,
        editingId,
      });
    };

    const tryDismissOnUp = (e: PointerEvent) => {
      if (isInsideEditingGeoTextChrome(e.target)) {
        pendingByPointer.delete(e.pointerId);
        return;
      }
      const pending = pendingByPointer.get(e.pointerId);
      pendingByPointer.delete(e.pointerId);
      if (!pending) return;

      const dx = e.clientX - pending.sx;
      const dy = e.clientY - pending.sy;
      if (dx * dx + dy * dy > MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
        return;
      }

      if (editor.getEditingShapeId() !== pending.editingId) return;

      const shape = editor.getShape(pending.editingId);
      if (!shape || shape.type !== "geo") return;

      const margin = 2 / editor.getZoomLevel();
      const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY });
      if (editor.isPointInShape(shape, pagePoint, { hitInside: true, margin })) {
        return;
      }

      editor.setEditingShape(null);
    };

    const onPointerUpCapture = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      tryDismissOnUp(e);
    };

    const onPointerCancelCapture = (e: PointerEvent) => {
      pendingByPointer.delete(e.pointerId);
    };

    container.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    container.addEventListener("pointerup", onPointerUpCapture, { capture: true });
    container.addEventListener("pointercancel", onPointerCancelCapture, { capture: true });
    return () => {
      pendingByPointer.clear();
      container.removeEventListener("pointerdown", onPointerDownCapture, { capture: true });
      container.removeEventListener("pointerup", onPointerUpCapture, { capture: true });
      container.removeEventListener("pointercancel", onPointerCancelCapture, { capture: true });
    };
  }, []);

  return { registerListener };
}
