"use client";

import MediaPlayer from "./MediaPlayer";
import { getFileEmoji } from "@/app/shapes";
import type { ApiAsset } from "@shared/apiTypes";

type Props = {
  asset: ApiAsset;
  workspaceId: string;
  onClose: () => void;
};

/**
 * FileIconShape のダブルクリック時に表示するプレビューモーダル。
 */
export function PreviewModal({ asset, workspaceId, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-sm font-medium truncate">{asset.fileName}</p>

        {asset.kind === "image" || asset.kind === "gif" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/assets/${asset.id}/file`}
            alt={asset.fileName}
            className="max-h-[60vh] w-full object-contain rounded"
          />
        ) : asset.kind === "video" || asset.kind === "audio" ? (
          <MediaPlayer
            assetId={asset.id}
            mimeType={asset.mimeType}
            fileName={asset.fileName}
            workspaceId={workspaceId}
            isConverted={asset.mimeType === "audio/wav"}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <span className="text-6xl">{getFileEmoji(asset.fileName, asset.kind)}</span>
            <p className="text-sm text-zinc-500">プレビューできないファイルです</p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <a
            href={`/api/assets/${asset.id}/file`}
            download={asset.fileName}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
          >
            ダウンロード
          </a>
          <button
            onClick={onClose}
            className="rounded border border-zinc-200 px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
