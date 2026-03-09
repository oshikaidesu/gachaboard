/**
 * カスタムシェイプの登録・振り分けロジック（compound 用）
 *
 * fresh からの移植。@tldraw/* → @cmpd/* に置き換え済み。
 */

import {
  type Editor,
  createShapeId,
  DrawShapeUtil,
  HighlightShapeUtil,
  LineShapeUtil,
  FrameShapeUtil,
  BookmarkShapeUtil,
  EmbedShapeUtil,
} from "@cmpd/compound";
import { AssetRecordType, type TLImageAsset } from "@cmpd/editor";
import { FileIconShapeUtil } from "./file/FileIconShape";
import { TextFileShapeUtil } from "./file/TextFileShape";
import { AudioShapeUtil } from "./media/AudioShape";
import { VideoShapeUtil, VIDEO_UI_OVERHEAD, MIN_COMMENT_LIST_H } from "./media/VideoShape";
import {
  WrappedImageShapeUtil,
  WrappedNoteShapeUtil,
  WrappedGeoShapeUtil,
  WrappedTextShapeUtil,
  WrappedArrowShapeUtil,
} from "./NativeShapeWrappers";
import {
  SHAPE_TYPE,
  resolveShapeType,
  type FileIconShape,
  type AudioShape,
  type TextFileShape,
  type VideoShape,
} from "@shared/shapeDefs";
import type { ApiAsset } from "@shared/apiTypes";
import { MAX_TEXT_PREVIEW_BYTES } from "@shared/constants";

export type { ApiAsset } from "@shared/apiTypes";
export type { FileIconShape, AudioShape, TextFileShape, VideoShape } from "@shared/shapeDefs";

/**
 * Compound の shapeUtils prop に渡す配列。
 */
export const CUSTOM_SHAPE_UTILS = [
  FileIconShapeUtil,
  TextFileShapeUtil,
  AudioShapeUtil,
  VideoShapeUtil,
  WrappedImageShapeUtil,
  WrappedNoteShapeUtil,
  WrappedGeoShapeUtil,
  WrappedTextShapeUtil,
  WrappedArrowShapeUtil,
  DrawShapeUtil,
  HighlightShapeUtil,
  LineShapeUtil,
  FrameShapeUtil,
  BookmarkShapeUtil,
  EmbedShapeUtil,
];

// ---- ファイル振り分けロジック ------------------------------------------------

const IMAGE_LONG_SIDE = 320;
const VIDEO_LONG_SIDE = 480;

async function getImageDisplaySize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: nw, naturalHeight: nh } = img;
      if (nw === 0 || nh === 0) { resolve({ w: 320, h: 240 }); return; }
      const scale = IMAGE_LONG_SIDE / Math.max(nw, nh);
      resolve({ w: Math.round(nw * scale), h: Math.round(nh * scale) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 320, h: 240 }); };
    img.src = url;
  });
}

async function getImageDisplaySizeFromUrl(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: nw, naturalHeight: nh } = img;
      if (nw === 0 || nh === 0) { resolve({ w: 320, h: 240 }); return; }
      const scale = IMAGE_LONG_SIDE / Math.max(nw, nh);
      resolve({ w: Math.round(nw * scale), h: Math.round(nh * scale) });
    };
    img.onerror = () => resolve({ w: 320, h: 240 });
    img.src = url;
  });
}

async function getVideoDisplaySizeFromUrl(url: string): Promise<{ w: number; h: number }> {
  const fallback = { w: VIDEO_LONG_SIDE, h: Math.round(VIDEO_LONG_SIDE * 9 / 16) };
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const timer = setTimeout(() => {
      video.removeAttribute("src"); video.load(); resolve(fallback);
    }, 5000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const { videoWidth: vw, videoHeight: vh } = video;
      video.removeAttribute("src"); video.load();
      if (vw === 0 || vh === 0) { resolve(fallback); return; }
      const scale = VIDEO_LONG_SIDE / Math.max(vw, vh);
      resolve({ w: Math.round(vw * scale), h: Math.round(vh * scale) });
    };
    video.onerror = () => { clearTimeout(timer); video.removeAttribute("src"); video.load(); resolve(fallback); };
    video.src = url;
  });
}

async function fetchTextContent(assetId: string): Promise<string> {
  try {
    const res = await fetch(`/api/assets/${assetId}/file`);
    if (!res.ok) return "(読み込みエラー)";
    const text = await res.text();
    return text.length > MAX_TEXT_PREVIEW_BYTES ? text.slice(0, MAX_TEXT_PREVIEW_BYTES) + "\n…(以下省略)" : text;
  } catch {
    return "(読み込みエラー)";
  }
}

type ResolvedAssetData = {
  assetId: string;
  fileName: string;
  mimeType: string;
  kind?: string;
};

/**
 * resolveShapeType で解決した型に応じてシェイプを作成する。
 * placeFile / placeAsset / placeholderShape の共通処理。
 */
async function createShapeForResolved(
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
    editor.createShape<TextFileShape>({
      id,
      type,
      x: position.x,
      y: position.y,
      meta: shapeMeta,
      props: { ...baseProps, content: textContent } as TextFileShape["props"],
    });
  } else if (type === SHAPE_TYPE.AUDIO) {
    editor.createShape<AudioShape>({
      id,
      type,
      x: position.x,
      y: position.y,
      meta: shapeMeta,
      props: baseProps as AudioShape["props"],
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
  existingShapeId?: ReturnType<typeof createShapeId>
): Promise<void> {
  const mime = file.type || "application/octet-stream";
  const { x, y } = position;
  const meta = { createdBy, sizeBytes: data.sizeBytes, createdAt: Date.now() };

  if (mime.startsWith("image/")) {
    const { w, h } = await getImageDisplaySize(file);
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
    editor.createShape({ type: "image", x, y, meta, props: { assetId, w, h } });
    if (existingShapeId) editor.deleteShapes([existingShapeId]);
    return;
  }

  if (mime.startsWith("video/")) {
    const fileUrl = `/api/assets/${data.id}/file`;
    const { w, h: videoH } = await getVideoDisplaySizeFromUrl(fileUrl);
    editor.createShape<VideoShape>({
      id: createShapeId(), type: SHAPE_TYPE.VIDEO, x, y, meta,
      props: { assetId: data.id, fileName: data.fileName, mimeType: mime, w, h: videoH + VIDEO_UI_OVERHEAD + MIN_COMMENT_LIST_H } as VideoShape["props"],
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
  existingShapeId?: ReturnType<typeof createShapeId>
): Promise<void> {
  const mime = data.mimeType || "application/octet-stream";
  const { x, y } = position;
  const meta = { createdBy, sizeBytes: data.sizeBytes, createdAt: Date.now() };

  if (mime.startsWith("image/")) {
    const fileUrl = `/api/assets/${data.id}/file`;
    const { w, h } = await getImageDisplaySizeFromUrl(fileUrl);
    const assetId = AssetRecordType.createId();
    const imageAsset: TLImageAsset = {
      id: assetId, typeName: "asset", type: "image",
      props: { src: fileUrl, w, h, name: data.fileName, isAnimated: mime === "image/gif", mimeType: mime },
      meta: {},
    };
    editor.createAssets([imageAsset]);
    editor.createShape({ type: "image", x, y, meta, props: { assetId, w, h } });
    if (existingShapeId) editor.deleteShapes([existingShapeId]);
    return;
  }

  if (mime.startsWith("video/")) {
    const fileUrl = `/api/assets/${data.id}/file`;
    const { w, h: videoH } = await getVideoDisplaySizeFromUrl(fileUrl);
    editor.createShape<VideoShape>({
      id: createShapeId(), type: SHAPE_TYPE.VIDEO, x, y, meta,
      props: { assetId: data.id, fileName: data.fileName, mimeType: mime, w, h: videoH + VIDEO_UI_OVERHEAD + MIN_COMMENT_LIST_H } as VideoShape["props"],
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
 */
export async function placeholderShape(
  editor: Editor,
  file: File,
  position: { x: number; y: number },
  createdBy = "Unknown"
): Promise<ReturnType<typeof createShapeId> | null> {
  const mime = file.type || "application/octet-stream";
  const { x, y } = position;
  const progressMeta = { createdBy, uploadProgress: 0, createdAt: Date.now() };
  const id = createShapeId();

  if (mime.startsWith("image/") || mime.startsWith("video/")) {
    editor.createShape<FileIconShape>({
      id, type: SHAPE_TYPE.FILE_ICON, x, y, meta: progressMeta,
      props: { assetId: "", fileName: file.name, mimeType: mime, kind: mime.startsWith("image/") ? "image" : "video", w: 96, h: 96 },
    });
    return id;
  }

  const resolved = resolveShapeType(mime, file.name);
  if (!resolved) return null;

  const assetData: ResolvedAssetData = {
    assetId: "",
    fileName: file.name,
    mimeType: mime,
    kind: resolved.type === SHAPE_TYPE.FILE_ICON ? "file" : undefined,
  };
  const defWithPlaceholderProps = {
    ...resolved.def,
    defaultProps: { ...resolved.def.defaultProps, w: 96, h: 96 },
  };
  await createShapeForResolved(
    editor,
    { ...resolved, def: defWithPlaceholderProps },
    assetData,
    position,
    progressMeta,
    { shapeId: id, content: resolved.type === SHAPE_TYPE.TEXT_FILE ? "" : undefined },
  );
  return id;
}

export { FileIconShapeUtil, getFileEmoji } from "./file/FileIconShape";
export { TextFileShapeUtil, isTextFile } from "./file/TextFileShape";
export { AudioShapeUtil } from "./media/AudioShape";
export { VideoShapeUtil, VIDEO_UI_OVERHEAD } from "./media/VideoShape";
