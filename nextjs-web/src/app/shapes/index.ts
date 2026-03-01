/**
 * カスタムシェイプの登録・振り分けロジック
 *
 * 新しいシェイプを追加する手順:
 *   1. このディレクトリに XxxShape.tsx を作成し、ShapeUtil クラスをエクスポートする
 *   2. CUSTOM_SHAPE_UTILS 配列に XxxShapeUtil を追加する
 *   3. shared/shapeDefs.ts の SHAPE_DEFS にエントリを追加する
 *
 * placeFile / placeholderShape / sync-server スキーマへの反映は自動。
 * TldrawBoard.tsx は触らない。
 */

import {
  Editor, createShapeId, AssetRecordType, TLImageAsset,
  DrawShapeUtil,
  HighlightShapeUtil,
  LineShapeUtil,
  FrameShapeUtil,
  BookmarkShapeUtil,
  EmbedShapeUtil,
} from "@tldraw/tldraw";
import { FileIconShapeUtil } from "./FileIconShape";
import { TextFileShapeUtil } from "./TextFileShape";
import { AudioShapeUtil } from "./AudioShape";
import { VideoShapeUtil } from "./VideoShape";
import {
  WrappedImageShapeUtil,
  WrappedNoteShapeUtil,
  WrappedGeoShapeUtil,
  WrappedTextShapeUtil,
  WrappedArrowShapeUtil,
} from "./NativeShapeWrappers";
import {
  SHAPE_TYPE,
  SHAPE_DEFS,
  resolveShapeType,
  type FileIconShape,
  type AudioShape,
  type VideoShape,
  type TextFileShape,
} from "@shared/shapeDefs";

import type { ApiAsset } from "@shared/apiTypes";
import { MAX_TEXT_PREVIEW_BYTES } from "@shared/constants";

// ---- 型定義（後方互換のため残す） ----------------------------------------

export type { ApiAsset } from "@shared/apiTypes";

// ---- シェイプ登録 -----------------------------------------------------------

/**
 * tldraw の shapeUtils prop に渡す配列。
 * 新しいシェイプを追加したらここに追記する。
 */
export const CUSTOM_SHAPE_UTILS = [
  // カスタムシェイプ
  FileIconShapeUtil,
  TextFileShapeUtil,
  AudioShapeUtil,
  VideoShapeUtil,
  // 組み込みシェイプのラッパー（CreatorLabel 追加）
  WrappedImageShapeUtil,
  WrappedNoteShapeUtil,
  WrappedGeoShapeUtil,
  WrappedTextShapeUtil,
  WrappedArrowShapeUtil,
  // 組み込みシェイプ（ラッパー不要・スキーマ一致のために登録）
  DrawShapeUtil,
  HighlightShapeUtil,
  LineShapeUtil,
  FrameShapeUtil,
  BookmarkShapeUtil,
  EmbedShapeUtil,
];

// ---- ファイル振り分けロジック ------------------------------------------------

const MAX_IMAGE_SIZE = 300;

function getImageDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: nw, naturalHeight: nh } = img;
      URL.revokeObjectURL(url);
      if (nw <= MAX_IMAGE_SIZE && nh <= MAX_IMAGE_SIZE) {
        resolve({ w: nw, h: nh });
      } else {
        const scale = Math.min(MAX_IMAGE_SIZE / nw, MAX_IMAGE_SIZE / nh);
        resolve({ w: Math.round(nw * scale), h: Math.round(nh * scale) });
      }
    };
    img.onerror = () => {
      resolve({ w: MAX_IMAGE_SIZE, h: MAX_IMAGE_SIZE });
      URL.revokeObjectURL(url);
    };
    img.src = url;
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

/**
 * アップロード済みファイル 1 件をキャンバス上に配置する。
 * SHAPE_DEFS の priority / matchMime でシェイプ種別を自動判定する。
 */
export async function placeFile(
  editor: Editor,
  file: File,
  data: ApiAsset,
  position: { x: number; y: number },
  createdBy = "Unknown"
): Promise<void> {
  const mime = file.type || "application/octet-stream";
  const { x, y } = position;
  const meta = { createdBy };

  // --- 画像（ネイティブ tldraw アセット） ---
  if (mime.startsWith("image/")) {
    const { w: imgW, h: imgH } = await getImageDimensions(file);
    const assetId = AssetRecordType.createId();
    const imageAsset: TLImageAsset = {
      id: assetId,
      typeName: "asset",
      type: "image",
      props: {
        src: `/api/assets/${data.id}/file`,
        w: imgW,
        h: imgH,
        name: data.fileName,
        isAnimated: mime === "image/gif",
        mimeType: mime,
        fileSize: Number(data.sizeBytes),
      },
      meta: {},
    };
    editor.createAssets([imageAsset]);
    editor.createShape({ type: "image", x, y, meta, props: { assetId, w: imgW, h: imgH } });
    return;
  }

  // --- カスタムシェイプ（SHAPE_DEFS でデータ駆動判定） ---
  const resolved = resolveShapeType(mime, file.name);
  if (!resolved) return;

  const { type, def } = resolved;
  const baseProps = { ...def.defaultProps, assetId: data.id, fileName: data.fileName, mimeType: data.mimeType };

  // text-file のみコンテンツ取得が必要
  if (type === SHAPE_TYPE.TEXT_FILE) {
    const content = await fetchTextContent(data.id);
    editor.createShape<TextFileShape>({
      id: createShapeId(), type, x, y, meta,
      props: { ...baseProps, content } as TextFileShape["props"],
    });
    return;
  }

  if (type === SHAPE_TYPE.AUDIO) {
    editor.createShape<AudioShape>({
      id: createShapeId(), type, x, y, meta,
      props: baseProps as AudioShape["props"],
    });
    return;
  }

  if (type === SHAPE_TYPE.VIDEO) {
    editor.createShape<VideoShape>({
      id: createShapeId(), type, x, y, meta,
      props: baseProps as VideoShape["props"],
    });
    return;
  }

  // file-icon（fallback）
  editor.createShape<FileIconShape>({
    id: createShapeId(), type, x, y, meta,
    props: { ...baseProps, kind: data.kind } as FileIconShape["props"],
  });
}

/**
 * アップロード開始直後に仮シェイプを配置する。
 * assetId="" で配置することで AssetLoader がローディング表示を出す。
 * アップロード完了後に呼び出し元が deleteShapes → placeFile で差し替える。
 */
export async function placeholderShape(
  editor: Editor,
  file: File,
  position: { x: number; y: number },
  createdBy = "Unknown"
): Promise<ReturnType<typeof createShapeId> | null> {
  const mime = file.type || "application/octet-stream";
  const { x, y } = position;
  const meta = { createdBy };
  const id = createShapeId();

  // image はネイティブアセットなので FileIconShape で仮表示
  if (mime.startsWith("image/")) {
    editor.createShape<FileIconShape>({
      id, type: SHAPE_TYPE.FILE_ICON, x, y, meta,
      props: { assetId: "", fileName: file.name, mimeType: mime, kind: "image", w: 96, h: 96 },
    });
    return id;
  }

  const resolved = resolveShapeType(mime, file.name);
  if (!resolved) return null;

  const { type, def } = resolved;
  const baseProps = { ...def.defaultProps, assetId: "", fileName: file.name, mimeType: mime };

  if (type === SHAPE_TYPE.TEXT_FILE) {
    editor.createShape<TextFileShape>({
      id, type, x, y, meta,
      props: { ...baseProps, content: "" } as TextFileShape["props"],
    });
    return id;
  }

  if (type === SHAPE_TYPE.AUDIO) {
    editor.createShape<AudioShape>({
      id, type, x, y, meta,
      props: baseProps as AudioShape["props"],
    });
    return id;
  }

  if (type === SHAPE_TYPE.VIDEO) {
    editor.createShape<VideoShape>({
      id, type, x, y, meta,
      props: baseProps as VideoShape["props"],
    });
    return id;
  }

  // file-icon（fallback）
  editor.createShape<FileIconShape>({
    id, type: SHAPE_TYPE.FILE_ICON, x, y, meta,
    props: { ...baseProps, kind: "file", w: 96, h: 96 } as FileIconShape["props"],
  });
  return id;
}

// ---- 個別エクスポート（TldrawBoard 以外から使う場合向け） -------------------

export { FileIconShapeUtil, type FileIconShape, getFileEmoji } from "./FileIconShape";
export { TextFileShapeUtil, type TextFileShape, isTextFile } from "./TextFileShape";
export { AudioShapeUtil, type AudioShape } from "./AudioShape";
export { VideoShapeUtil, type VideoShape } from "./VideoShape";
