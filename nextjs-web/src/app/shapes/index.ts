/**
 * カスタムシェイプの登録・振り分けのエントリ（compound 用）。
 * 配置ロジックは shapeCreators、変換ロジックは shapeConverters に分離。
 */

import {
  DrawShapeUtil,
  HighlightShapeUtil,
  LineShapeUtil,
  FrameShapeUtil,
  BookmarkShapeUtil,
  EmbedShapeUtil,
} from "@cmpd/compound";
import { FileIconShapeUtil } from "./file/FileIconShape";
import { TextFileShapeUtil } from "./file/TextFileShape";
import { AudioShapeUtil } from "./media/AudioShape";
import { VideoShapeUtil } from "./media/VideoShape";
import {
  WrappedImageShapeUtil,
  WrappedNoteShapeUtil,
  WrappedGeoShapeUtil,
  WrappedTextShapeUtil,
  WrappedArrowShapeUtil,
} from "./NativeShapeWrappers";

/** Compound の shapeUtils prop に渡す配列。 */
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

// ---- 型・定数の re-export ----
export type { ApiAsset } from "@shared/apiTypes";
export type { FileIconShape, AudioShape, TextFileShape, VideoShape } from "@shared/shapeDefs";

// ---- 配置（shapeCreators） ----
export { placeFile, placeAsset, placeholderShape } from "./shapeCreators";

// ---- 変換（shapeConverters） ----
export {
  convertToFileIcon,
  convertFromFileIcon,
  convertToMediaPlayer,
} from "./shapeConverters";

// ---- シェイプユーティリティ・定数 ----
export { FileIconShapeUtil, getFileEmoji } from "./file/FileIconShape";
export { TextFileShapeUtil, isTextFile } from "./file/TextFileShape";
export { AudioShapeUtil } from "./media/AudioShape";
export { VideoShapeUtil, VIDEO_UI_OVERHEAD } from "./media/VideoShape";
