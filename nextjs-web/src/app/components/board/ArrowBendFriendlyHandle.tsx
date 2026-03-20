"use client";

import classNames from "classnames";
import { DefaultHandle, Matrix2d, useEditor } from "@cmpd/editor";
import type { TLShapeId } from "@cmpd/editor";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof DefaultHandle> & {
  shapeId: TLShapeId;
};

/**
 * 画面上の一定半径（調整可）。シェイプ→ページスケール × zoom でローカル r に換算。
 * pointer は Canvas の HandleWrapper が付与する親 g に載る（compound 既定と同じ）。
 */
const BEND_HANDLE_RADIUS_SCREEN_PX = { coarse: 20, fine: 12 } as const;
const BEND_HANDLE_MIN_RADIUS_SCREEN_PX = 8;

function shapeLocalRadiusFromFixedScreenRadius(
  radiusScreenPx: number,
  shapeToPageScale: number,
  cameraZoom: number
): number {
  const combined = Math.max(shapeToPageScale * cameraZoom, 1e-9);
  return radiusScreenPx / combined;
}

/**
 * 矢印の曲げ（middle）。1 円＋globals の .tl-arrow-bend-handle__disk。
 */
export function ArrowBendFriendlyHandle(props: Props) {
  const editor = useEditor();
  const { handle, isCoarse, className, zoom, shapeId } = props;

  if (handle.id !== "middle") {
    return <DefaultHandle {...props} />;
  }

  const transform = editor.getShapePageTransform(shapeId);
  const { scaleX, scaleY } = Matrix2d.Decompose(transform);
  const shapeToPageScale = Math.max(Math.abs(scaleX), Math.abs(scaleY), 1e-9);

  const radiusPx = isCoarse
    ? BEND_HANDLE_RADIUS_SCREEN_PX.coarse
    : BEND_HANDLE_RADIUS_SCREEN_PX.fine;
  const rDesired = shapeLocalRadiusFromFixedScreenRadius(radiusPx, shapeToPageScale, zoom);
  const rFloor = shapeLocalRadiusFromFixedScreenRadius(
    BEND_HANDLE_MIN_RADIUS_SCREEN_PX,
    shapeToPageScale,
    zoom
  );
  const r = Math.max(rDesired, rFloor);

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
      <circle className="tl-arrow-bend-handle__disk" r={r} />
    </g>
  );
}
