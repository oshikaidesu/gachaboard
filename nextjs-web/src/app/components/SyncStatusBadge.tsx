"use client";

import type { RemoteTLStoreWithStatus } from "@tldraw/sync";

type Props = {
  store: RemoteTLStoreWithStatus;
  syncUrl: string;
  boardId: string;
  userId: string;
};

export function SyncStatusBadge({ store, syncUrl, boardId: _boardId, userId }: Props) {
  const status = store.status;
  const color =
    status === "synced-remote" ? "bg-green-500" :
    status === "loading" ? "bg-yellow-400" :
    status === "error" ? "bg-red-500" :
    "bg-zinc-400";
  const label =
    status === "synced-remote" ? "同期中" :
    status === "loading" ? "接続中..." :
    status === "error" ? "エラー" :
    status;

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span>{label}</span>
      <span className="text-zinc-300">|</span>
      <span className="text-zinc-400 truncate max-w-[180px]" title={syncUrl}>{syncUrl}</span>
      <span className="text-zinc-300">|</span>
      <span className="text-zinc-400">uid: {userId.slice(0, 8)}</span>
    </div>
  );
}
