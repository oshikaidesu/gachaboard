"use client";

import Link from "next/link";
import { TwemojiImg } from "@/app/components/ui/Twemoji";
import { formatFileSize } from "@shared/utils";
import { getFileEmoji } from "@/app/shapes";

export type Asset = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: string;
  deletedAt: string | null;
  createdAt: string;
  uploader: { name: string | null; image: string | null };
  board?: { id: string; name: string } | null;
};

type Props = {
  asset: Asset;
  tab: "active" | "trash";
  onPreview: (asset: Asset) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDeletePermanently: (id: string, name: string) => void;
};

function isMedia(a: Asset) {
  return (
    a.kind === "image" ||
    a.kind === "video" ||
    a.kind === "audio" ||
    a.kind === "gif"
  );
}

export function AssetListItem({
  asset,
  tab,
  onPreview,
  onTrash,
  onRestore,
  onDeletePermanently,
}: Props) {
  const media = isMedia(asset);

  return (
    <li
      className={`flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50 ${
        tab === "trash" ? "opacity-60" : ""
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-700 ${
          media ? "cursor-pointer" : ""
        }`}
        onClick={() => media && onPreview(asset)}
      >
        {asset.kind === "image" || asset.kind === "gif" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/assets/${asset.id}/file`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : asset.kind === "video" ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/assets/${asset.id}/thumbnail`}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
            <span className="hidden">
              <TwemojiImg emoji={getFileEmoji(asset.fileName, asset.kind)} size={24} />
            </span>
          </>
        ) : (
          <TwemojiImg emoji={getFileEmoji(asset.fileName, asset.kind)} size={24} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium dark:text-slate-200 ${
            media ? "cursor-pointer hover:underline" : ""
          }`}
          title={asset.fileName}
          onClick={() => media && onPreview(asset)}
        >
          {asset.fileName}
        </p>
        <p className="text-xs text-zinc-400 dark:text-slate-500">
          {formatFileSize(asset.sizeBytes)} · {asset.uploader.name}
          {asset.board && (
            <>
              {" · "}
              <Link
                href={`/board/${asset.board.id}`}
                className="hover:underline"
              >
                {asset.board.name}
              </Link>
            </>
          )}
          {asset.board === null && " · 未配置"}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {tab === "active" && (
          <a
            href={`/api/assets/${asset.id}/file?download=1`}
            download={asset.fileName}
            className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            DL
          </a>
        )}
        {tab === "active" ? (
          <button
            onClick={() => onTrash(asset.id)}
            className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:border-slate-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
          >
            ゴミ箱へ
          </button>
        ) : (
          <>
            <button
              onClick={() => onRestore(asset.id)}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-green-50 hover:text-green-600 dark:border-slate-600 dark:hover:bg-green-950/50 dark:hover:text-green-400"
            >
              復元
            </button>
            <button
              onClick={() => onDeletePermanently(asset.id, asset.fileName)}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:hover:bg-red-950/50 dark:hover:text-red-300"
            >
              完全削除
            </button>
          </>
        )}
      </div>
    </li>
  );
}
