/**
 * S3 マルチパートアップロードのロジック（新規・再開）。
 * useFileDropHandler から分離。init → パート送信 → complete の流れを名前付きで実行。
 */

import pLimit from "p-limit";
import { getEffectiveMimeType } from "@/lib/uploadCommon";
import {
  saveS3UploadSession,
  removeS3UploadSession,
  type StoredSession,
} from "./s3UploadSessionStore";
import type { ApiAsset } from "@shared/apiTypes";

export const S3_REQUIRED_MSG =
  "MinIO が起動していません。docker compose up -d で MinIO を起動してください。";

const S3_PART_SIZE = 100 * 1024 * 1024; // 100MB
const CHUNK_CONCURRENCY = 4;

// ---------- パート PUT（進捗付き） ----------

/** Presigned URL へ PUT し、アップロード中の進捗を onProgress(0..1) で通知。ETag を返す。 */
function putWithProgress(
  url: string,
  body: Blob,
  onProgress: (loadedRatio: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(e.loaded / e.total);
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("etag");
        if (etag) resolve(etag);
        else reject(new Error("No ETag in response"));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Upload network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));
    xhr.send(body);
  });
}

// ---------- 並列実行 ----------

export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const limit = pLimit(concurrency);
  return Promise.allSettled(tasks.map((task) => limit(() => task())));
}

// ---------- 新規アップロード（init → パート送信 → complete） ----------

export async function uploadFileViaS3(
  file: File,
  boardId: string,
  onProgress?: (pct: number) => void,
  handle?: FileSystemFileHandle | null,
): Promise<ApiAsset> {
  const mimeType = getEffectiveMimeType(file);
  const initRes = await fetch("/api/assets/upload/s3/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      totalSize: file.size,
      boardId,
    }),
  });
  if (initRes.status === 503) {
    throw new Error(S3_REQUIRED_MSG);
  }
  if (!initRes.ok) {
    const body = await initRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `S3 init failed: ${initRes.status}`);
  }
  const init = (await initRes.json()) as {
    uploadId: string;
    key: string;
    storageKey: string;
    totalParts: number;
    presignedUrls: string[];
  };
  const { uploadId, key, storageKey, totalParts, presignedUrls } = init;

  if (handle) {
    await saveS3UploadSession({
      uploadId,
      key,
      storageKey,
      fileName: file.name,
      mimeType,
      totalSize: file.size,
      totalParts,
      boardId,
      handle,
      createdAt: Date.now(),
    });
  }

  onProgress?.(0);

  const parts: { PartNumber: number; ETag: string }[] = [];
  let done = 0;

  const uploadPart = async (partNumber: number) => {
    const start = (partNumber - 1) * S3_PART_SIZE;
    const end = Math.min(start + S3_PART_SIZE, file.size);
    const chunk = file.slice(start, end);
    const url = presignedUrls[partNumber - 1];
    const etag = await putWithProgress(url, chunk, (loaded) => {
      // loaded は 0..1。このパート完了分 = (partNumber-1) + loaded
      const pct = ((partNumber - 1) + loaded) / totalParts;
      onProgress?.(Math.round(pct * 95));
    });
    done++;
    onProgress?.(Math.round((done / totalParts) * 95));
    parts.push({ PartNumber: partNumber, ETag: etag });
  };

  const partTasks = Array.from({ length: totalParts }, (_, i) => () => uploadPart(i + 1));
  const results = await runWithConcurrency(partTasks, CHUNK_CONCURRENCY);
  const rejected = results.find((r) => r.status === "rejected");
  if (rejected) throw (rejected as PromiseRejectedResult).reason;

  parts.sort((a, b) => a.PartNumber - b.PartNumber);
  const completeRes = await fetch("/api/assets/upload/s3/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uploadId,
      key,
      storageKey,
      fileName: file.name,
      mimeType,
      totalSize: file.size,
      boardId,
      parts,
    }),
  });
  if (!completeRes.ok) {
    const body = await completeRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `S3 complete failed: ${completeRes.status}`);
  }
  await removeS3UploadSession(uploadId).catch(() => {});
  onProgress?.(100);
  return completeRes.json() as Promise<ApiAsset>;
}

// ---------- 再開アップロード（status → 未完了パート送信 → complete） ----------

export async function uploadFileViaS3Resume(
  session: StoredSession,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ApiAsset> {
  const { uploadId, key, storageKey, totalParts, boardId } = session;
  if (file.size !== session.totalSize || file.name !== session.fileName) {
    throw new Error("ファイルが一致しません。同じファイルを選択してください。");
  }

  const statusRes = await fetch(
    `/api/assets/upload/s3/status?uploadId=${encodeURIComponent(uploadId)}`,
  );
  if (!statusRes.ok) {
    const body = await statusRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Status failed: ${statusRes.status}`);
  }
  const status = (await statusRes.json()) as {
    completedPartNumbers: number[];
    completedParts: { PartNumber: number; ETag: string }[];
  };
  const completedSet = new Set(status.completedPartNumbers);
  const allParts = new Map<number, { PartNumber: number; ETag: string }>();
  for (const p of status.completedParts) allParts.set(p.PartNumber, p);

  const pendingPartNumbers = Array.from({ length: totalParts }, (_, i) => i + 1).filter(
    (n) => !completedSet.has(n),
  );
  if (pendingPartNumbers.length === 0) {
    const completeRes = await fetch("/api/assets/upload/s3/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        key,
        storageKey,
        fileName: session.fileName,
        mimeType: session.mimeType,
        totalSize: session.totalSize,
        boardId,
        parts: status.completedParts.sort(
          (a: { PartNumber: number }, b: { PartNumber: number }) => a.PartNumber - b.PartNumber,
        ),
      }),
    });
    if (!completeRes.ok) {
      const body = await completeRes.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `S3 complete failed: ${completeRes.status}`);
    }
    await removeS3UploadSession(uploadId).catch(() => {});
    onProgress?.(100);
    return completeRes.json() as Promise<ApiAsset>;
  }

  const presignRes = await fetch("/api/assets/upload/s3/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, partNumbers: pendingPartNumbers }),
  });
  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Presign failed: ${presignRes.status}`);
  }
  const { presignedUrls } = (await presignRes.json()) as {
    presignedUrls: Record<string, string>;
  };

  onProgress?.(0);

  let done = status.completedPartNumbers.length;
  const uploadPart = async (partNumber: number) => {
    const url = presignedUrls[partNumber];
    if (!url) throw new Error(`Presigned URL for part ${partNumber} not found`);
    const start = (partNumber - 1) * S3_PART_SIZE;
    const end = Math.min(start + S3_PART_SIZE, file.size);
    const chunk = file.slice(start, end);
    const etag = await putWithProgress(url, chunk, (loaded) => {
      // loaded は 0..1。完了済み done パート + 現在パートの進捗
      const pct = (done + loaded) / totalParts;
      onProgress?.(Math.round(pct * 95));
    });
    done++;
    onProgress?.(Math.round((done / totalParts) * 95));
    allParts.set(partNumber, { PartNumber: partNumber, ETag: etag });
  };

  const partTasks = pendingPartNumbers.map((n) => () => uploadPart(n));
  const results = await runWithConcurrency(partTasks, CHUNK_CONCURRENCY);
  const rejected = results.find((r) => r.status === "rejected");
  if (rejected) throw (rejected as PromiseRejectedResult).reason;

  const parts = Array.from(allParts.values()).sort((a, b) => a.PartNumber - b.PartNumber);
  const completeRes = await fetch("/api/assets/upload/s3/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uploadId,
      key,
      storageKey,
      fileName: session.fileName,
      mimeType: session.mimeType,
      totalSize: session.totalSize,
      boardId,
      parts,
    }),
  });
  if (!completeRes.ok) {
    const body = await completeRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `S3 complete failed: ${completeRes.status}`);
  }
  await removeS3UploadSession(uploadId).catch(() => {});
  onProgress?.(100);
  return completeRes.json() as Promise<ApiAsset>;
}
