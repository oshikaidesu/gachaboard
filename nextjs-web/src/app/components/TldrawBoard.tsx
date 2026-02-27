"use client";

import { useCallback, useRef, useState } from "react";
import {
  Tldraw,
  useEditor,
  createShapeId,
  TLAssetStore,
  TLAsset,
  AssetRecordType,
  TLImageAsset,
  TLVideoAsset,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import Link from "next/link";
import { FileIconShapeUtil, FileIconShape, getFileEmoji } from "./FileIconShape";
import MediaPlayer from "./MediaPlayer";

type Props = { boardId: string; workspaceId: string };

type ApiAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: string;
};

const SHAPE_UTILS = [FileIconShapeUtil];

// TLAssetStore: tldraw が画像・動画を描画する際の URL 解決
// upload は registerExternalContentHandler 側で行うため最小実装
const ASSET_STORE: TLAssetStore = {
  async upload(_asset: TLAsset, _file: File) {
    // このパスは通らない（content handler 側でアップロード済み）
    return { src: "" };
  },
  resolve(asset: TLAsset) {
    return (asset.props as { src?: string }).src ?? null;
  },
};

// tldraw コンテキスト内で動作するインナーコンポーネント
function BoardInner({
  boardId,
  onPreview,
}: {
  boardId: string;
  onPreview: (asset: ApiAsset) => void;
}) {
  const editor = useEditor();
  const handlersRegistered = useRef(false);

  // ハンドラ登録（一度だけ）
  if (!handlersRegistered.current) {
    handlersRegistered.current = true;

    editor.registerExternalContentHandler("files", async ({ point, files }) => {
      const pagePoint = point ?? editor.getViewportPageCenter();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const mime = file.type || "application/octet-stream";
        const isImage = mime.startsWith("image/");
        const isVideo = mime.startsWith("video/");

        // サーバーにアップロード
        const fd = new FormData();
        fd.append("file", file);
        fd.append("boardId", boardId);
        const res = await fetch("/api/assets", { method: "POST", body: fd });
        if (!res.ok) continue;
        const data: ApiAsset = await res.json();

        const x = pagePoint.x + i * 110;
        const y = pagePoint.y;

        if (isImage) {
          // tldraw ネイティブの image シェイプとして配置
          const assetId = AssetRecordType.createId();
          const imageAsset: TLImageAsset = {
            id: assetId,
            typeName: "asset",
            type: "image",
            props: {
              src: `/api/assets/${data.id}/file`,
              w: 320,
              h: 240,
              name: data.fileName,
              isAnimated: mime === "image/gif",
              mimeType: mime,
              fileSize: Number(data.sizeBytes),
            },
            meta: {},
          };
          editor.createAssets([imageAsset]);
          editor.createShape({
            type: "image",
            x,
            y,
            props: { assetId, w: 320, h: 240 },
          });
        } else if (isVideo) {
          // tldraw ネイティブの video シェイプとして配置
          const assetId = AssetRecordType.createId();
          const videoAsset: TLVideoAsset = {
            id: assetId,
            typeName: "asset",
            type: "video",
            props: {
              src: `/api/assets/${data.id}/file`,
              w: 320,
              h: 240,
              name: data.fileName,
              isAnimated: true,
              mimeType: mime,
              fileSize: Number(data.sizeBytes),
            },
            meta: {},
          };
          editor.createAssets([videoAsset]);
          editor.createShape({
            type: "video",
            x,
            y,
            props: { assetId, w: 320, h: 240 },
          });
        } else {
          // その他ファイル → FileIconShape として配置
          editor.createShape<FileIconShape>({
            id: createShapeId(),
            type: "file-icon",
            x,
            y,
            props: {
              assetId: data.id,
              fileName: data.fileName,
              mimeType: data.mimeType,
              kind: data.kind,
              w: 96,
              h: 96,
            },
          });
        }
      }
    });
  }

  // FileIconShape のダブルクリックでプレビューを開く
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const container = target.closest("[data-shape-id]") as HTMLElement | null;
      if (!container) return;
      const shapeId = container.dataset.shapeId;
      if (!shapeId) return;
      const shape = editor.getShape(shapeId as ReturnType<typeof createShapeId>) as
        | FileIconShape
        | undefined;
      if (!shape || shape.type !== "file-icon") return;
      e.stopPropagation();
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
    <div className="absolute inset-0" onDoubleClick={handleDoubleClick}>
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/50 px-4 py-1.5 text-xs text-white opacity-50 select-none">
        ファイルをドロップしてアイコン配置
      </div>
    </div>
  );
}

export default function TldrawBoard({ boardId, workspaceId }: Props) {
  const [preview, setPreview] = useState<ApiAsset | null>(null);

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
          shapeUtils={SHAPE_UTILS}
          assets={ASSET_STORE}
        >
          <BoardInner boardId={boardId} onPreview={setPreview} />
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
