"use client";

import MediaPlayer from "@/app/components/ui/MediaPlayer";

export type AssetForPreview = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
};

type Props = {
  asset: AssetForPreview;
  workspaceId: string;
  onClose: () => void;
};

export function AssetPreviewModal({ asset, workspaceId, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:border dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {asset.kind === "image" || asset.kind === "gif" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/assets/${asset.id}/file`}
            alt={asset.fileName}
            className="max-h-[70vh] w-full object-contain rounded"
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
          <p className="text-sm text-zinc-500 dark:text-slate-400">
            プレビューできないファイルです。
          </p>
        )}
        <button
          onClick={onClose}
          className="mt-4 text-sm text-zinc-400 hover:text-zinc-600 dark:text-slate-400 dark:hover:text-slate-300"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
