"use client";

import { useState, useCallback } from "react";
import {
  Tldraw,
  Editor,
  StateNode,
  TLClickEventInfo,
  TLRecord,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import Link from "next/link";
import { CUSTOM_SHAPE_UTILS, placeFile, type ApiAsset, getFileEmoji, type FileIconShape } from "@/app/shapes";
import MediaPlayer from "./MediaPlayer";
import { ConnectHandles } from "./ConnectHandles";

type Props = { boardId: string; workspaceId: string };

async function uploadFile(file: File, boardId: string): Promise<ApiAsset> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("boardId", boardId);
  const res = await fetch("/api/assets", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}

export default function TldrawBoard({ boardId, workspaceId }: Props) {
  const [preview, setPreview] = useState<ApiAsset | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleMount = useCallback(
    (editor: Editor) => {
      // ファイルドロップ → shapes/index.ts の placeFile() に委譲
      editor.registerExternalContentHandler("files", async ({ point, files }) => {
        const pagePoint = point ?? editor.getViewportPageCenter();
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          let data: ApiAsset;
          try {
            data = await uploadFile(file, boardId);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
            setUploadError(msg);
            setTimeout(() => setUploadError(null), 5000);
            continue;
          }
          await placeFile(editor, file, data, {
            x: pagePoint.x + i * 120,
            y: pagePoint.y,
          });
        }
      });

      // シェイプ削除時に紐づくアローを連鎖削除する
      editor.store.listen(
        (entry) => {
          // 今回の操作で削除されたシェイプ ID を収集
          const removedIds = new Set(
            Object.values(entry.changes.removed)
              .filter((r): r is TLRecord & { typeName: "shape" } => r.typeName === "shape")
              .map((r) => r.id)
          );
          if (removedIds.size === 0) return;

          // 削除シェイプにバインドされているアローを探して削除
          const toDelete = editor
            .getCurrentPageShapes()
            .filter((s) => s.type === "arrow")
            .filter((arrow) =>
              editor
                .getBindingsFromShape(arrow.id, "arrow")
                .some((b) => removedIds.has(b.toId))
            )
            .map((arrow) => arrow.id);

          if (toDelete.length > 0) {
            editor.deleteShapes(toDelete);
          }
        },
        { source: "user", scope: "document" }
      );

      // FileIconShape のダブルクリックでプレビューモーダルを開く
      type IdleStateNode = StateNode & {
        onDoubleClick: (info: TLClickEventInfo) => void;
      };
      const selectIdleState = editor.getStateDescendant<IdleStateNode>("select.idle");
      if (selectIdleState) {
        const originalOnDoubleClick = selectIdleState.onDoubleClick?.bind(selectIdleState);
        selectIdleState.onDoubleClick = function (info) {
          if (info.phase !== "up") {
            originalOnDoubleClick?.(info);
            return;
          }
          if (info.target === "shape") {
            const shape = info.shape as FileIconShape;
            if (shape.type === "file-icon") {
              setPreview({
                id: shape.props.assetId,
                fileName: shape.props.fileName,
                mimeType: shape.props.mimeType,
                kind: shape.props.kind,
                sizeBytes: "0",
              });
              return;
            }
          }
          originalOnDoubleClick?.(info);
        };
      }
    },
    [boardId]
  );

  return (
    <div className="flex h-screen flex-col">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 z-10">
        <Link href="javascript:history.back()" className="text-xs text-zinc-500 hover:underline">
          ← 戻る
        </Link>
        <span className="text-xs text-zinc-400">Board: {boardId}</span>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="ml-auto rounded border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50"
        >
          URLをコピー
        </button>
      </div>

      {/* キャンバス */}
      <div className="flex-1 relative">
        <Tldraw
          persistenceKey={`board-${boardId}`}
          shapeUtils={CUSTOM_SHAPE_UTILS}
          onMount={handleMount}
        >
          {/* draw.io ライクな接続ハンドル: Tldraw children = editor コンテキスト内 */}
          <ConnectHandles />

          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/50 px-4 py-1.5 text-xs text-white opacity-50 select-none">
            ファイルをドロップして配置
          </div>
        </Tldraw>
      </div>

      {/* アップロードエラートースト */}
      {uploadError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-red-600 px-5 py-3 text-sm text-white shadow-lg">
          {uploadError}
        </div>
      )}

      {/* FileIconShape ダブルクリック時のプレビューモーダル */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-medium truncate">{preview.fileName}</p>

            {preview.kind === "image" || preview.kind === "gif" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/assets/${preview.id}/file`}
                alt={preview.fileName}
                className="max-h-[60vh] w-full object-contain rounded"
              />
            ) : preview.kind === "video" || preview.kind === "audio" ? (
              <MediaPlayer
                assetId={preview.id}
                mimeType={preview.mimeType}
                fileName={preview.fileName}
                workspaceId={workspaceId}
                isConverted={preview.mimeType === "audio/wav"}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                <span className="text-6xl">{getFileEmoji(preview.fileName, preview.kind)}</span>
                <p className="text-sm text-zinc-500">プレビューできないファイルです</p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <a
                href={`/api/assets/${preview.id}/file`}
                download={preview.fileName}
                className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                ダウンロード
              </a>
              <button
                onClick={() => setPreview(null)}
                className="rounded border border-zinc-200 px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
