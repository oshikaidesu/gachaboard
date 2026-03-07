/**
 * File System Access API のサポート検出とファイル選択。
 * Chromium 系ブラウザで利用可能。再開可能アップロードに使用。
 */

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
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
    const [handle] = await (window as unknown as {
      showOpenFilePicker: (opts?: { types?: { description?: string; accept?: Record<string, string[]> }[]; multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
    }).showOpenFilePicker({
      types: [{ description: "すべてのファイル", accept: { "*/*": [] } }],
      multiple: false,
    });
    const file = await handle.getFile();
    return { ok: true, file, handle };
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
  if (isFileSystemAccessSupported()) {
    try {
      const handles = await (window as unknown as {
        showOpenFilePicker: (opts?: { types?: { description?: string; accept?: Record<string, string[]> }[]; multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
      }).showOpenFilePicker({
        types: [{ description: "すべてのファイル", accept: { "*/*": [] } }],
        multiple: true,
      });
      const files = await Promise.all(handles.map((h) => h.getFile()));
      return { ok: true, files, handles };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return { ok: false, error: "キャンセルされました" };
      }
      return { ok: false, error: e instanceof Error ? e.message : "ファイルを開けませんでした" };
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => {
      const files = input.files ? Array.from(input.files).filter((f) => f.size > 0) : [];
      input.remove();
      if (files.length === 0) {
        resolve({ ok: false, error: "キャンセルされました" });
      } else {
        resolve({ ok: true, files, handles: files.map(() => null) });
      }
    };
    input.click();
  });
}
