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
 * シェイプが選択されている間、ホイールイベントをtldrawに伝播させず、
 * 内部のoverflow:autoなdivのスクロールだけが効くようにする。
 */
export const WheelGuard = forwardRef<HTMLDivElement, Props>(
  function WheelGuard({ shapeId, style, children }, forwardedRef) {
    const editor = useEditor();
    const internalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;

      const handleWheel = (e: WheelEvent) => {
        const selected = editor.getSelectedShapeIds();
        if (selected.includes(shapeId as never)) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      };

      el.addEventListener("wheel", handleWheel, { passive: false });
      return () => el.removeEventListener("wheel", handleWheel);
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
