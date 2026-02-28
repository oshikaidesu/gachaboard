/**
 * sync-server 用カスタムシェイプのスキーマ定義。
 * クライアント（TldrawBoard.tsx）の CUSTOM_SHAPE_UTILS と同じシェイプ構成にすることで、
 * useSync と TLSocketRoom のスキーマバージョンを一致させる。
 *
 * サーバー側なので component / indicator は空実装。
 * ラッパーシェイプ（WrappedImage 等）は型名が同じなのでネイティブ ShapeUtil を使う。
 */

import {
  BaseBoxShapeUtil,
  Rectangle2d,
  ImageShapeUtil,
  VideoShapeUtil,
  NoteShapeUtil,
  GeoShapeUtil,
  TextShapeUtil,
  ArrowShapeUtil,
  createTLSchemaFromUtils,
  type TLShape,
} from "@tldraw/tldraw";

// ---------- module augmentation (クライアント側と同一) ----------

const FILE_ICON_TYPE = "file-icon" as const;
const AUDIO_SHAPE_TYPE = "audio-player" as const;
const TEXT_FILE_TYPE = "text-file" as const;

declare module "@tldraw/tldraw" {
  interface TLGlobalShapePropsMap {
    [FILE_ICON_TYPE]: {
      assetId: string;
      fileName: string;
      mimeType: string;
      kind: string;
      w: number;
      h: number;
    };
    [AUDIO_SHAPE_TYPE]: {
      assetId: string;
      fileName: string;
      mimeType: string;
      w: number;
      h: number;
    };
    [TEXT_FILE_TYPE]: {
      assetId: string;
      fileName: string;
      mimeType: string;
      content: string;
      w: number;
      h: number;
    };
  }
}

type FileIconShape = TLShape<typeof FILE_ICON_TYPE>;
type AudioShape = TLShape<typeof AUDIO_SHAPE_TYPE>;
type TextFileShape = TLShape<typeof TEXT_FILE_TYPE>;

// ---------- 最小スタブ ShapeUtil ----------

class FileIconShapeUtil extends BaseBoxShapeUtil<FileIconShape> {
  static override type = FILE_ICON_TYPE;
  getDefaultProps(): FileIconShape["props"] {
    return { assetId: "", fileName: "file", mimeType: "application/octet-stream", kind: "file", w: 96, h: 96 };
  }
  override getGeometry(shape: FileIconShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }
  component() { return null; }
  indicator() { return null; }
}

class AudioShapeUtil extends BaseBoxShapeUtil<AudioShape> {
  static override type = AUDIO_SHAPE_TYPE;
  getDefaultProps(): AudioShape["props"] {
    return { assetId: "", fileName: "audio.mp3", mimeType: "audio/mpeg", w: 320, h: 96 };
  }
  override getGeometry(shape: AudioShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }
  component() { return null; }
  indicator() { return null; }
}

class TextFileShapeUtil extends BaseBoxShapeUtil<TextFileShape> {
  static override type = TEXT_FILE_TYPE;
  getDefaultProps(): TextFileShape["props"] {
    return { assetId: "", fileName: "file.txt", mimeType: "text/plain", content: "", w: 320, h: 240 };
  }
  override getGeometry(shape: TextFileShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }
  component() { return null; }
  indicator() { return null; }
}

// ---------- スキーマ生成 ----------
// クライアントの CUSTOM_SHAPE_UTILS と同じ構成:
//   カスタム3種 + 組み込みラッパー6種（サーバー側はネイティブ ShapeUtil を使用）

export const customSchema = createTLSchemaFromUtils({
  shapeUtils: [
    FileIconShapeUtil,
    AudioShapeUtil,
    TextFileShapeUtil,
    ImageShapeUtil,
    VideoShapeUtil,
    NoteShapeUtil,
    GeoShapeUtil,
    TextShapeUtil,
    ArrowShapeUtil,
  ],
});
