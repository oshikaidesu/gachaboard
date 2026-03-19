/**
 * カスタムシェイプの Single Source of Truth。
 * クライアント（TldrawBoard.tsx）と sync-server の双方からインポートし、
 * 型定義・デフォルトprops・MIMEマッチ・declare module 拡張を一元管理する。
 *
 * 新しいカスタムシェイプを追加する場合:
 *   1. SHAPE_DEFS にエントリを追加
 *   2. shapes/file/ または shapes/media/ に ShapeUtil クラスを作成
 *   3. shapes/index.ts の CUSTOM_SHAPE_UTILS に追加
 * これだけで placeFile / placeholderShape / sync-server スキーマへの反映は自動。
 */

import type { TLUnknownShape } from "@cmpd/tlschema";
import { isPlayableAudio } from "./mimeUtils";

// ---------- テキストファイル判定（shapes/ と shared の両方で使う） ----------

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "log", "csv",
  "json", "yaml", "yml", "toml", "xml",
  "js", "ts", "jsx", "tsx", "py", "go", "rs", "cpp", "c", "java",
  "html", "css", "sh", "bash", "zsh",
]);

export function isTextFile(fileName: string, mimeType: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext) || mimeType.startsWith("text/");
}

// ---------- シェイプ型名 ----------

export const SHAPE_TYPE = {
  FILE_ICON: "file-icon" as const,
  AUDIO: "audio-player" as const,
  TEXT_FILE: "text-file" as const,
  VIDEO: "video-player" as const,
};

/** file-icon から audio-player / video-player へ変換可能な kind */
export const MEDIA_ICON_KINDS = ["audio", "video"] as const;

/**
 * プレイヤー／テキスト表示ボタンが出る拡張子の一覧（参考）。
 * 映像→video-player、音→audio-player、テキスト→text-file に変換可能なものだけ。
 * 実際の表示判定は canShowFileIconConvertButton で行う。
 */
export const CONVERT_BUTTON_EXTENSIONS = {
  /** 映像（video-player）: MIME が video/* のもの */
  video: ["mp4", "webm", "mov", "avi", "mkv", "wmv", "flv", "m4v", "mpeg", "mpg", "3gp"],
  /** 音（audio-player）: isPlayableAudio に該当する MIME */
  audio: ["mp3", "wav", "ogg", "m4a", "aac", "flac", "webm"],
  /** テキスト（text-file）: isTextFile に該当する拡張子 */
  text: ["txt", "md", "log", "csv", "json", "yaml", "yml", "toml", "xml", "js", "ts", "jsx", "tsx", "py", "go", "rs", "cpp", "c", "java", "html", "css", "sh", "bash", "zsh"],
} as const;

// ---------- declare module（compound 用） ----------
// カスタムシェイプの props を compound に登録

declare module "@cmpd/tlschema" {
  interface TLGlobalShapePropsMap {
    "file-icon": FileIconProps;
    "audio-player": AudioProps;
    "text-file": TextFileProps;
    "video-player": VideoProps;
  }
}

// ---------- props 型定義 ----------

export type FileIconProps = {
  assetId: string;
  fileName: string;
  mimeType: string;
  kind: string;
  w: number;
  h: number;
};

export type AudioProps = {
  assetId: string;
  fileName: string;
  mimeType: string;
  w: number;
  h: number;
};

export type TextFileProps = {
  assetId: string;
  fileName: string;
  mimeType: string;
  content: string;
  w: number;
  h: number;
};

export type VideoProps = {
  assetId: string;
  fileName: string;
  mimeType: string;
  w: number;
  h: number;
};

// ---------- シェイプ型エイリアス ----------

export type FileIconShape = TLUnknownShape & { type: "file-icon"; props: FileIconProps };
export type AudioShape = TLUnknownShape & { type: "audio-player"; props: AudioProps };
export type TextFileShape = TLUnknownShape & { type: "text-file"; props: TextFileProps };
export type VideoShape = TLUnknownShape & { type: "video-player"; props: VideoProps };

// ---------- レジストリ定義 ----------

export type ShapeDef<P extends Record<string, unknown> = Record<string, unknown>> = {
  defaultProps: P;
  matchMime: (mime: string, fileName: string) => boolean;
  /** 高い数値ほど先にマッチ試行される。file-icon (0) が fallback。 */
  priority: number;
  /** image/video はネイティブ tldraw アセットとして処理するため true */
  useNativeAsset?: boolean;
};

export const SHAPE_DEFS: Record<string, ShapeDef> = {
  [SHAPE_TYPE.VIDEO]: {
    defaultProps: {
      assetId: "",
      fileName: "video.mp4",
      mimeType: "video/mp4",
      w: 480,
      h: 474,
    } satisfies VideoProps,
    matchMime: (mime) => mime === "video/mp4",
    priority: 40,
  },
  [SHAPE_TYPE.AUDIO]: {
    defaultProps: {
      assetId: "",
      fileName: "audio.mp3",
      mimeType: "audio/mpeg",
      w: 560,
      h: 252, // BASE_HEIGHT(190) + MIN_COMMENT_LIST_H(62)。placeFile 時は createShapeForResolved が AudioShapeUtil.getDefaultProps() を参照するため実質未使用
    } satisfies AudioProps,
    matchMime: (mime) => isPlayableAudio(mime),
    priority: 30,
  },
  [SHAPE_TYPE.TEXT_FILE]: {
    defaultProps: {
      assetId: "",
      fileName: "file.txt",
      mimeType: "text/plain",
      content: "",
      w: 320,
      h: 240,
    } satisfies TextFileProps,
    matchMime: (mime, fileName) => isTextFile(fileName, mime),
    priority: 20,
  },
  [SHAPE_TYPE.FILE_ICON]: {
    defaultProps: {
      assetId: "",
      fileName: "file",
      mimeType: "application/octet-stream",
      kind: "file",
      w: 96,
      h: 96,
    } satisfies FileIconProps,
    matchMime: () => true,
    priority: 0,
  },
};

/**
 * MIME とファイル名から最適なカスタムシェイプ型を返す。
 * image/video はネイティブアセットで扱うため null を返す。
 * PDF は画像取り出し処理を避け file-icon で表示する。
 * PSD もプレビュー不可のため file-icon で表示する。
 * .ai（Illustrator）も file-icon で表示する。
 */
export function resolveShapeType(
  mime: string,
  fileName: string,
): { type: string; def: ShapeDef } | null {
  if (mime === "image/vnd.adobe.photoshop") {
    return { type: SHAPE_TYPE.FILE_ICON, def: SHAPE_DEFS[SHAPE_TYPE.FILE_ICON] };
  }
  if (mime.startsWith("image/")) {
    return null;
  }
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mime === "application/illustrator" || ext === "ai") {
    return { type: SHAPE_TYPE.FILE_ICON, def: SHAPE_DEFS[SHAPE_TYPE.FILE_ICON] };
  }
  if (mime === "application/pdf") {
    return { type: SHAPE_TYPE.FILE_ICON, def: SHAPE_DEFS[SHAPE_TYPE.FILE_ICON] };
  }
  const sorted = Object.entries(SHAPE_DEFS).sort(
    ([, a], [, b]) => b.priority - a.priority,
  );
  for (const [type, def] of sorted) {
    if (def.matchMime(mime, fileName)) {
      return { type, def };
    }
  }
  return { type: SHAPE_TYPE.FILE_ICON, def: SHAPE_DEFS[SHAPE_TYPE.FILE_ICON] };
}

/**
 * file-icon で「プレイヤーで表示」「テキストで表示」ボタンを出すかどうか。
 * 映像・音・テキストのカスタムシェイプに変換可能な場合のみ true。
 */
export function canShowFileIconConvertButton(
  kind: string,
  mimeType: string,
  fileName: string,
): boolean {
  if ((MEDIA_ICON_KINDS as readonly string[]).includes(kind)) return true;
  if (kind !== "file") return false;
  const resolved = resolveShapeType(mimeType, fileName);
  return resolved?.type === SHAPE_TYPE.TEXT_FILE;
}

/** SHAPE_DEFS の全型名を配列で返す（sync-server スキーマ自動生成用） */
export function getCustomShapeTypes(): string[] {
  return Object.keys(SHAPE_DEFS);
}

// ---------- tldraw 組み込みシェイプ型名リスト --------------------------------
//
// クライアント（shapes/index.ts）と sync-server（shapeSchema.ts）の両方が
// このリストを参照することで、スキーマの乖離を防ぐ。
//
// 新しい tldraw バージョンで組み込みシェイプが追加・削除された場合は
// ここだけを更新すれば両方に反映される。

export const TLDRAW_BUILTIN_SHAPE_TYPES = [
  "image",
  // "video" はクライアントが "video-player"（カスタム）で代替するため除外
  "note",
  "geo",
  "text",
  "arrow",
  "draw",
  "highlight",
  "line",
  "frame",
  "bookmark",
  "embed",
  "group",
] as const;

export type TldrawBuiltinShapeType = (typeof TLDRAW_BUILTIN_SHAPE_TYPES)[number];
