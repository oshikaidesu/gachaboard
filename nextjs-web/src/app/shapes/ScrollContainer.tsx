"use client";

import { useRef, useEffect, forwardRef } from "react";
import { useEditor } from "@tldraw/tldraw";

type Props = {
  shapeId: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/**
 * tldrawシェイプ内でスクロール可能なコンテンツを持つシェイプの外側に配置する。
 * シェイプが選択されている間、ホイール・タッチイベントをtldrawに伝播させず、
 * 内部のoverflow:autoなdivのスクロールだけが効くようにする。
 */
export const WheelGuard = forwardRef<HTMLDivElement, Props>(
  function WheelGuard({ shapeId, style, children }, forwardedRef) {
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
      // ただしinput/button/select/textareaへのタッチはブラウザのフォーカス動作を妨げないよう除外
      const FOCUSABLE = ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"];
      const handleTouchStart = (e: TouchEvent) => {
        if (!isSelected()) return;
        const target = e.target as HTMLElement;
        if (FOCUSABLE.includes(target.tagName)) return;
        e.stopPropagation();
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (isSelected()) {
          e.stopPropagation();
          // スクロール可能な子要素内でのスクロールを許可するためpreventDefaultは呼ばない
        }
      };

      el.addEventListener("wheel", handleWheel, { passive: false });
      el.addEventListener("touchstart", handleTouchStart, { passive: false });
      el.addEventListener("touchmove", handleTouchMove, { passive: false });

      return () => {
        el.removeEventListener("wheel", handleWheel);
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove);
      };
    }, [editor, shapeId]);

    const setRef = (node: HTMLDivElement | null) => {
      (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    return (
      <div ref={setRef} style={style}>
        {children}
      </div>
    );
  },
);
