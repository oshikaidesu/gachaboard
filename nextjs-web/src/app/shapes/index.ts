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
import { AUDIO_DEFAULT_W, AUDIO_DEFAULT_H } from "./media/mediaConstants";
import {
  WrappedImageShapeUtil,
  WrappedNoteShapeUtil,
  WrappedGeoShapeUtil,
  WrappedTextShapeUtil,
  WrappedArrowShapeUtil,
} from "./NativeShapeWrappers";
import {
  SHAPE_TYPE,
  MEDIA_ICON_KINDS,
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
    editor.createShape({ type: "image", x, y, meta: meta as object, props: { assetId, w, h } });
    if (existingShapeId) editor.deleteShapes([existingShapeId]);
    return;
  }

  if (mime.startsWith("video/")) {
    const fileUrl = `/api/assets/${data.id}/file`;
    const { w, h: videoH } = await getVideoDisplaySizeFromUrl(fileUrl);
    editor.createShape<VideoShape>({
      id: createShapeId(), type: SHAPE_TYPE.VIDEO, x, y, meta: meta as object,
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
    editor.createShape({ type: "image", x, y, meta: meta as object, props: { assetId, w, h } });
    if (existingShapeId) editor.deleteShapes([existingShapeId]);
    return;
  }

  if (mime.startsWith("video/")) {
    const fileUrl = `/api/assets/${data.id}/file`;
    const { w, h: videoH } = await getVideoDisplaySizeFromUrl(fileUrl);
    editor.createShape<VideoShape>({
      id: createShapeId(), type: SHAPE_TYPE.VIDEO, x, y, meta: meta as object,
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
 *
 * 共通化: 全ファイル種別で FileIconShape に統一し、送信%を一貫して表示。
 * 完了後は placeFile で本来のシェイプ（VideoShape / AudioShape 等）に差し替え。
 * MIME は getEffectiveMimeType（@/lib/uploadCommon）で統一。
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

// ---- オーディオ・映像 ⇔ アイコン変換 -----------------------------------------

const FILE_ICON_SIZE = 96;

type TLShapeId = import("@cmpd/tlschema").TLShapeId;

const CENTER_BINDING = {
  type: "binding" as const,
  normalizedAnchor: { x: 0.5, y: 0.5 },
  isExact: false,
  isPrecise: false,
};

/** 指定シェイプに接続している矢印の ID と接続端（start/end）を収集。型変換で binding→point になる前に呼ぶ。 */
function getArrowsBoundToShape(
  editor: Editor,
  shapeId: TLShapeId
): { id: TLShapeId; end: "start" | "end" }[] {
  const result: { id: TLShapeId; end: "start" | "end" }[] = [];
  for (const s of editor.getCurrentPageShapes()) {
    if (s.type !== "arrow") continue;
    const props = s.props as { start?: { type?: string; boundShapeId?: TLShapeId }; end?: { type?: string; boundShapeId?: TLShapeId } };
    if (props.start?.type === "binding" && props.start.boundShapeId === shapeId) result.push({ id: s.id as TLShapeId, end: "start" });
    if (props.end?.type === "binding" && props.end.boundShapeId === shapeId) result.push({ id: s.id as TLShapeId, end: "end" });
  }
  return result;
}

/** 型変換で point にされた（またはまだ binding の）矢印を、同じシェイプに再 bind する。 */
function rebindArrowsToShape(editor: Editor, shapeId: TLShapeId, boundArrows: { id: TLShapeId; end: "start" | "end" }[]): void {
  const binding = { ...CENTER_BINDING, boundShapeId: shapeId };
  for (const { id: arrowId, end } of boundArrows) {
    const arrow = editor.getShape(arrowId);
    if (!arrow || arrow.type !== "arrow") continue;
    const props = arrow.props as { start?: { type?: string }; end?: { type?: string }; [k: string]: unknown };
    const current = end === "start" ? props.start : props.end;
    if (current?.type === "binding" && (current as { boundShapeId?: TLShapeId }).boundShapeId === shapeId) continue;
    editor.updateShapes([
      { id: arrowId, type: "arrow", props: { ...props, [end]: binding } },
    ]);
  }
}

const CONVERTIBLE_TO_FILE_ICON = [SHAPE_TYPE.AUDIO, SHAPE_TYPE.VIDEO, SHAPE_TYPE.TEXT_FILE] as const;

/**
 * audio-player / video-player / text-file を file-icon（アイコン表示）に変換する。
 * tldraw は updateShape で type を変更できないため、削除→作成で実現する。
 * 削除時に矢印の binding が point に変わるため、作成後に再 bind する。
 */
export function convertToFileIcon(editor: Editor, shapeId: string): boolean {
  const sid = shapeId as TLShapeId;
  const shape = editor.getShape(sid);
  if (!shape) return false;
  if (!CONVERTIBLE_TO_FILE_ICON.includes(shape.type as (typeof CONVERTIBLE_TO_FILE_ICON)[number])) return false;

  const boundArrows = getArrowsBoundToShape(editor, sid);
  const p = shape.props as { assetId?: string; fileName?: string; mimeType?: string; content?: string };
  const assetId = p.assetId ?? "";
  const fileName = p.fileName ?? "";
  const mimeType = p.mimeType ?? "";
  const kind = shape.type === SHAPE_TYPE.AUDIO ? "audio" : shape.type === SHAPE_TYPE.VIDEO ? "video" : "file";
  const { x, y } = shape;
  const meta = { ...(shape.meta ?? {}) } as Record<string, string | number>;
  if (shape.type === SHAPE_TYPE.TEXT_FILE && p.content) {
    meta._textContent = p.content;
  }

  editor.batch(() => {
    editor.deleteShapes([sid]);
    editor.createShape({
      id: sid,
      type: SHAPE_TYPE.FILE_ICON,
      x,
      y,
      meta,
      props: {
        assetId,
        fileName,
        mimeType,
        kind,
        w: FILE_ICON_SIZE,
        h: FILE_ICON_SIZE,
      } as FileIconShape["props"],
    });
    rebindArrowsToShape(editor, sid, boundArrows);
  });
  return true;
}

/** file-icon から変換可能な kind（audio / video → プレイヤー、file → text-file） */
const CONVERTIBLE_FROM_FILE_ICON_KINDS = ["audio", "video", "file"] as const;

/**
 * file-icon を kind に応じて audio-player / video-player / text-file に変換する。
 * tldraw は updateShape で type を変更できないため、削除→作成で実現する。
 * 削除時に矢印の binding が point に変わるため、作成後に再 bind する。
 */
export function convertFromFileIcon(editor: Editor, shapeId: string): boolean {
  const sid = shapeId as TLShapeId;
  const shape = editor.getShape(sid);
  if (!shape || shape.type !== SHAPE_TYPE.FILE_ICON) return false;

  const p = shape.props as FileIconShape["props"];
  const kind = p.kind;
  if (!(CONVERTIBLE_FROM_FILE_ICON_KINDS as readonly string[]).includes(kind)) return false;

  const boundArrows = getArrowsBoundToShape(editor, sid);
  const assetId = p.assetId ?? "";
  const fileName = p.fileName ?? "";
  const mimeType = p.mimeType ?? "";
  const { x, y } = shape;
  const meta = shape.meta ?? {};

  if (kind === "audio") {
    editor.batch(() => {
      editor.deleteShapes([sid]);
      editor.createShape({
        id: sid,
        type: SHAPE_TYPE.AUDIO,
        x,
        y,
        meta: meta as object,
        props: {
          assetId,
          fileName,
          mimeType,
          w: AUDIO_DEFAULT_W,
          h: AUDIO_DEFAULT_H,
        } as AudioShape["props"],
      });
      rebindArrowsToShape(editor, sid, boundArrows);
    });
  } else if (kind === "video") {
    const w = 480;
    const videoAreaH = Math.round(w / (16 / 9));
    const defaultH = videoAreaH + VIDEO_UI_OVERHEAD + MIN_COMMENT_LIST_H;
    editor.batch(() => {
      editor.deleteShapes([sid]);
      editor.createShape({
        id: sid,
        type: SHAPE_TYPE.VIDEO,
        x,
        y,
        meta: meta as object,
        props: {
          assetId,
          fileName,
          mimeType,
          w,
          h: defaultH,
        } as VideoShape["props"],
      });
      rebindArrowsToShape(editor, sid, boundArrows);
    });
  } else {
    const savedContent = typeof meta._textContent === "string" ? meta._textContent : "";
    const restoredMeta = { ...meta } as Record<string, unknown>;
    delete restoredMeta._textContent;
    editor.batch(() => {
      editor.deleteShapes([sid]);
      editor.createShape({
        id: sid,
        type: SHAPE_TYPE.TEXT_FILE,
        x,
        y,
        meta: restoredMeta as object,
        props: {
          assetId,
          fileName,
          mimeType,
          content: savedContent,
          w: 320,
          h: 240,
        } as TextFileShape["props"],
      });
      rebindArrowsToShape(editor, sid, boundArrows);
    });
  }
  return true;
}

/** @deprecated convertFromFileIcon を使用 */
export const convertToMediaPlayer = convertFromFileIcon;

export { FileIconShapeUtil, getFileEmoji } from "./file/FileIconShape";
export { TextFileShapeUtil, isTextFile } from "./file/TextFileShape";
export { AudioShapeUtil } from "./media/AudioShape";
export { VideoShapeUtil, VIDEO_UI_OVERHEAD } from "./media/VideoShape";
