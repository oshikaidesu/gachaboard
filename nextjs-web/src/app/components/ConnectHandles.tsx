"use client";

import { useRef } from "react";
import { useEditor, useValue, createShapeId, TLShapeId } from "@tldraw/tldraw";

type Dir = "top" | "bottom" | "left" | "right";

const OFFSET = 18; // シェイプ枠からの外側オフセット（スクリーンpx）
const W = 9;       // 三角の底辺半幅
const H = 9;       // 三角の高さ

// 先端が外側を向く三角形の頂点（cx,cy = 先端座標）
function triPoints(dir: Dir, cx: number, cy: number): string {
  switch (dir) {
    case "top":    return `${cx},${cy} ${cx - W},${cy + H} ${cx + W},${cy + H}`;
    case "bottom": return `${cx},${cy} ${cx - W},${cy - H} ${cx + W},${cy - H}`;
    case "left":   return `${cx},${cy} ${cx + H},${cy - W} ${cx + H},${cy + W}`;
    case "right":  return `${cx},${cy} ${cx - H},${cy - W} ${cx - H},${cy + W}`;
  }
}

const DIRS: Dir[] = ["top", "bottom", "left", "right"];

const ANCHOR: Record<Dir, { x: number; y: number }> = {
  top:    { x: 0.5, y: 0 },
  bottom: { x: 0.5, y: 1 },
  left:   { x: 0,   y: 0.5 },
  right:  { x: 1,   y: 0.5 },
};

export function ConnectHandles() {
  const editor = useEditor();
  const dragging = useRef<TLShapeId | null>(null);
  const fromId   = useRef<TLShapeId | null>(null);

  // 選択中シェイプが1つのときだけハンドルを表示
  const handles = useValue("connect-handles", () => {
    if (editor.getCurrentToolId() !== "select") return null;

    const selected = editor.getSelectedShapeIds();
    if (selected.length !== 1) return null;

    const shapeId = selected[0];
    const shape = editor.getShape(shapeId);
    // アロー自体を選択しているときは表示しない
    if (!shape || shape.type === "arrow") return null;

    const b = editor.getShapePageBounds(shapeId);
    if (!b) return null;

    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;

    // ページ座標でアンカー点を保持（アロー始点用）
    const pageAnchors: Record<Dir, { x: number; y: number }> = {
      top:    { x: cx,     y: b.minY },
      bottom: { x: cx,     y: b.maxY },
      left:   { x: b.minX, y: cy     },
      right:  { x: b.maxX, y: cy     },
    };

    return { shapeId, pageAnchors };
  }, [editor]);

  if (!handles) return null;

  const { shapeId, pageAnchors } = handles;

  // ページ座標 → スクリーン座標（fixed SVG 用）
  // editor.pageToScreen() はスクリーン座標（clientX/Y と同じ基準）を返す
  function pageToScreen(px: number, py: number): { x: number; y: number } {
    return editor.pageToScreen({ x: px, y: py });
  }

  function onPointerDown(e: React.PointerEvent, dir: Dir) {
    e.stopPropagation();
    e.preventDefault();

    fromId.current = shapeId;
    const pp = pageAnchors[dir];
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
          start: { x: pp.x, y: pp.y },
          end:   { x: pp.x, y: pp.y },
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
        filter: (s) => s.id !== fromId.current && s.type !== "arrow",
      });

      if (target) {
        editor.createBinding({
          type: "arrow",
          fromId: dragging.current,
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
        editor.deleteShape(dragging.current);
      }

      dragging.current = null;
      fromId.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 400,
      }}
    >
      {DIRS.map((dir) => {
        const pp = pageAnchors[dir];
        const sc = pageToScreen(pp.x, pp.y);

        // オフセットをスクリーン座標で加算
        let sx = sc.x;
        let sy = sc.y;
        if (dir === "top")    sy -= OFFSET;
        if (dir === "bottom") sy += OFFSET;
        if (dir === "left")   sx -= OFFSET;
        if (dir === "right")  sx += OFFSET;

        return (
          <polygon
            key={dir}
            points={triPoints(dir, sx, sy)}
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
