"use client";

import { useRef, useEffect, forwardRef } from "react";
import { useEditor } from "@cmpd/compound";

const INTERACTIVE_SELECTORS =
  "button, input, textarea, select, a, [data-volume-slider], [data-comment-row], canvas";

type Props = {
  shapeId: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  /** 空白クリックで選択する場合は true（再生ボタン横の余白など） */
  selectOnEmptyClick?: boolean;
};

/**
 * tldrawシェイプ内でスクロール可能なコンテンツを持つシェイプの外側に配置する。
 * シェイプが選択されている間、ホイール・タッチイベントをtldrawに伝播させず、
 * 内部のoverflow:autoなdivのスクロールだけが効くようにする。
 */
export const WheelGuard = forwardRef<HTMLDivElement, Props>(
  function WheelGuard({ shapeId, style, children, onPointerEnter, onPointerLeave, selectOnEmptyClick }, forwardedRef) {
    const editor = useEditor();
    const internalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;

      const isSelected = () => editor.getSelectedShapeIds().includes(shapeId as never);

      const handleWheel = (e: WheelEvent) => {
        if (isSelected()) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      };

      // モバイル: タッチスクロール中にtldrawがパン操作を奪わないようにする
      // ただしドラッグハンドルで開始したタッチは shape のドラッグ移動を許可するため伝播させる
      const FOCUSABLE = ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"];
      const dragHandleTouchIds = new Set<number>();

      const handleTouchStart = (e: TouchEvent) => {
        if (!isSelected()) return;
        const target = e.target as HTMLElement;
        if (FOCUSABLE.includes(target.tagName)) return;
        if (target.closest("[data-drag-handle]")) {
          for (let i = 0; i < e.touches.length; i++) {
            dragHandleTouchIds.add(e.touches[i].identifier);
          }
          return;
        }
        if (target.hasAttribute("data-shape-frame")) return;
        e.stopPropagation();
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isSelected()) return;
        // ドラッグハンドルで開始したタッチの move は tldraw に伝播させる（shape ドラッグ用）
        for (let i = 0; i < e.touches.length; i++) {
          if (dragHandleTouchIds.has(e.touches[i].identifier)) return;
        }
        e.stopPropagation();
      };

      const handleTouchEnd = (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          dragHandleTouchIds.delete(e.changedTouches[i].identifier);
        }
      };

      const handleTouchCancel = (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          dragHandleTouchIds.delete(e.changedTouches[i].identifier);
        }
      };

      el.addEventListener("wheel", handleWheel, { passive: false });
      el.addEventListener("touchstart", handleTouchStart, { passive: false });
      el.addEventListener("touchmove", handleTouchMove, { passive: false });
      el.addEventListener("touchend", handleTouchEnd, { passive: true });
      el.addEventListener("touchcancel", handleTouchCancel, { passive: true });

      return () => {
        el.removeEventListener("wheel", handleWheel);
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove);
        el.removeEventListener("touchend", handleTouchEnd);
        el.removeEventListener("touchcancel", handleTouchCancel);
      };
    }, [editor, shapeId]);

    const setRef = (node: HTMLDivElement | null) => {
      (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      if (!selectOnEmptyClick) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "VIDEO" || t.tagName === "AUDIO") return;
      if (t.closest(INTERACTIVE_SELECTORS)) return;
      editor.select(shapeId as never);
    };

    return (
      <div
        ref={setRef}
        style={{ ...style, ...(selectOnEmptyClick ? { cursor: "grab" } : undefined) }}
        data-shape-frame
        {...(selectOnEmptyClick ? { "data-drag-handle": "" } : {})}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={handlePointerDown}
      >
        {children}
      </div>
    );
  },
);
