import { getSafeAssetId } from "@/lib/safeUrl";

/**
 * アセットファイルをダウンロードする。
 * ストリーム読み取りと進捗コールバックをサポート。
 */
export async function downloadAsset(
  assetId: string,
  fileName: string,
  onProgress?: (received: number, total: number | null) => void
): Promise<void> {
  const safe = getSafeAssetId(assetId);
  if (!safe) throw new Error("Invalid assetId");
  const res = await fetch(`/api/assets/${safe}/file?download=1`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentLength = res.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : null;
  const reader = res.body?.getReader();

  if (!reader) throw new Error("ReadableStream not supported");

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(received, total);
  }

  const blob = new Blob(chunks as BlobPart[]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
