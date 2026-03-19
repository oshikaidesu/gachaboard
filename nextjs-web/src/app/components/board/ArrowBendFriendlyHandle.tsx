"use client";

import classNames from "classnames";
import { DefaultHandle, Matrix2d, useEditor } from "@cmpd/editor";
import type { TLShapeId } from "@cmpd/editor";
import type { ComponentProps, DOMAttributes } from "react";

/** Canvas HandleWrapper が middle のみ円に付ける（親の空 g だとヒットが不安定なため） */
type HandlePointerEvents = Pick<
  DOMAttributes<SVGCircleElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp"
>;

type Props = ComponentProps<typeof DefaultHandle> & {
  shapeId: TLShapeId;
  handlePointerEvents?: HandlePointerEvents;
};

/**
 * 画面上の一定半径（DefaultHandle よりやや小さめ）。表示＝判定は同一の r。
 * シェイプ→ページの線形スケール × zoom でシェイプローカルに換算。
 */
const BEND_HANDLE_RADIUS_SCREEN_PX = { coarse: 16, fine: 9 } as const;

function shapeLocalRadiusFromFixedScreenRadius(
  radiusScreenPx: number,
  shapeToPageScale: number,
  cameraZoom: number
): number {
  const combined = Math.max(shapeToPageScale * cameraZoom, 1e-9);
  return radiusScreenPx / combined;
}

/**
 * 矢印の曲げ（middle）。表示＝判定は同一円（globals の .tl-arrow-bend-handle__disk）。
 * pointer リスナーは handlePointerEvents で円に直接付ける（patch 済み Canvas HandleWrapper）。
 */
export function ArrowBendFriendlyHandle(props: Props) {
  const editor = useEditor();
  const { handle, isCoarse, className, zoom, shapeId, handlePointerEvents } = props;

  if (handle.id !== "middle") {
    const { handlePointerEvents: _omit, ...forDefault } = props;
    return <DefaultHandle {...forDefault} />;
  }

  const transform = editor.getShapePageTransform(shapeId);
  const { scaleX, scaleY } = Matrix2d.Decompose(transform);
  const shapeToPageScale = Math.max(Math.abs(scaleX), Math.abs(scaleY), 1e-9);

  const radiusPx = isCoarse
    ? BEND_HANDLE_RADIUS_SCREEN_PX.coarse
    : BEND_HANDLE_RADIUS_SCREEN_PX.fine;
  const r = shapeLocalRadiusFromFixedScreenRadius(radiusPx, shapeToPageScale, zoom);

  return (
    <g
      className={classNames(
        "tl-handle",
        "tl-arrow-bend-handle",
        {
          "tl-handle__virtual": handle.type === "virtual",
          "tl-handle__create": handle.type === "create",
        },
        className
      )}
    >
      <circle
        className="tl-arrow-bend-handle__disk"
        r={r}
        {...handlePointerEvents}
      />
    </g>
  );
}
