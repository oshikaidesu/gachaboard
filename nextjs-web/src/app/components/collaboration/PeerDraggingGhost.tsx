"use client";

/**
 * シェイプ内で他ユーザーのドラッグ中ゴーストを描画する。
 * シェイプの子要素として配置するため、座標変換不要（offset のみ）。
 */
import type { TLShapeId } from "@cmpd/tlschema";
import { toDomPrecision } from "@cmpd/editor";
import { usePeerDragging } from "./usePeerDragging";

const GHOST_OPACITY = 0.35;

type Props = {
  shapeId: TLShapeId;
  shapeX: number;
  shapeY: number;
  w: number;
  h: number;
};

export function PeerDraggingGhost({ shapeId, shapeX, shapeY, w, h }: Props) {
  const dragging = usePeerDragging(shapeId);
  if (!dragging || w <= 0 || h <= 0) return null;

  const dx = dragging.x - shapeX;
  const dy = dragging.y - shapeY;

  return (
    <svg
      className="tl-dragging-ghost"
      style={{
        position: "absolute",
        left: dx,
        top: dy,
        width: w,
        height: h,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <rect
        width={toDomPrecision(w)}
        height={toDomPrecision(h)}
        fill={dragging.color}
        opacity={GHOST_OPACITY}
        rx={4}
        ry={4}
      />
    </svg>
  );
}
