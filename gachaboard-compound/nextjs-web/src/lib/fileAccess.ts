/**
 * File System Access API のサポート検出とファイル選択。
 * browser-fs-access ライブラリを使用。
 */

import { fileOpen, supported } from "browser-fs-access";

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && supported;
}

export type OpenFileResult =
  | { ok: true; file: File; handle: FileSystemFileHandle }
  | { ok: false; error: string };

/**
 * ファイル選択ダイアログを開き、ハンドル付きでファイルを取得。
 * サポート外の場合は file 入力フォールバックを推奨。
 */
export async function openFileWithHandle(): Promise<OpenFileResult> {
  if (!isFileSystemAccessSupported()) {
    return { ok: false, error: "File System Access API に対応していません" };
  }
  try {
    const fileWithHandle = await fileOpen({
      description: "すべてのファイル",
      mimeTypes: ["*/*"],
      multiple: false,
    });
    const handle = fileWithHandle.handle;
    if (!handle) {
      return { ok: false, error: "ファイルハンドルを取得できませんでした" };
    }
    return { ok: true, file: fileWithHandle, handle };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "キャンセルされました" };
    }
    return { ok: false, error: e instanceof Error ? e.message : "ファイルを開けませんでした" };
  }
}

export type OpenAllFilesResult =
  | { ok: true; files: File[]; handles: (FileSystemFileHandle | null)[] }
  | { ok: false; error: string };

/**
 * 複数ファイル選択ダイアログを開く（すべてのファイルタイプ）。
 * File System Access API 対応時は複数選択可。未対応時は input フォールバック。
 */
export async function openAllFilesPicker(): Promise<OpenAllFilesResult> {
  try {
    const results = await fileOpen({
      description: "すべてのファイル",
      mimeTypes: ["*/*"],
      multiple: true,
    });
    const files = Array.isArray(results) ? results : [results];
    const filtered = files.filter((f) => f.size > 0);
    if (filtered.length === 0) {
      return { ok: false, error: "キャンセルされました" };
    }
    const handles = filtered.map((f) => f.handle ?? null);
    return { ok: true, files: filtered, handles };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "キャンセルされました" };
    }
    return { ok: false, error: e instanceof Error ? e.message : "ファイルを開けませんでした" };
  }
}
