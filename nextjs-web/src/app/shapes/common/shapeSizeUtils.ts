/**
 * シェイプのリサイズ時における最小サイズを型ごとに返す。
 * 経路 A（選択枠リサイズ）の onResize と経路 B（ShapeConnectHandles）の両方で参照する。
 */
import { AUDIO_DEFAULT_W, AUDIO_DEFAULT_H, VIDEO_DEFAULT_W, VIDEO_DEFAULT_H } from "../media/mediaConstants";

export function getMinShapeSize(shapeType: string): { minW: number; minH: number } {
  switch (shapeType) {
    case "video":
      return { minW: VIDEO_DEFAULT_W, minH: VIDEO_DEFAULT_H };
    case "audio":
      return { minW: AUDIO_DEFAULT_W, minH: AUDIO_DEFAULT_H };
    case "geo":
    case "note":
    case "text":
      return { minW: 20, minH: 20 };
    case "image":
    case "text-file":
    case "file-icon":
      return { minW: 1, minH: 1 };
    default:
      return { minW: 20, minH: 20 };
  }
}
