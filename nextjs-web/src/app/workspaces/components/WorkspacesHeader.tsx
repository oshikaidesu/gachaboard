"use client";

import { GachaboardLogo } from "@/app/components/ui/GachaboardLogo";
import { ThemeToggle } from "@/app/components/theme/ThemeToggle";
import type { WorkspacesTab } from "../types";

type Props = {
  tab: WorkspacesTab;
  onTabChange: (tab: WorkspacesTab) => void;
  activeCount: number;
  trashedCount: number;
  onNewCreateClick: () => void;
};

export function WorkspacesHeader({
  tab,
  onTabChange,
  activeCount,
  trashedCount,
  onNewCreateClick,
}: Props) {
  return (
    <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-[#25292e]">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GachaboardLogo size="md" href="/" />
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">ワークスペース</h1>
              <p className="text-sm text-zinc-500 dark:text-slate-300">共有ホワイトボードのプロジェクトグループ</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-slate-600/50">
          <button
            onClick={() => onTabChange("active")}
            className={`px-4 py-2 text-sm font-medium ${tab === "active" ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
          >
            アクティブ ({activeCount})
          </button>
          <button
            onClick={() => onTabChange("trash")}
            className={`px-4 py-2 text-sm font-medium ${tab === "trash" ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
          >
            ゴミ箱 ({trashedCount})
          </button>
          {tab === "active" && (
            <button
              onClick={onNewCreateClick}
              className="ml-auto rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white/20 dark:text-white dark:hover:bg-white/30"
            >
              + 新規作成
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
