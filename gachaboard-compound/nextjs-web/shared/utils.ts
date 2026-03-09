import prettyBytes from "pretty-bytes";

/** ファイルサイズを人間が読みやすい形式にフォーマットする */
export function formatFileSize(bytes: number | string | null | undefined): string {
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : (bytes ?? 0);
  if (!n || isNaN(n)) return "";
  return prettyBytes(n, { binary: true });
}
