"use client";

import { useRef, useEffect } from "react";
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
export function WheelGuard({ shapeId, style, children }: Props) {
  const editor = useEditor();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
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

  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}
