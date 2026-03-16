"use client";

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

/**
 * ファイルドロップ → アップロード → キャンバス配置 のフック。
 *
 * 共通処理（@/lib/uploadCommon 参照）:
 * - processFiles: アップロードボタン・DD 両方から利用
 * - uploadAndPlace: placeholderShape → uploadFileViaS3 → placeFile
 * - MIME 解決・送信%表示は s3Upload / shapes で統一
 */
export function useFileDropHandler(
  boardId: string,
  userName: string,
  avatarUrl?: string | null
) {
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
    return { x: cx - 60, y: cy - 60 };
  }, []);

  useEffect(() => {
    refreshResumable();
  }, [refreshResumable]);

  const uploadAndPlace = useCallback(
    async (
      editor: Editor,
      file: File,
      position: { x: number; y: number },
      handle: FileSystemFileHandle | null,
      onError: (msg: string) => void,
    ): Promise<void> => {
      const placeholderId = await placeholderShape(
        editor,
        file,
        position,
        userName,
        avatarUrl ?? null
      );
      const updateProgress = (pct: number) => {
        if (placeholderId) {
          const existing = editor.getShape(placeholderId as TLShapeId);
          if (existing) {
            editor.updateShape({
              id: placeholderId as TLShapeId,
              type: existing.type,
              meta: { ...existing.meta, uploadProgress: pct },
            });
          }
        }
      };

      let data: ApiAsset;
      try {
        data = await uploadFileViaS3(file, boardId, updateProgress, handle);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
        onError(msg);
        if (placeholderId) editor.deleteShapes([placeholderId]);
        return;
      }

      await placeFile(
        editor,
        file,
        data,
        position,
        userName,
        placeholderId ?? undefined,
        avatarUrl ?? null
      );
    },
    [boardId, userName, avatarUrl],
  );

  const showError = useCallback((msg: string) => {
    setUploadError(msg);
    setTimeout(() => setUploadError(null), 5000);
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
      const { openFileWithHandle } = await import("@/lib/fileAccess");
      const result = await openFileWithHandle();
      if (!result.ok) {
        showError(result.error);
        return;
      }
      await processFiles(editor, [result.file], {
        handles: [result.handle],
      });
    },
    [processFiles, showError],
  );

  const openAllFilesPickerAndUpload = useCallback(
    async () => {
      const editor = editorRef.current;
      if (!editor) return;
      const { openAllFilesPicker } = await import("@/lib/fileAccess");
      const result = await openAllFilesPicker();
      if (!result.ok) {
        if (result.error !== "キャンセルされました") showError(result.error);
        return;
      }
      await processFiles(editor, result.files, {
        handles: result.handles,
      });
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
      const placeholderId = await placeholderShape(
        editor,
        file,
        position,
        userName,
        avatarUrl ?? null
      );

      const updateProgress = (pct: number) => {
        if (placeholderId) {
          const existing = editor.getShape(placeholderId as TLShapeId);
          if (existing) {
            editor.updateShape({
              id: placeholderId as TLShapeId,
              type: existing.type,
              meta: { ...existing.meta, uploadProgress: pct },
            });
          }
        }
      };

      try {
        const data = await uploadFileViaS3Resume(session, file, updateProgress);
        await placeFile(
          editor,
          file,
          data,
          position,
          userName,
          placeholderId ?? undefined,
          avatarUrl ?? null
        );
        setResumableUploads((prev) => prev.filter((s) => s.uploadId !== session.uploadId));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "再開に失敗しました";
        showError(msg);
        if (placeholderId) editor.deleteShapes([placeholderId]);
      }
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
