"use client";

/**
 * 責務:
 * 1) ドロップ・ファイルピッカー: registerHandler / openFilePickerAndUpload / openAllFilesPickerAndUpload
 * 2) アップロードオーケストレーション: placeholderShape → S3 アップロード → placeFile（processFiles / resumeUpload）
 */

import { useCallback, useState, useEffect, useRef } from "react";
import type { Editor } from "@cmpd/compound";
import { placeFile, placeholderShape } from "@/app/shapes";
import type { TLShapeId } from "@cmpd/compound";
import type { ApiAsset } from "@shared/apiTypes";
import {
  listResumableS3Uploads,
  type StoredSession,
} from "@/lib/s3UploadSessionStore";
import {
  uploadFileViaS3,
  uploadFileViaS3Resume,
  runWithConcurrency,
} from "@/lib/s3Upload";

const MAX_CONCURRENT = 4;

/** 1 ファイル分: プレースホルダー表示 → アップロード実行 → 配置。成功で true、失敗で false。 */
async function executeSingleFileUpload(
  editor: Editor,
  file: File,
  position: { x: number; y: number },
  meta: { userName: string; avatarUrl: string | null },
  uploadFn: (onProgress: (pct: number) => void) => Promise<ApiAsset>,
  onError: (msg: string) => void,
): Promise<boolean> {
  const placeholderId = await placeholderShape(
    editor,
    file,
    position,
    meta.userName,
    meta.avatarUrl,
  );
  const updateProgress = (pct: number) => {
    if (!placeholderId) return;
    const existing = editor.getShape(placeholderId as TLShapeId);
    if (existing) {
      editor.updateShape({
        id: placeholderId as TLShapeId,
        type: existing.type,
        meta: { ...existing.meta, uploadProgress: pct },
      });
    }
  };

  let data: ApiAsset;
  try {
    data = await uploadFn(updateProgress);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
    onError(msg);
    if (placeholderId) editor.deleteShapes([placeholderId]);
    return false;
  }

  await placeFile(
    editor,
    file,
    data,
    position,
    meta.userName,
    placeholderId ?? undefined,
    meta.avatarUrl,
  );
  return true;
}

/**
 * ファイルドロップ → アップロード → キャンバス配置 のフック。
 * processFiles: アップロードボタン・DD 両方から利用。MIME 解決・送信%は s3Upload / shapes で統一。
 */
export function useFileDropHandler(
  boardId: string,
  userName: string,
  avatarUrl?: string | null
) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [resumableUploads, setResumableUploads] = useState<StoredSession[]>([]);
  const editorRef = useRef<Editor | null>(null);
  const errorClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filePickerActiveRef = useRef(false);

  const refreshResumable = useCallback(() => {
    listResumableS3Uploads()
      .then((list) => setResumableUploads(list.filter((s) => s.boardId === boardId)))
      .catch(() => setResumableUploads([]));
  }, [boardId]);

  const getViewportPageCenter = useCallback((editor: Editor) => {
    const vp = editor.getViewportPageBounds();
    const cx = vp.x + vp.w / 2;
    const cy = vp.y + vp.h / 2;
    return { x: cx - 60, y: cy - 60 };
  }, []);

  useEffect(() => {
    refreshResumable();
  }, [refreshResumable]);

  const meta = { userName, avatarUrl: avatarUrl ?? null };

  const uploadAndPlace = useCallback(
    async (
      editor: Editor,
      file: File,
      position: { x: number; y: number },
      handle: FileSystemFileHandle | null,
      onError: (msg: string) => void,
    ): Promise<void> => {
      await executeSingleFileUpload(
        editor,
        file,
        position,
        meta,
        (onProgress) => uploadFileViaS3(file, boardId, onProgress, handle),
        onError,
      );
    },
    [boardId, userName, avatarUrl],
  );

  const showError = useCallback((msg: string) => {
    if (errorClearTimerRef.current) clearTimeout(errorClearTimerRef.current);
    setUploadError(msg);
    errorClearTimerRef.current = setTimeout(() => {
      errorClearTimerRef.current = null;
      setUploadError(null);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (errorClearTimerRef.current) {
        clearTimeout(errorClearTimerRef.current);
        errorClearTimerRef.current = null;
      }
    };
  }, []);

  /**
   * 共有処理: ファイル配列のアップロード + 配置。
   * ドラッグ&ドロップ・アップロードボタン両方から利用。
   */
  const processFiles = useCallback(
    async (
      editor: Editor,
      files: File[],
      options: {
        basePoint?: { x: number; y: number };
        handles?: (FileSystemFileHandle | null)[];
      } = {}
    ) => {
      const pagePoint = options.basePoint ?? getViewportPageCenter(editor);

      const tasks = files.map((file, i) => async () => {
        const position = { x: pagePoint.x + i * 120, y: pagePoint.y };
        const handle = options.handles?.[i] ?? null;
        await uploadAndPlace(editor, file, position, handle, showError);
        refreshResumable();
      });

      await runWithConcurrency(tasks, MAX_CONCURRENT);
    },
    [getViewportPageCenter, uploadAndPlace, showError, refreshResumable],
  );

  const registerHandler = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      editor.registerExternalContentHandler("files", async ({ point, files }) => {
        await processFiles(editor, files, { basePoint: point ?? undefined });
      });
    },
    [processFiles],
  );

  const openFilePickerAndUpload = useCallback(
    async () => {
      const editor = editorRef.current;
      if (!editor) return;
      if (filePickerActiveRef.current) return;
      filePickerActiveRef.current = true;
      try {
        const { openFileWithHandle } = await import("@/lib/fileAccess");
        const result = await openFileWithHandle();
        if (!result.ok) {
          if (result.error !== "キャンセルされました") showError(result.error);
          return;
        }
        await processFiles(editor, [result.file], {
          handles: [result.handle],
        });
      } finally {
        filePickerActiveRef.current = false;
      }
    },
    [processFiles, showError],
  );

  const openAllFilesPickerAndUpload = useCallback(
    async () => {
      const editor = editorRef.current;
      if (!editor) return;
      if (filePickerActiveRef.current) return;
      filePickerActiveRef.current = true;
      try {
        const { openAllFilesPicker } = await import("@/lib/fileAccess");
        const result = await openAllFilesPicker();
        if (!result.ok) {
          if (result.error !== "キャンセルされました") showError(result.error);
          return;
        }
        await processFiles(editor, result.files, {
          handles: result.handles,
        });
      } finally {
        filePickerActiveRef.current = false;
      }
    },
    [processFiles, showError],
  );

  const resumeUpload = useCallback(
    async (session: StoredSession) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (!session.handle) {
        showError("このアップロードは再開できません（ハンドルなし）");
        return;
      }
      const file = await session.handle.getFile();
      const position = getViewportPageCenter(editor);
      const ok = await executeSingleFileUpload(
        editor,
        file,
        position,
        meta,
        (onProgress) => uploadFileViaS3Resume(session, file, onProgress),
        (msg) => {
          showError(msg);
          refreshResumable();
        },
      );
      if (ok) setResumableUploads((prev) => prev.filter((s) => s.uploadId !== session.uploadId));
      refreshResumable();
    },
    [userName, avatarUrl, getViewportPageCenter, showError, refreshResumable],
  );

  return {
    registerHandler,
    uploadError,
    resumableUploads,
    refreshResumable,
    openFilePickerAndUpload,
    openAllFilesPickerAndUpload,
    resumeUpload,
    isFileSystemAccessSupported:
      typeof window !== "undefined" && "showOpenFilePicker" in window,
  };
}
