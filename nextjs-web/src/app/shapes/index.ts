/**
 * カスタムシェイプの登録・振り分けロジック
 *
 * 新しいシェイプを追加する手順:
 *   1. このディレクトリに XxxShape.tsx を作成し、ShapeUtil クラスをエクスポートする
 *   2. CUSTOM_SHAPE_UTILS 配列に XxxShapeUtil を追加する
 *   3. placeFile() 関数に振り分け分岐を追加する
 *
 * TldrawBoard.tsx は触らない。
 */

import { Editor, createShapeId, AssetRecordType, TLImageAsset, TLVideoAsset } from "@tldraw/tldraw";
import { FileIconShapeUtil, FileIconShape } from "./FileIconShape";
import { TextFileShapeUtil, TextFileShape, isTextFile } from "./TextFileShape";
import { AudioShapeUtil, AudioShape } from "./AudioShape";
import {
  WrappedImageShapeUtil,
  WrappedVideoShapeUtil,
  WrappedNoteShapeUtil,
  WrappedGeoShapeUtil,
  WrappedTextShapeUtil,
  WrappedArrowShapeUtil,
} from "./NativeShapeWrappers";

// ---- 型定義 ----------------------------------------------------------------

export type ApiAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: string;
};

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
  // 組み込みシェイプのラッパー（CreatorLabel 追加）
  WrappedImageShapeUtil,
  WrappedVideoShapeUtil,
  WrappedNoteShapeUtil,
  WrappedGeoShapeUtil,
  WrappedTextShapeUtil,
  WrappedArrowShapeUtil,
];

// ---- ファイル振り分けロジック ------------------------------------------------

async function fetchTextContent(assetId: string): Promise<string> {
  try {
    const res = await fetch(`/api/assets/${assetId}/file`);
    if (!res.ok) return "(読み込みエラー)";
    const text = await res.text();
    return text.length > 10240 ? text.slice(0, 10240) + "\n…(以下省略)" : text;
  } catch {
    return "(読み込みエラー)";
  }
}

/**
 * アップロード済みファイル 1 件をキャンバス上に配置する。
 *
 * @param editor     tldraw の Editor インスタンス
 * @param file       ドロップされた File オブジェクト（mime 判定に使用）
 * @param data       /api/assets へのアップロード結果
 * @param position   キャンバス上の配置座標（ページ座標）
 * @param createdBy  作成者名（シェイプ左上に表示）
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

  // --- 画像 / GIF ---
  if (mime.startsWith("image/")) {
    const assetId = AssetRecordType.createId();
    const imageAsset: TLImageAsset = {
      id: assetId,
      typeName: "asset",
      type: "image",
      props: {
        src: `/api/assets/${data.id}/file`,
        w: 320,
        h: 240,
        name: data.fileName,
        isAnimated: mime === "image/gif",
        mimeType: mime,
        fileSize: Number(data.sizeBytes),
      },
      meta: {},
    };
    editor.createAssets([imageAsset]);
    editor.createShape({ type: "image", x, y, meta, props: { assetId, w: 320, h: 240 } });
    return;
  }

  // --- 動画 ---
  if (mime.startsWith("video/")) {
    const assetId = AssetRecordType.createId();
    const videoAsset: TLVideoAsset = {
      id: assetId,
      typeName: "asset",
      type: "video",
      props: {
        src: `/api/assets/${data.id}/file`,
        w: 320,
        h: 240,
        name: data.fileName,
        isAnimated: true,
        mimeType: mime,
        fileSize: Number(data.sizeBytes),
      },
      meta: {},
    };
    editor.createAssets([videoAsset]);
    editor.createShape({ type: "video", x, y, meta, props: { assetId, w: 320, h: 240 } });
    return;
  }

  // --- テキスト系 ---
  if (isTextFile(file.name, mime)) {
    const content = await fetchTextContent(data.id);
    editor.createShape<TextFileShape>({
      id: createShapeId(),
      type: "text-file",
      x,
      y,
      meta,
      props: {
        assetId: data.id,
        fileName: data.fileName,
        mimeType: data.mimeType,
        content,
        w: 320,
        h: 240,
      },
    });
    return;
  }

  // --- 音声 ---
  if (mime.startsWith("audio/")) {
    editor.createShape<AudioShape>({
      id: createShapeId(),
      type: "audio-player",
      x,
      y,
      meta,
      props: {
        assetId: data.id,
        fileName: data.fileName,
        mimeType: data.mimeType,
        w: 320,
        h: 96,
      },
    });
    return;
  }

  // --- その他（アイコン表示） ---
  editor.createShape<FileIconShape>({
    id: createShapeId(),
    type: "file-icon",
    x,
    y,
    meta,
    props: {
      assetId: data.id,
      fileName: data.fileName,
      mimeType: data.mimeType,
      kind: data.kind,
      w: 96,
      h: 96,
    },
  });
}

// ---- 個別エクスポート（TldrawBoard 以外から使う場合向け） -------------------

export { FileIconShapeUtil, type FileIconShape, getFileEmoji } from "./FileIconShape";
export { TextFileShapeUtil, type TextFileShape, isTextFile } from "./TextFileShape";
export { AudioShapeUtil, type AudioShape } from "./AudioShape";
