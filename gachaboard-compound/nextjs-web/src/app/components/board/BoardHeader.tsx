"use client";

import { useRef, useState, useCallback } from "react";
import { useDrag } from "@use-gesture/react";
import { useCopyToClipboard } from "usehooks-ts";
import Link from "next/link";
import { Identicon } from "@/app/components/ui/Identicon";
import { UserSharePanel } from "@/app/components/collaboration/UserSharePanel";
import type { StoredSession } from "@/lib/s3UploadSessionStore";
import type { WebsocketProvider } from "y-websocket";

type Props = {
  workspaceId: string;
  boardId: string;
  boardName: string | null;
  syncStatus: string | null;
  isSyncError: boolean;
  useSync: boolean;
  provider?: WebsocketProvider;
  currentUserId: string;
  onHeaderActionsMount: (el: HTMLDivElement | null) => void;
  resumableUploads: StoredSession[];
  onResumeUpload: (session: StoredSession) => void;
  onRefresh: () => void;
};

export function BoardHeader({
  workspaceId,
  boardId,
  boardName,
  syncStatus,
  isSyncError,
  useSync,
  provider,
  currentUserId,
  onHeaderActionsMount,
  resumableUploads,
  onResumeUpload,
  onRefresh,
}: Props) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [, copyToClipboard] = useCopyToClipboard();
  const didDragRef = useRef(false);
  const scrollStartRef = useRef(0);

  const bindDrag = useDrag(
    ({ movement: [mx], first, last }) => {
      const el = headerRef.current;
      if (!el) return;
      if (first) {
        scrollStartRef.current = el.scrollLeft;
        didDragRef.current = false;
        setIsDragging(true);
      }
      el.scrollLeft = scrollStartRef.current - mx;
      if (!first) didDragRef.current = true;
      if (last) setIsDragging(false);
    },
    { axis: "x" }
  );

  const handleHeaderWheel = useCallback((e: React.WheelEvent) => {
    const el = headerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, []);

  const handleHeaderClickCapture = useCallback((e: React.MouseEvent) => {
    if (didDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didDragRef.current = false;
    }
  }, []);

  return (
    <>
      <div
        ref={headerRef}
        {...bindDrag()}
        onWheel={handleHeaderWheel}
        onClickCapture={handleHeaderClickCapture}
        style={{ touchAction: "pan-y" }}
        className="flex touch-pan-x flex-nowrap select-none items-center gap-3 overflow-x-auto border-b border-zinc-200 bg-white px-4 py-2 z-10 whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch] dark:border-zinc-700 dark:bg-[#25292e]"
      >
        <Link
          href={`/workspace/${workspaceId}`}
          className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:text-slate-300 dark:hover:text-white"
        >
          ← 戻る
        </Link>
        <div className="flex items-center gap-2">
          <Identicon value={boardId} size={24} />
          <span className="text-xs font-medium text-zinc-900 dark:text-white">
            {boardName || "無題のボード"}
          </span>
          <span className="text-xs text-zinc-400 dark:text-slate-400">
            ({boardId.slice(0, 8)})
          </span>
        </div>
        <span className="ml-auto flex items-center gap-3 text-xs dark:text-slate-400">
          {useSync && isSyncError ? (
            <button
              onClick={onRefresh}
              title="クリックで再読み込み"
              className="font-medium text-red-600 hover:underline dark:text-red-400"
            >
              {syncStatus}
            </button>
          ) : (
            <span className="text-zinc-500">{syncStatus ?? "ローカル保存"}</span>
          )}
        </span>
        <div ref={onHeaderActionsMount} className="contents" />
        {provider && (
          <UserSharePanel provider={provider} localUserId={currentUserId} />
        )}
        <button
          onClick={() =>
            typeof window !== "undefined" && copyToClipboard(window.location.href)
          }
          className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-200 dark:border-slate-600 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
        >
          URLをコピー
        </button>
      </div>

      {resumableUploads.length > 0 && (
        <div className="border-b border-zinc-200 bg-amber-50 px-4 py-2 text-xs dark:border-zinc-700 dark:bg-amber-950/50">
          <span className="font-medium">続行可能なアップロード:</span>
          {resumableUploads.map((s) => (
            <span key={s.uploadId} className="ml-2">
              {s.fileName} ({Math.round(s.totalSize / 1024 / 1024)}MB)
              <button
                onClick={() => onResumeUpload(s)}
                className="ml-1 rounded bg-amber-200 px-2 py-0.5 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 dark:text-amber-100"
              >
                続行
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
