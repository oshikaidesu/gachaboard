"use client";

import { useRef } from "react";
import Link from "next/link";
import type { ApiBoard } from "@shared/apiTypes";
import { Identicon, getMinidenticonColor } from "@/app/components/ui/Identicon";
import { MoreVerticalIcon } from "@/app/components/ui/MoreVerticalIcon";
import { useOnClickOutside } from "usehooks-ts";

type Props = {
  board: ApiBoard;
  tab: "active" | "trash";
  copiedBoardId: string | null;
  openMenuId: string | null;
  onOpenMenu: (id: string | null) => void;
  onCopyUrl: (boardId: string) => void;
  onRename: (boardId: string, name: string) => void;
  onTrash: (boardId: string) => void;
  onRestore: (boardId: string) => void;
  onDeletePermanently: (boardId: string, name: string) => void;
};

export function WorkspaceBoardCard({
  board,
  tab,
  copiedBoardId,
  openMenuId,
  onOpenMenu,
  onCopyUrl,
  onRename,
  onTrash,
  onRestore,
  onDeletePermanently,
}: Props) {
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const isOpen = openMenuId === board.id;

  useOnClickOutside(menuContainerRef, () => {
    if (isOpen) onOpenMenu(null);
  });

  return (
    <li className="group relative">
      {tab === "active" ? (
        <Link
          href={`/board/${board.id}`}
          className="flex flex-col gap-1 rounded-lg border-2 bg-stone-100 p-5 pr-10 transition hover:border-zinc-400 hover:bg-stone-200/50 dark:bg-[#212529] dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
          style={{ borderColor: getMinidenticonColor(board.id, 45, 58) }}
        >
          <div className="flex items-center gap-3">
            <Identicon value={board.id} size={32} />
            <span className="font-semibold dark:text-slate-200">{board.name}</span>
          </div>
          <span className="text-xs text-zinc-400 dark:text-slate-500">
            {new Date(board.createdAt).toLocaleDateString("ja-JP")}
          </span>
        </Link>
      ) : (
        <div
          className="flex flex-col gap-1 rounded-lg border-2 bg-stone-100 p-5 pr-10 opacity-60 dark:bg-[#212529]"
          style={{ borderColor: getMinidenticonColor(board.id, 45, 58) }}
        >
          <div className="flex items-center gap-3">
            <Identicon value={board.id} size={32} />
            <span className="font-semibold dark:text-slate-200">{board.name}</span>
          </div>
          <span className="text-xs text-zinc-400 dark:text-slate-500">
            削除日:{" "}
            {board.deletedAt
              ? new Date(board.deletedAt).toLocaleDateString("ja-JP")
              : ""}
          </span>
        </div>
      )}

      <div ref={menuContainerRef} className="absolute right-2 top-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            onOpenMenu(isOpen ? null : board.id);
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 ${
            isOpen
              ? "bg-zinc-50 ring-1 ring-zinc-300 dark:bg-slate-600 dark:ring-slate-500"
              : ""
          }`}
          aria-label="メニューを開く"
        >
          <MoreVerticalIcon className="h-5 w-5" />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 dark:border-slate-600 dark:bg-slate-800">
            {tab === "active" ? (
              <>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onRename(board.id, board.name);
                    onOpenMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  名前を変更
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onCopyUrl(board.id);
                    onOpenMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {copiedBoardId === board.id ? "✓ コピー済み" : "URLをコピー"}
                </button>
                <Link
                  href={`/board/${board.id}/trash`}
                  onClick={() => onOpenMenu(null)}
                  className="block px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  アセットのゴミ箱
                </Link>
                <Link
                  href={`/board/${board.id}/reaction-preset`}
                  onClick={() => onOpenMenu(null)}
                  className="block px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  リアクション絵文字をカスタマイズ
                </Link>
                <div className="my-1 border-t border-zinc-100 dark:border-slate-600" />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onTrash(board.id);
                    onOpenMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  ゴミ箱へ移動
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onRestore(board.id);
                    onOpenMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  復元
                </button>
                <div className="my-1 border-t border-zinc-100 dark:border-slate-600" />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onDeletePermanently(board.id, board.name);
                    onOpenMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  完全削除
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
