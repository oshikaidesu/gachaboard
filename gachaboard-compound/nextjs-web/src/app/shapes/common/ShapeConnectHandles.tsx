"use client";

import { useRef, useCallback } from "react";
import {
  useEditor,
  useValue,
  createShapeId,
  type TLShapeId,
} from "@cmpd/compound";

type Dir = "top" | "bottom" | "left" | "right";
type Corner = "top_left" | "top_right" | "bottom_left" | "bottom_right";

const TRI_W = 13;
const TRI_H = 13;
const OFFSET = 23;
const CENTER_ANCHOR = { x: 0.5, y: 0.5 };

const RESIZE_HANDLE_SIZE = 12;

function triPoints(dir: Dir, cx: number, cy: number): string {
  switch (dir) {
    case "top":
      return `${cx},${cy} ${cx - TRI_W},${cy + TRI_H} ${cx + TRI_W},${cy + TRI_H}`;
    case "bottom":
      return `${cx},${cy} ${cx - TRI_W},${cy - TRI_H} ${cx + TRI_W},${cy - TRI_H}`;
    case "left":
      return `${cx},${cy} ${cx + TRI_H},${cy - TRI_W} ${cx + TRI_H},${cy + TRI_W}`;
    case "right":
      return `${cx},${cy} ${cx - TRI_H},${cy - TRI_W} ${cx - TRI_H},${cy + TRI_W}`;
  }
}

const CORNER_CURSORS: Record<Corner, string> = {
  top_left: "nwse-resize",
  top_right: "nesw-resize",
  bottom_left: "nesw-resize",
  bottom_right: "nwse-resize",
};

type Props = {
  shapeId: TLShapeId;
  w: number;
  h: number;
};

export function ShapeConnectHandles({ shapeId, w, h }: Props) {
  const editor = useEditor();
  const dragging = useRef<TLShapeId | null>(null);
  const resizing = useRef<{ corner: Corner; startX: number; startY: number; startW: number; startH: number; startShapeX: number; startShapeY: number } | null>(null);

  const visible = useValue("shape-connect-visible", () => {
    if (editor.getCurrentToolId() !== "select") return false;
    const selected = editor.getSelectedShapeIds();
    return selected.length === 1 && selected[0] === shapeId;
  }, [editor, shapeId]);

  const isEditing = useValue("is-editing-shape", () => {
    return editor.getEditingShapeId() === shapeId;
  }, [editor, shapeId]);

  const zoom = useValue("zoom-for-handles", () => editor.getZoomLevel(), [editor]);
  const scale = 1 / zoom;

  const onArrowPointerDown = useCallback((e: React.PointerEvent, dir: Dir) => {
    e.stopPropagation();
    e.preventDefault();

    const localAnchors: Record<Dir, { x: number; y: number }> = {
      top: { x: w / 2, y: 0 },
      bottom: { x: w / 2, y: h },
      left: { x: 0, y: h / 2 },
      right: { x: w, y: h / 2 },
    };

    const shape = editor.getShape(shapeId);
    if (!shape) return;
    const pageAnchor = editor
      .getShapePageTransform(shapeId)
      .applyToPoint(localAnchors[dir]);

    const arrowId = createShapeId();
    dragging.current = arrowId;

    editor.batch(() => {
      editor.createShapes([
        {
          id: arrowId,
          type: "arrow",
          x: 0,
          y: 0,
          props: {
            start: {
              type: "binding",
              boundShapeId: shapeId,
              normalizedAnchor: CENTER_ANCHOR,
              isExact: false,
              isPrecise: false,
            },
            end: {
              type: "point",
              x: pageAnchor.x,
              y: pageAnchor.y,
            },
            arrowheadStart: "none",
            arrowheadEnd: "arrow",
            bend: 0,
          },
        },
      ]);
    });

    function onMove(ev: PointerEvent) {
      if (!dragging.current) return;
      const p = editor.screenToPage({ x: ev.clientX, y: ev.clientY });
      editor.updateShapes([
        {
          id: dragging.current,
          type: "arrow",
          props: {
            end: { type: "point", x: p.x, y: p.y },
          },
        },
      ]);
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!dragging.current) return;

      const p = editor.screenToPage({ x: ev.clientX, y: ev.clientY });
      const target = editor.getShapeAtPoint(p, {
        filter: (s) => s.id !== shapeId && s.type !== "arrow",
        hitInside: true,
      });

      if (target) {
        editor.updateShapes([
          {
            id: dragging.current,
            type: "arrow",
            props: {
              end: {
                type: "binding",
                boundShapeId: target.id,
                normalizedAnchor: { x: 0.5, y: 0.5 },
                isExact: false,
                isPrecise: false,
              },
            },
          },
        ]);
      } else {
        editor.deleteShapes([dragging.current]);
      }

      dragging.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [editor, shapeId, w, h]);

  const onResizePointerDown = useCallback((e: React.PointerEvent, corner: Corner) => {
    e.stopPropagation();
    e.preventDefault();

    const shape = editor.getShape(shapeId);
    if (!shape) return;
    const props = shape.props as { w: number; h: number };

    resizing.current = {
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startW: props.w,
      startH: props.h,
      startShapeX: shape.x,
      startShapeY: shape.y,
    };

    editor.mark("resize start");

    function onMove(ev: PointerEvent) {
      if (!resizing.current) return;
      const { corner: c, startX, startY, startW, startH, startShapeX, startShapeY } = resizing.current;
      const zoom = editor.getZoomLevel();
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;

      let newW = startW;
      let newH = startH;
      let newX = startShapeX;
      let newY = startShapeY;

      switch (c) {
        case "top_left":
          newW = Math.max(20, startW - dx);
          newH = Math.max(20, startH - dy);
          newX = startShapeX + (startW - newW);
          newY = startShapeY + (startH - newH);
          break;
        case "top_right":
          newW = Math.max(20, startW + dx);
          newH = Math.max(20, startH - dy);
          newY = startShapeY + (startH - newH);
          break;
        case "bottom_left":
          newW = Math.max(20, startW - dx);
          newH = Math.max(20, startH + dy);
          newX = startShapeX + (startW - newW);
          break;
        case "bottom_right":
          newW = Math.max(20, startW + dx);
          newH = Math.max(20, startH + dy);
          break;
      }

      editor.updateShapes([{
        id: shapeId,
        type: "geo",
        x: newX,
        y: newY,
        props: { w: newW, h: newH },
      }]);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      resizing.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [editor, shapeId]);

  if (!visible || isEditing) return null;

  const tipPos: Record<Dir, { x: number; y: number }> = {
    top: { x: w / 2, y: -OFFSET },
    bottom: { x: w / 2, y: h + OFFSET },
    left: { x: -OFFSET, y: h / 2 },
    right: { x: w + OFFSET, y: h / 2 },
  };
  // スケールの中心 = シェイプの辺上。ここを固定にすることで「ずれ」を防ぐ
  const edgeAnchor: Record<Dir, { x: number; y: number }> = {
    top: { x: w / 2, y: 0 },
    bottom: { x: w / 2, y: h },
    left: { x: 0, y: h / 2 },
    right: { x: w, y: h / 2 },
  };

  const DIRS: Dir[] = ["top", "bottom", "left", "right"];

  const hs = RESIZE_HANDLE_SIZE;
  const cornerPositions: Record<Corner, { x: number; y: number }> = {
    top_left: { x: -hs / 2, y: -hs / 2 },
    top_right: { x: w - hs / 2, y: -hs / 2 },
    bottom_left: { x: -hs / 2, y: h - hs / 2 },
    bottom_right: { x: w - hs / 2, y: h - hs / 2 },
  };
  const CORNERS: Corner[] = ["top_left", "top_right", "bottom_left", "bottom_right"];

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: w,
        height: h,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 500,
      }}
    >
      {DIRS.map((dir) => {
        const tip = tipPos[dir];
        const anchor = edgeAnchor[dir];
        return (
          <g
            key={dir}
            transform={`translate(${anchor.x},${anchor.y}) scale(${scale}) translate(${-anchor.x},${-anchor.y})`}
            style={{ pointerEvents: "all", cursor: "crosshair" }}
          >
            <polygon
              points={triPoints(dir, tip.x, tip.y)}
              fill="#6366f1"
              stroke="#fff"
              strokeWidth={1.5}
              strokeLinejoin="round"
              style={{ pointerEvents: "all" }}
              onPointerDown={(e) => onArrowPointerDown(e, dir)}
            />
          </g>
        );
      })}
      {CORNERS.map((corner) => {
        const pos = cornerPositions[corner];
        return (
          <g key={corner} style={{ pointerEvents: "all", cursor: CORNER_CURSORS[corner] }}>
            {/* 当たり判定を広げる透明な rect */}
            <rect
              x={pos.x - hs}
              y={pos.y - hs}
              width={hs * 3}
              height={hs * 3}
              fill="transparent"
              style={{ pointerEvents: "all" }}
              onPointerDown={(e) => onResizePointerDown(e, corner)}
            />
            {/* 表示用のハンドル */}
            <rect
              x={pos.x}
              y={pos.y}
              width={hs}
              height={hs}
              rx={2}
              fill="#6366f1"
              style={{ pointerEvents: "none" }}
            />
          </g>
        );
      })}
    </svg>
  );
}
