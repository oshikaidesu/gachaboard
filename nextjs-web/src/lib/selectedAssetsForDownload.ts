import type { Editor } from "@cmpd/editor";
import type { TLAssetId } from "@cmpd/editor";
import { getSafeAssetId } from "@/lib/safeUrl";

export type DownloadableAsset = { assetId: string; fileName: string };

const DOWNLOADABLE_SHAPE_TYPES = [
  "image",
  "video-player",
  "audio-player",
  "file-icon",
  "text-file",
] as const;

/**
 * ホワイトボード上で選択されているシェイプのうち、
 * ダウンロード可能なアセット（API assetId + fileName）を重複なく返す。
 */
export function getDownloadableFromSelectedShapes(
  editor: Editor
): DownloadableAsset[] {
  const ids = editor.getSelectedShapeIds();
  const seen = new Set<string>();
  const result: DownloadableAsset[] = [];

  for (const id of ids) {
    const shape = editor.getShape(id);
    if (!shape) continue;

    const { type, props } = shape;
    if (!DOWNLOADABLE_SHAPE_TYPES.includes(type as (typeof DOWNLOADABLE_SHAPE_TYPES)[number])) {
      continue;
    }

    if (type === "image") {
      const assetId = (props as { assetId?: string }).assetId;
      const asset = assetId ? editor.getAsset(assetId as TLAssetId) : null;
      const src: string = (asset?.props as { src?: string })?.src ?? "";
      const rawApiAssetId = src.match(/\/api\/assets\/([^/]+)\/file/)?.[1] ?? "";
      const apiAssetId = getSafeAssetId(rawApiAssetId);
      const fileName: string = (asset?.props as { name?: string })?.name ?? "image";
      if (!apiAssetId || seen.has(apiAssetId)) continue;
      seen.add(apiAssetId);
      result.push({ assetId: apiAssetId, fileName });
      continue;
    }

    const p = props as { assetId?: string; fileName?: string };
    const apiAssetId = getSafeAssetId(p.assetId);
    const fileName = p.fileName?.trim() || "file";
    if (!apiAssetId || seen.has(apiAssetId)) continue;
    seen.add(apiAssetId);
    result.push({ assetId: apiAssetId, fileName });
  }

  return result;
}
