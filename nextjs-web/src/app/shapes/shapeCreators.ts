/**
 * キャンバスへのシェイプ配置ロジック（placeFile / placeAsset / placeholderShape）。
 * 画像・動画・その他ファイルの振り分けと createShapeForResolved の共通処理を担当。
 */

import type { Editor } from "@cmpd/compound";
import { createShapeId } from "@cmpd/compound";
import { AssetRecordType, type TLImageAsset } from "@cmpd/editor";
import {
  SHAPE_TYPE,
  resolveShapeType,
  type FileIconShape,
  type AudioShape,
  type TextFileShape,
  type VideoShape,
} from "@shared/shapeDefs";
import { getAssetKind } from "@shared/mimeUtils";
import { getEffectiveMimeType } from "@/lib/uploadCommon";
import type { ApiAsset } from "@shared/apiTypes";
import {
  getImageDisplaySize,
  getImageDisplaySizeFromUrl,
  getVideoDisplaySizeFromUrl,
  fetchTextContent,
} from "@/lib/mediaUtils";
import { MIN_COMMENT_LIST_H } from "@/app/hooks/media/useMediaPlayerComments";
import { AUDIO_DEFAULT_W, AUDIO_DEFAULT_H, VIDEO_UI_OVERHEAD } from "./media/mediaConstants";

export type ResolvedAssetData = {
  assetId: string;
  fileName: string;
  mimeType: string;
  kind?: string;
};

/**
 * resolveShapeType で解決した型に応じてシェイプを作成する。
 * placeFile / placeAsset の共通処理。
 */
export async function createShapeForResolved(
  editor: Editor,
  resolved: { type: string; def: { defaultProps: Record<string, unknown> } },
  assetData: ResolvedAssetData,
  position: { x: number; y: number },
  meta: Record<string, unknown>,
  options: {
    existingShapeId?: ReturnType<typeof createShapeId>;
    content?: string;
    shapeId?: ReturnType<typeof createShapeId>;
  } = {},
): Promise<void> {
  const { type, def } = resolved;
  const baseProps = { ...def.defaultProps, ...assetData };
  const { existingShapeId, content, shapeId } = options;
  const id = shapeId ?? createShapeId();
  const shapeMeta = meta as Record<string, string | number>;

  if (type === SHAPE_TYPE.TEXT_FILE) {
    const textContent = content ?? (assetData.assetId ? await fetchTextContent(assetData.assetId) : "");
    const textProps: TextFileShape["props"] = {
      assetId: assetData.assetId ?? "",
      fileName: assetData.fileName ?? "",
      mimeType: assetData.mimeType ?? "",
      content: typeof textContent === "string" ? textContent : "",
      w: (def.defaultProps.w as number) ?? 320,
      h: (def.defaultProps.h as number) ?? 240,
    };
    editor.createShape<TextFileShape>({
      id,
      type,
      x: position.x,
      y: position.y,
      meta: shapeMeta,
      props: textProps,
    });
  } else if (type === SHAPE_TYPE.AUDIO) {
    const audioProps: AudioShape["props"] = {
      assetId: String(assetData.assetId ?? ""),
      fileName: String(assetData.fileName ?? ""),
      mimeType: String(assetData.mimeType ?? ""),
      w: AUDIO_DEFAULT_W,
      h: AUDIO_DEFAULT_H,
    };
    editor.createShape<AudioShape>({
      id,
      type,
      x: position.x,
      y: position.y,
      meta: shapeMeta,
      props: audioProps,
    });
  } else {
    editor.createShape<FileIconShape>({
      id,
      type: SHAPE_TYPE.FILE_ICON,
      x: position.x,
      y: position.y,
      meta: shapeMeta,
      props: { ...baseProps, kind: assetData.kind ?? "file" } as FileIconShape["props"],
    });
  }
  if (existingShapeId) editor.deleteShapes([existingShapeId]);
}

/**
 * アップロード済みファイル 1 件をキャンバス上に配置する。
 */
export async function placeFile(
  editor: Editor,
  file: File,
  data: ApiAsset,
  position: { x: number; y: number },
  createdBy = "Unknown",
  existingShapeId?: ReturnType<typeof createShapeId>,
  createdByAvatarUrl?: string | null
): Promise<void> {
  const mime = data.mimeType || file.type || "application/octet-stream";
  const { x, y } = position;
  const meta: Record<string, unknown> = {
    createdBy,
    sizeBytes: data.sizeBytes,
    createdAt: Date.now(),
    ...(createdByAvatarUrl && { createdByAvatarUrl }),
  };

  if (mime.startsWith("image/") && mime !== "image/vnd.adobe.photoshop") {
    const { w: rawW, h: rawH } = await getImageDisplaySize(file);
    const w = rawW;
    const h = rawH;
    const assetId = AssetRecordType.createId();
    const imageAsset: TLImageAsset = {
      id: assetId,
      typeName: "asset",
      type: "image",
      props: {
        src: `/api/assets/${data.id}/file`,
        w, h,
        name: data.fileName,
        isAnimated: mime === "image/gif",
        mimeType: mime,
      },
      meta: {},
    };
    editor.createAssets([imageAsset]);
    editor.createShape({ type: "image", x, y, meta: meta as object, props: { assetId, w, h } });
    if (existingShapeId) editor.deleteShapes([existingShapeId]);
    return;
  }

  if (mime.startsWith("video/")) {
    const fileUrl = `/api/assets/${data.id}/file`;
    const { w: rawW, h: videoH } = await getVideoDisplaySizeFromUrl(fileUrl);
    const w = rawW;
    const h = videoH + VIDEO_UI_OVERHEAD + MIN_COMMENT_LIST_H;
    editor.createShape<VideoShape>({
      id: createShapeId(), type: SHAPE_TYPE.VIDEO, x, y, meta: meta as object,
      props: { assetId: data.id, fileName: data.fileName, mimeType: mime, w, h } as VideoShape["props"],
    });
    if (existingShapeId) editor.deleteShapes([existingShapeId]);
    return;
  }

  const resolved = resolveShapeType(mime, file.name);
  if (!resolved) return;

  await createShapeForResolved(editor, resolved, {
    assetId: data.id,
    fileName: data.fileName,
    mimeType: data.mimeType,
    kind: data.kind,
  }, position, meta, { existingShapeId });
}

/**
 * ApiAsset のみを受け取りキャンバス上に配置する（復元用）。
 */
export async function placeAsset(
  editor: Editor,
  data: ApiAsset,
  position: { x: number; y: number },
  createdBy = "Unknown",
  existingShapeId?: ReturnType<typeof createShapeId>,
  createdByAvatarUrl?: string | null
): Promise<void> {
  const mime = data.mimeType || "application/octet-stream";
  const { x, y } = position;
  const meta: Record<string, unknown> = {
    createdBy,
    sizeBytes: data.sizeBytes,
    createdAt: Date.now(),
    ...(createdByAvatarUrl && { createdByAvatarUrl }),
  };

  if (mime.startsWith("image/") && mime !== "image/vnd.adobe.photoshop") {
    const fileUrl = `/api/assets/${data.id}/file`;
    const { w: rawW, h: rawH } = await getImageDisplaySizeFromUrl(fileUrl);
    const w = rawW;
    const h = rawH;
    const assetId = AssetRecordType.createId();
    const imageAsset: TLImageAsset = {
      id: assetId, typeName: "asset", type: "image",
      props: { src: fileUrl, w, h, name: data.fileName, isAnimated: mime === "image/gif", mimeType: mime },
      meta: {},
    };
    editor.createAssets([imageAsset]);
    editor.createShape({ type: "image", x, y, meta: meta as object, props: { assetId, w, h } });
    if (existingShapeId) editor.deleteShapes([existingShapeId]);
    return;
  }

  if (mime.startsWith("video/")) {
    const fileUrl = `/api/assets/${data.id}/file`;
    const { w: rawW, h: videoH } = await getVideoDisplaySizeFromUrl(fileUrl);
    const w = rawW;
    const h = videoH + VIDEO_UI_OVERHEAD + MIN_COMMENT_LIST_H;
    editor.createShape<VideoShape>({
      id: createShapeId(), type: SHAPE_TYPE.VIDEO, x, y, meta: meta as object,
      props: { assetId: data.id, fileName: data.fileName, mimeType: mime, w, h } as VideoShape["props"],
    });
    if (existingShapeId) editor.deleteShapes([existingShapeId]);
    return;
  }

  const resolved = resolveShapeType(mime, data.fileName);
  if (!resolved) return;

  await createShapeForResolved(editor, resolved, {
    assetId: data.id,
    fileName: data.fileName,
    mimeType: data.mimeType,
    kind: data.kind,
  }, position, meta, { existingShapeId });
}

/**
 * アップロード開始直後に仮シェイプを配置する。
 * 全ファイル種別で FileIconShape に統一し、送信%を一貫して表示。
 * 完了後は placeFile で本来のシェイプに差し替え。
 */
export async function placeholderShape(
  editor: Editor,
  file: File,
  position: { x: number; y: number },
  createdBy = "Unknown",
  createdByAvatarUrl?: string | null
): Promise<ReturnType<typeof createShapeId> | null> {
  const mime = getEffectiveMimeType(file);
  const kind = getAssetKind(mime);
  const { x, y } = position;
  const progressMeta: Record<string, unknown> = {
    createdBy,
    uploadProgress: 0,
    createdAt: Date.now(),
    ...(createdByAvatarUrl && { createdByAvatarUrl }),
  };
  const id = createShapeId();

  editor.createShape<FileIconShape>({
    id,
    type: SHAPE_TYPE.FILE_ICON,
    x,
    y,
    meta: progressMeta as object,
    props: {
      assetId: "",
      fileName: file.name,
      mimeType: mime,
      kind: kind === "gif" ? "gif" : kind,
      w: 96,
      h: 96,
    } as FileIconShape["props"],
  });
  return id;
}
