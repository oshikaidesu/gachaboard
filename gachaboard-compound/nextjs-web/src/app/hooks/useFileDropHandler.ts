"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import type { Editor } from "@cmpd/compound";
import { placeFile, placeholderShape, type ApiAsset } from "@/app/shapes";
import type { TLShapeId } from "@cmpd/compound";
import {
  saveS3UploadSession,
  removeS3UploadSession,
  listResumableS3Uploads,
  type StoredSession,
} from "@/lib/s3UploadSessionStore";

const MAX_CONCURRENT = 4;

/** 250MB 以上のファイルはチャンク送信に切り替える */
const CHUNK_THRESHOLD = 250 * 1024 * 1024;
/** チャンク1本あたりのサイズ（250MB）。nginx の client_max_body_size 256m に収まる値 */
const CHUNK_SIZE = 250 * 1024 * 1024;
/** チャンクアップロードの並列数（Ryzen 7 3D + AE 併用時に CPU 負荷を抑える） */
const CHUNK_CONCURRENCY = 4;

const S3_PART_SIZE = 100 * 1024 * 1024; // 100MB

async function uploadFile(
  file: File,
  boardId: string,
  onProgress?: (pct: number) => void,
  handle?: FileSystemFileHandle | null,
): Promise<ApiAsset> {
  const s3Result = await uploadFileViaS3(file, boardId, onProgress, handle);
  if (s3Result) return s3Result;
  if (file.size >= CHUNK_THRESHOLD) {
    return uploadFileInChunks(file, boardId, onProgress);
  }
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("boardId", boardId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/assets");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Invalid response")); }
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).error ?? `Upload failed: ${xhr.status}`)); }
        catch { reject(new Error(`Upload failed: ${xhr.status}`)); }
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(fd);
  });
}

async function uploadFileViaS3(
  file: File,
  boardId: string,
  onProgress?: (pct: number) => void,
  handle?: FileSystemFileHandle | null,
): Promise<ApiAsset | null> {
  const initRes = await fetch("/api/assets/upload/s3/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      totalSize: file.size,
      boardId,
    }),
  });
  if (initRes.status === 503) return null;
  if (!initRes.ok) {
    const body = await initRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `S3 init failed: ${initRes.status}`);
  }
  const init = await initRes.json() as {
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
      mimeType: file.type || "application/octet-stream",
      totalSize: file.size,
      totalParts,
      boardId,
      handle,
      createdAt: Date.now(),
    });
  }

  const parts: { PartNumber: number; ETag: string }[] = [];
  let done = 0;

  const uploadPart = async (partNumber: number) => {
    const start = (partNumber - 1) * S3_PART_SIZE;
    const end = Math.min(start + S3_PART_SIZE, file.size);
    const chunk = file.slice(start, end);
    const url = presignedUrls[partNumber - 1];
    const res = await fetch(url, { method: "PUT", body: chunk });
    if (!res.ok) throw new Error(`Part ${partNumber} failed: ${res.status}`);
    const etag = res.headers.get("etag");
    if (!etag) throw new Error(`Part ${partNumber}: no ETag`);
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
      mimeType: file.type || "application/octet-stream",
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

async function uploadFileViaS3Resume(
  session: StoredSession,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ApiAsset> {
  const { uploadId, key, storageKey, totalParts, boardId } = session;
  if (file.size !== session.totalSize || file.name !== session.fileName) {
    throw new Error("ファイルが一致しません。同じファイルを選択してください。");
  }

  const statusRes = await fetch(`/api/assets/upload/s3/status?uploadId=${encodeURIComponent(uploadId)}`);
  if (!statusRes.ok) {
    const body = await statusRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Status failed: ${statusRes.status}`);
  }
  const status = await statusRes.json() as {
    completedPartNumbers: number[];
    completedParts: { PartNumber: number; ETag: string }[];
  };
  const completedSet = new Set(status.completedPartNumbers);
  const allParts = new Map<number, { PartNumber: number; ETag: string }>();
  for (const p of status.completedParts) allParts.set(p.PartNumber, p);

  const pendingPartNumbers = Array.from({ length: totalParts }, (_, i) => i + 1).filter((n) => !completedSet.has(n));
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
        parts: status.completedParts.sort((a: { PartNumber: number }, b: { PartNumber: number }) => a.PartNumber - b.PartNumber),
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
  const { presignedUrls } = await presignRes.json() as { presignedUrls: Record<string, string> };

  let done = status.completedPartNumbers.length;
  const uploadPart = async (partNumber: number) => {
    const url = presignedUrls[partNumber];
    if (!url) throw new Error(`Presigned URL for part ${partNumber} not found`);
    const start = (partNumber - 1) * S3_PART_SIZE;
    const end = Math.min(start + S3_PART_SIZE, file.size);
    const chunk = file.slice(start, end);
    const res = await fetch(url, { method: "PUT", body: chunk });
    if (!res.ok) throw new Error(`Part ${partNumber} failed: ${res.status}`);
    const etag = res.headers.get("etag");
    if (!etag) throw new Error(`Part ${partNumber}: no ETag`);
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

const UPLOAD_SESSION_KEY = "uploadSession";

function getUploadSessionKey(file: File, totalChunks: number): string {
  return `${UPLOAD_SESSION_KEY}:${file.name}:${file.size}:${totalChunks}`;
}

async function uploadFileInChunks(
  file: File,
  boardId: string,
  onProgress?: (pct: number) => void,
): Promise<ApiAsset> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const sessionKey = getUploadSessionKey(file, totalChunks);

  let uploadId: string | null = null;
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(sessionKey);
    if (stored) {
      try {
        const { uploadId: id } = JSON.parse(stored) as { uploadId: string };
        const statusRes = await fetch(`/api/assets/upload/${id}/status`);
        if (statusRes.ok) {
          const { completedChunks: list } = await statusRes.json() as { completedChunks?: number[] };
          if (list && list.length > 0) {
            uploadId = id;
          }
        }
      } catch {
        // 復元失敗時は新規セッション
      }
    }
  }

  if (!uploadId) {
    const initRes = await fetch("/api/assets/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        totalSize: file.size,
        boardId,
      }),
    });
    if (!initRes.ok) {
      const body = await initRes.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Init failed: ${initRes.status}`);
    }
    const body = await initRes.json() as { uploadId: string };
    uploadId = body.uploadId;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(sessionKey, JSON.stringify({ uploadId }));
    }
  }

  const fetchStatus = async (): Promise<number[]> => {
    const statusRes = await fetch(`/api/assets/upload/${uploadId!}/status`);
    if (!statusRes.ok) return [];
    const { completedChunks: list } = await statusRes.json() as { completedChunks?: number[] };
    return list ?? [];
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const completedChunks = await fetchStatus();
    const completedSet = new Set(completedChunks);
    const pendingIndices = Array.from({ length: totalChunks }, (_, i) => i).filter((i) => !completedSet.has(i));

    if (pendingIndices.length === 0) break;

    let uploadedInThisRun = 0;
    const chunkTasks = pendingIndices.map((i) => async () => {
      const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const res = await fetch(`/api/assets/upload/${uploadId!}/${i}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Chunk ${i} failed: ${res.status}`);
      }
      uploadedInThisRun++;
      onProgress?.(Math.round(((completedChunks.length + uploadedInThisRun) / totalChunks) * 95));
    });

    const results = await runWithConcurrency(chunkTasks, CHUNK_CONCURRENCY);
    const rejected = results.find((r) => r.status === "rejected");
    if (!rejected) break;
    lastError = (rejected as PromiseRejectedResult).reason;
    if (attempt === 2) throw lastError;
  }

  const completeRes = await fetch(`/api/assets/upload/${uploadId!}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ totalChunks }),
  });
  if (!completeRes.ok) {
    const body = await completeRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Complete failed: ${completeRes.status}`);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(sessionKey);
  }
  onProgress?.(100);
  return completeRes.json() as Promise<ApiAsset>;
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      try {
        results[idx] = { status: "fulfilled", value: await tasks[idx]() };
      } catch (e) {
        results[idx] = { status: "rejected", reason: e };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

/**
 * ファイルドロップ → アップロード → キャンバス配置 のフック。
 * すべてのファイルタイプを統一フローで処理する。
 * 250MB 以上の S3 アップロードでは File System Access API でハンドルを保存し再開可能にする。
 */
export function useFileDropHandler(boardId: string, userName: string) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [resumableUploads, setResumableUploads] = useState<StoredSession[]>([]);
  const editorRef = useRef<Editor | null>(null);

  const refreshResumable = useCallback(() => {
    listResumableS3Uploads()
      .then((list) => setResumableUploads(list.filter((s) => s.boardId === boardId)))
      .catch(() => setResumableUploads([]));
  }, [boardId]);

  const getViewportPageCenter = useCallback((editor: Editor) => {
    const vp = editor.getViewportPageBounds();
    const cx = vp.x + vp.w / 2;
    const cy = vp.y + vp.h / 2;
    return { x: cx - 60, y: cy - 60 }; // 約120x120の中央配置
  }, []);

  useEffect(() => {
    refreshResumable();
  }, [refreshResumable]);

  const registerHandler = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      editor.registerExternalContentHandler("files", async ({ point, files }) => {
        const pagePoint = point ?? getViewportPageCenter(editor);

        const tasks = files.map((file, i) => async () => {
          const position = { x: pagePoint.x + i * 120, y: pagePoint.y };
          const placeholderId = await placeholderShape(editor, file, position, userName);

          const updateProgress = (pct: number) => {
            if (placeholderId) {
              const existing = editor.getShape(placeholderId as TLShapeId);
              if (existing) {
                editor.updateShape({ id: placeholderId as TLShapeId, type: existing.type, meta: { ...existing.meta, uploadProgress: pct } });
              }
            }
          };

          let data: ApiAsset;
          try {
            data = await uploadFile(file, boardId, updateProgress, null);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
            setUploadError(msg);
            setTimeout(() => setUploadError(null), 5000);
            if (placeholderId) editor.deleteShapes([placeholderId]);
            refreshResumable();
            return;
          }

          await placeFile(editor, file, data, position, userName, placeholderId ?? undefined);
          refreshResumable();
        });

        await runWithConcurrency(tasks, MAX_CONCURRENT);
      });
    },
    [boardId, userName, refreshResumable, getViewportPageCenter]
  );

  const openFilePickerAndUpload = useCallback(
    async () => {
      const editor = editorRef.current;
      if (!editor) return;
      const { openFileWithHandle } = await import("@/lib/fileAccess");
      const result = await openFileWithHandle();
      if (!result.ok) {
        setUploadError(result.error);
        setTimeout(() => setUploadError(null), 5000);
        return;
      }
      const { file, handle } = result;
      const position = getViewportPageCenter(editor);
      const placeholderId = await placeholderShape(editor, file, position, userName);

      const updateProgress = (pct: number) => {
        if (placeholderId) {
          const existing = editor.getShape(placeholderId as TLShapeId);
          if (existing) {
            editor.updateShape({ id: placeholderId as TLShapeId, type: existing.type, meta: { ...existing.meta, uploadProgress: pct } });
          }
        }
      };

      try {
        const data = await uploadFile(file, boardId, updateProgress, handle);
        await placeFile(editor, file, data, position, userName, placeholderId ?? undefined);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
        setUploadError(msg);
        setTimeout(() => setUploadError(null), 5000);
        if (placeholderId) editor.deleteShapes([placeholderId]);
      }
      refreshResumable();
    },
    [boardId, userName, refreshResumable, getViewportPageCenter]
  );

  const openAllFilesPickerAndUpload = useCallback(
    async () => {
      const editor = editorRef.current;
      if (!editor) return;
      const { openAllFilesPicker } = await import("@/lib/fileAccess");
      const result = await openAllFilesPicker();
      if (!result.ok) {
        if (result.error !== "キャンセルされました") {
          setUploadError(result.error);
          setTimeout(() => setUploadError(null), 5000);
        }
        return;
      }
      const { files, handles } = result;
      const center = getViewportPageCenter(editor);

      const tasks = files.map((file, i) => async () => {
        const position = { x: center.x + i * 120, y: center.y };
        const placeholderId = await placeholderShape(editor, file, position, userName);

        const updateProgress = (pct: number) => {
          if (placeholderId) {
            const existing = editor.getShape(placeholderId as TLShapeId);
            if (existing) {
              editor.updateShape({ id: placeholderId as TLShapeId, type: existing.type, meta: { ...existing.meta, uploadProgress: pct } });
            }
          }
        };

        let data: ApiAsset;
        try {
          data = await uploadFile(file, boardId, updateProgress, handles[i] ?? null);
          await placeFile(editor, file, data, position, userName, placeholderId ?? undefined);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
          setUploadError(msg);
          setTimeout(() => setUploadError(null), 5000);
          if (placeholderId) editor.deleteShapes([placeholderId]);
        }
        refreshResumable();
      });

      await runWithConcurrency(tasks, MAX_CONCURRENT);
    },
    [boardId, userName, refreshResumable, getViewportPageCenter]
  );

  const resumeUpload = useCallback(
    async (session: StoredSession) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (!session.handle) {
        setUploadError("このアップロードは再開できません（ハンドルなし）");
        setTimeout(() => setUploadError(null), 5000);
        return;
      }
      const file = await session.handle.getFile();
      const position = getViewportPageCenter(editor);
      const placeholderId = await placeholderShape(editor, file, position, userName);

      const updateProgress = (pct: number) => {
        if (placeholderId) {
          const existing = editor.getShape(placeholderId as TLShapeId);
          if (existing) {
            editor.updateShape({ id: placeholderId as TLShapeId, type: existing.type, meta: { ...existing.meta, uploadProgress: pct } });
          }
        }
      };

      try {
        const data = await uploadFileViaS3Resume(session, file, updateProgress);
        await placeFile(editor, file, data, position, userName, placeholderId ?? undefined);
        setResumableUploads((prev) => prev.filter((s) => s.uploadId !== session.uploadId));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "再開に失敗しました";
        setUploadError(msg);
        setTimeout(() => setUploadError(null), 5000);
        if (placeholderId) editor.deleteShapes([placeholderId]);
      }
      refreshResumable();
    },
    [editorRef, userName, refreshResumable, getViewportPageCenter]
  );

  return {
    registerHandler,
    uploadError,
    resumableUploads,
    refreshResumable,
    openFilePickerAndUpload,
    openAllFilesPickerAndUpload,
    resumeUpload,
    isFileSystemAccessSupported: typeof window !== "undefined" && "showOpenFilePicker" in window,
  };
}
