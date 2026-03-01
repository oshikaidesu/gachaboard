/**
 * カスタムシェイプの Single Source of Truth。
 * クライアント（TldrawBoard.tsx）と sync-server の双方からインポートし、
 * 型定義・デフォルトprops・MIMEマッチ・declare module 拡張を一元管理する。
 *
 * 新しいカスタムシェイプを追加する場合:
 *   1. SHAPE_DEFS にエントリを追加
 *   2. shapes/ ディレクトリに ShapeUtil クラスを作成
 *   3. shapes/index.ts の CUSTOM_SHAPE_UTILS に追加
 * これだけで placeFile / placeholderShape / sync-server スキーマへの反映は自動。
 */

import type { TLShape } from "@tldraw/tldraw";

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
};

// ---------- declare module（1 回限り） ----------

declare module "@tldraw/tldraw" {
  interface TLGlobalShapePropsMap {
    [K: string]: Record<string, unknown>;
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

// ---------- シェイプ型エイリアス ----------

export type FileIconShape = TLShape<typeof SHAPE_TYPE.FILE_ICON>;
export type AudioShape = TLShape<typeof SHAPE_TYPE.AUDIO>;
export type TextFileShape = TLShape<typeof SHAPE_TYPE.TEXT_FILE>;

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
  [SHAPE_TYPE.AUDIO]: {
    defaultProps: {
      assetId: "",
      fileName: "audio.mp3",
      mimeType: "audio/mpeg",
      w: 560,
      h: 160,
    } satisfies AudioProps,
    matchMime: (mime) => mime.startsWith("audio/"),
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
 */
export function resolveShapeType(
  mime: string,
  fileName: string,
): { type: string; def: ShapeDef } | null {
  if (mime.startsWith("image/") || mime.startsWith("video/")) {
    return null;
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

/** SHAPE_DEFS の全型名を配列で返す（sync-server スキーマ自動生成用） */
export function getCustomShapeTypes(): string[] {
  return Object.keys(SHAPE_DEFS);
}
