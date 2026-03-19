"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "@cmpd/compound";
import { toast } from "sonner";
import { runBackupFromClient } from "@/app/hooks/board/useBackupScheduler";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { TLRecord } from "@cmpd/tlschema";

type Props = {
  portalTarget: HTMLDivElement | null;
  store: { allRecords: () => Iterable<TLRecord> } | null;
  provider: HocuspocusProvider | null;
  boardId: string;
  workspaceId: string;
  enabled: boolean;
};

/** 手動バックアップボタン。Compound 内で useEditor にアクセスするためコンポーネント化 */
export function ManualBackupButton({
  portalTarget,
  store,
  provider,
  boardId,
  workspaceId,
  enabled,
}: Props) {
  const editor = useEditor();
  const [isRunning, setIsRunning] = useState(false);

  const handleClick = useCallback(async () => {
    if (!store || !provider || !editor || !enabled || isRunning) return;
    setIsRunning(true);
    try {
      const ok = await runBackupFromClient({
        editor,
        store,
        provider,
        boardId,
        workspaceId,
      });
      if (ok) {
        toast.success("バックアップを保存しました");
      } else {
        toast.error("バックアップに失敗しました（シェイプが1個以上必要です）");
      }
    } catch {
      toast.error("バックアップに失敗しました");
    } finally {
      setIsRunning(false);
    }
  }, [editor, store, provider, boardId, workspaceId, enabled, isRunning]);

  if (!portalTarget || !enabled) return null;

  return createPortal(
    <button
      onClick={handleClick}
      disabled={isRunning}
      className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-200 disabled:opacity-40 dark:border-zinc-600 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
    >
      {isRunning ? "保存中..." : "バックアップ"}
    </button>,
    portalTarget
  );
}
