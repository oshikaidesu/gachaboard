"use client";

import type { WorkspacesTab } from "../types";

type Props = {
  loading: boolean;
  tab: WorkspacesTab;
  hasItems: boolean;
};

export function WorkspacesEmptyState({ loading, tab, hasItems }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-400 dark:text-slate-400">
        読み込み中...
      </div>
    );
  }
  if (hasItems) return null;
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-slate-600 dark:text-slate-400">
      {tab === "active"
        ? "ワークスペースがありません。「+ 新規作成」から始めてください。"
        : "ゴミ箱は空です。"}
    </div>
  );
}
