"use client";

import { useRef, useEffect, forwardRef } from "react";
import { useEditor } from "@cmpd/compound";

type Props = {
  shapeId: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
};

/**
 * tldrawシェイプ内でスクロール可能なコンテンツを持つシェイプの外側に配置する。
 * シェイプが選択されている間、ホイール・タッチイベントをtldrawに伝播させず、
 * 内部のoverflow:autoなdivのスクロールだけが効くようにする。
 */
export const WheelGuard = forwardRef<HTMLDivElement, Props>(
  function WheelGuard({ shapeId, style, children, onPointerEnter, onPointerLeave }, forwardedRef) {
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

    return (
      <div
        ref={setRef}
        style={style}
        data-shape-frame
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {children}
      </div>
    );
  },
);
