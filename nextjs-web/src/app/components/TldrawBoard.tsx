"use client";

import { useCallback, useRef, useState } from "react";
import { Tldraw, useEditor, TLShapeId, createShapeId } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import Link from "next/link";
import { FileIconShapeUtil, FileIconShape, getFileEmoji } from "./FileIconShape";
import MediaPlayer from "./MediaPlayer";

type Props = { boardId: string; workspaceId: string };

type AssetRecord = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: string;
};

const SHAPE_UTILS = [FileIconShapeUtil];

// ドロップ座標→シェイプ配置を担うインナーコンポーネント（editorフックが使える）
function BoardInner({
  boardId,
  workspaceId,
  onPreview,
}: {
  boardId: string;
  workspaceId: string;
  onPreview: (asset: AssetRecord) => void;
}) {
  const editor = useEditor();

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) => f.size > 0);
      if (files.length === 0) return;

      // ドロップ座標をキャンバス座標に変換
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const canvasPoint = editor.screenToPage({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append("file", file);
        fd.append("workspaceId", workspaceId);
        fd.append("boardId", boardId);

        const res = await fetch("/api/assets", { method: "POST", body: fd });
        if (!res.ok) continue;
        const asset: AssetRecord = await res.json();

        const shapeId: TLShapeId = createShapeId();
        editor.createShape<FileIconShape>({
          id: shapeId,
          type: "file-icon",
          x: canvasPoint.x + i * 110,
          y: canvasPoint.y,
          props: {
            assetId: asset.id,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            kind: asset.kind,
            w: 96,
            h: 96,
          },
        });
      }
    },
    [editor, boardId, workspaceId]
  );

  // シェイプダブルクリックでプレビュー
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const container = target.closest("[data-shape-id]") as HTMLElement | null;
      if (!container) return;
      const shapeId = container.dataset.shapeId as TLShapeId;
      const shape = editor.getShape(shapeId) as FileIconShape | undefined;
      if (!shape || shape.type !== "file-icon") return;
      onPreview({
        id: shape.props.assetId,
        fileName: shape.props.fileName,
        mimeType: shape.props.mimeType,
        kind: shape.props.kind,
        sizeBytes: "0",
      });
    },
    [editor, onPreview]
  );

  return (
    <div
      className="flex-1 relative"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onDoubleClick={handleDoubleClick}
    >
      {/* ドロップヒント */}
      <div
        className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10
          rounded-full bg-black/50 px-4 py-1.5 text-xs text-white opacity-60"
      >
        ファイルをここにドロップしてアイコン配置
      </div>
    </div>
  );
}

export default function TldrawBoard({ boardId, workspaceId }: Props) {
  const [preview, setPreview] = useState<AssetRecord | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      <div ref={containerRef} className="flex-1 relative">
        <Tldraw
          persistenceKey={`board-${boardId}`}
          shapeUtils={SHAPE_UTILS}
          onMount={(editor) => {
            // tldraw自身のドロップを無効化（独自処理に置き換え）
            editor.updateInstanceState({ isReadonly: false });
          }}
        >
          <BoardInner
            boardId={boardId}
            workspaceId={workspaceId}
            onPreview={setPreview}
          />
        </Tldraw>
      </div>

      {/* プレビューモーダル */}
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
