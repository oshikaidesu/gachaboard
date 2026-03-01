"use client";

import { useRef } from "react";
import { useEditor, useValue, createShapeId, TLShapeId } from "@tldraw/tldraw";

type Dir = "top" | "bottom" | "left" | "right";

// シェイプローカル座標系での三角形サイズ
const TRI_W = 7;  // 底辺半幅
const TRI_H = 7;  // 高さ
const OFFSET = 14; // シェイプ枠からの外側オフセット（ローカルpx）

const ANCHOR: Record<Dir, { x: number; y: number }> = {
  top:    { x: 0.5, y: 0 },
  bottom: { x: 0.5, y: 1 },
  left:   { x: 0,   y: 0.5 },
  right:  { x: 1,   y: 0.5 },
};

// 先端が外側を向く三角形の頂点（cx,cy = 先端座標）
function triPoints(dir: Dir, cx: number, cy: number): string {
  switch (dir) {
    case "top":    return `${cx},${cy} ${cx - TRI_W},${cy + TRI_H} ${cx + TRI_W},${cy + TRI_H}`;
    case "bottom": return `${cx},${cy} ${cx - TRI_W},${cy - TRI_H} ${cx + TRI_W},${cy - TRI_H}`;
    case "left":   return `${cx},${cy} ${cx + TRI_H},${cy - TRI_W} ${cx + TRI_H},${cy + TRI_W}`;
    case "right":  return `${cx},${cy} ${cx - TRI_H},${cy - TRI_W} ${cx - TRI_H},${cy + TRI_W}`;
  }
}

type Props = {
  shapeId: TLShapeId;
  w: number;
  h: number;
};

/**
 * シェイプの HTMLContainer 内に配置する矢印接続ハンドル。
 * シェイプのローカル座標系で描画するため、ズーム・リサイズに自動追従する。
 */
export function ShapeConnectHandles({ shapeId, w, h }: Props) {
  const editor = useEditor();
  const dragging = useRef<TLShapeId | null>(null);

  // このシェイプが単独選択されているときだけ表示
  const visible = useValue("shape-connect-visible", () => {
    if (editor.getCurrentToolId() !== "select") return false;
    const selected = editor.getSelectedShapeIds();
    return selected.length === 1 && selected[0] === shapeId;
  }, [editor, shapeId]);

  if (!visible) return null;

  // シェイプローカル座標でのアンカー点
  const localAnchors: Record<Dir, { x: number; y: number }> = {
    top:    { x: w / 2,  y: 0 },
    bottom: { x: w / 2,  y: h },
    left:   { x: 0,      y: h / 2 },
    right:  { x: w,      y: h / 2 },
  };

  // 三角形の先端座標（ローカル座標系）
  const tipPos: Record<Dir, { x: number; y: number }> = {
    top:    { x: w / 2,       y: -OFFSET },
    bottom: { x: w / 2,       y: h + OFFSET },
    left:   { x: -OFFSET,     y: h / 2 },
    right:  { x: w + OFFSET,  y: h / 2 },
  };

  function onPointerDown(e: React.PointerEvent, dir: Dir) {
    e.stopPropagation();
    e.preventDefault();

    // ローカル座標 → ページ座標に変換してアロー始点を決める
    const shape = editor.getShape(shapeId);
    if (!shape) return;
    const pageAnchor = editor.getShapePageTransform(shapeId).applyToPoint(localAnchors[dir]);

    const arrowId = createShapeId();
    dragging.current = arrowId;

    editor.run(() => {
      editor.createShape({
        id: arrowId,
        type: "arrow",
        x: 0,
        y: 0,
        props: {
          kind: "arc",
          start: { x: pageAnchor.x, y: pageAnchor.y },
          end:   { x: pageAnchor.x, y: pageAnchor.y },
          arrowheadStart: "none",
          arrowheadEnd: "arrow",
          bend: 0,
        },
      });
      editor.createBinding({
        type: "arrow",
        fromId: arrowId,
        toId: shapeId,
        props: {
          terminal: "start",
          normalizedAnchor: ANCHOR[dir],
          isExact: false,
          isPrecise: true,
          snap: "none",
        },
      });
    });

    function onMove(ev: PointerEvent) {
      if (!dragging.current) return;
      const p = editor.screenToPage({ x: ev.clientX, y: ev.clientY });
      editor.updateShape({
        id: dragging.current,
        type: "arrow",
        props: { end: { x: p.x, y: p.y } },
      });
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!dragging.current) return;

      const p = editor.screenToPage({ x: ev.clientX, y: ev.clientY });
      const target = editor.getShapeAtPoint(p, {
        filter: (s) => s.id !== shapeId && s.type !== "arrow",
      });

      if (target) {
        editor.createBinding({
          type: "arrow",
          fromId: dragging.current!,
          toId: target.id,
          props: {
            terminal: "end",
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
            isPrecise: false,
            snap: "none",
          },
        });
      } else {
        editor.deleteShape(dragging.current!);
      }

      dragging.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const DIRS: Dir[] = ["top", "bottom", "left", "right"];

  return (
    <svg
      style={{
        position: "absolute",
        // SVG はシェイプと同じ左上原点・同じサイズ、overflow: visible で外側に描画
        top: 0,
        left: 0,
        width: w,
        height: h,
        overflow: "visible",
        pointerEvents: "none",
        // tldraw の選択ハンドルより手前
        zIndex: 500,
      }}
    >
      {DIRS.map((dir) => {
        const tip = tipPos[dir];
        return (
          <polygon
            key={dir}
            points={triPoints(dir, tip.x, tip.y)}
            fill="#6366f1"
            stroke="#fff"
            strokeWidth={1.5}
            strokeLinejoin="round"
            style={{ pointerEvents: "all", cursor: "crosshair" }}
            onPointerDown={(e) => onPointerDown(e, dir)}
          />
        );
      })}
    </svg>
  );
}
