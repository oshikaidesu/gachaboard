"use client";

import { useCallback, useState } from "react";
import { Editor } from "@tldraw/tldraw";
import { placeFile, placeholderShape, type ApiAsset } from "@/app/shapes";

async function uploadFile(file: File, boardId: string): Promise<ApiAsset> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("boardId", boardId);
  const res = await fetch("/api/assets", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Upload failed: ${res.status}`);
  }
  return res.json() as Promise<ApiAsset>;
}

/**
 * ファイルドロップ → アップロード → キャンバス配置 のフック。
 * Editor の onMount 内で registerExternalContentHandler を呼び出す関数を返す。
 */
export function useFileDropHandler(boardId: string, userName: string) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const registerHandler = useCallback(
    (editor: Editor) => {
      editor.registerExternalContentHandler("files", async ({ point, files }) => {
        const pagePoint = point ?? editor.getViewportScreenCenter();
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const position = { x: pagePoint.x + i * 120, y: pagePoint.y };

          const placeholderId = await placeholderShape(editor, file, position, userName);

          let data: ApiAsset;
          try {
            data = await uploadFile(file, boardId);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
            setUploadError(msg);
            setTimeout(() => setUploadError(null), 5000);
            if (placeholderId) editor.deleteShapes([placeholderId]);
            continue;
          }

          if (placeholderId) editor.deleteShapes([placeholderId]);
          await placeFile(editor, file, data, position, userName);
        }
      });
    },
    [boardId, userName]
  );

  return { registerHandler, uploadError };
}
