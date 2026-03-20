"use client";

import classNames from "classnames";
import { DefaultHandle, Matrix2d, useEditor } from "@cmpd/editor";
import type { TLShapeId } from "@cmpd/editor";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof DefaultHandle> & {
  shapeId: TLShapeId;
};

/**
 * 外側は掴みやすさ用の大きい透明円、内側は始点・終点に合わせた見た目用の小さい円。
 * 両方ともシェイプ→ページスケール × zoom でローカル r に換算する。
 */
const BEND_HANDLE_RADIUS_SCREEN_PX = { coarse: 20, fine: 12 } as const;
const BEND_HANDLE_MIN_RADIUS_SCREEN_PX = 8;
const BEND_HANDLE_VISIBLE_RADIUS_SCREEN_PX = 4;

function shapeLocalRadiusFromFixedScreenRadius(
  radiusScreenPx: number,
  shapeToPageScale: number,
  cameraZoom: number
): number {
  const combined = Math.max(shapeToPageScale * cameraZoom, 1e-9);
  return radiusScreenPx / combined;
}

/**
 * 矢印の曲げ（middle）。当たりは大きいまま、見た目だけ始点・終点サイズに寄せる。
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
  const bgR = Math.max(rDesired, rFloor);
  const fgR = shapeLocalRadiusFromFixedScreenRadius(
    BEND_HANDLE_VISIBLE_RADIUS_SCREEN_PX,
    shapeToPageScale,
    zoom
  );

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
      <circle className="tl-handle__bg" r={bgR} />
      <circle className="tl-handle__fg" r={fgR} />
    </g>
  );
}
