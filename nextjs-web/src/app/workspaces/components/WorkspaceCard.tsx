"use client";

import Link from "next/link";
import { Identicon, getMinidenticonColor } from "@/app/components/ui/Identicon";
import { InviteLinkInline } from "@/app/components/ui/InviteLinkInline";
import { MoreVerticalIcon } from "@/app/components/ui/MoreVerticalIcon";
import type { Workspace } from "../types";
import type { WorkspacesTab } from "../types";
import type { E2EHeaders } from "@/lib/e2eFetch";

type Props = {
  workspace: Workspace;
  tab: WorkspacesTab;
  isOwner: boolean;
  e2eHeaders?: E2EHeaders | null;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  menuRef: (el: HTMLDivElement | null) => void;
  onRename: (id: string, name: string, description: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDeletePermanently: (id: string, name: string) => void;
};

export function WorkspaceCard({
  workspace: ws,
  tab,
  isOwner,
  e2eHeaders,
  isMenuOpen,
  onMenuToggle,
  menuRef,
  onRename,
  onTrash,
  onRestore,
  onDeletePermanently,
}: Props) {
  const borderColor = getMinidenticonColor(ws.id, 45, 58);
  const href = `/workspace/${ws.id}${e2eHeaders ? `?testUserId=${encodeURIComponent(e2eHeaders.userId)}&testUserName=${encodeURIComponent(e2eHeaders.userName)}` : ""}`;

  return (
    <li className="group relative min-w-0">
      {tab === "active" ? (
        <div
          className="flex min-w-0 flex-col overflow-hidden rounded-lg border-2 bg-stone-100 p-5 pr-12 transition hover:border-zinc-400 hover:bg-stone-200/50 dark:bg-[#212529] dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
          style={{ borderColor }}
        >
          <Link href={href} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Identicon value={ws.id} size={36} />
              <span className="font-semibold dark:text-slate-200">{ws.name}</span>
            </div>
            {ws.description && <span className="text-xs text-zinc-500 dark:text-slate-400">{ws.description}</span>}
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 dark:text-slate-500">ボード {ws._count.boards}件</span>
              <span className="text-xs text-zinc-400 dark:text-slate-500">{isOwner ? "自分" : ws.ownerName}</span>
            </div>
          </Link>
          {isOwner && <InviteLinkInline workspaceId={ws.id} />}
        </div>
      ) : (
        <div
          className="flex flex-col gap-2 rounded-lg border-2 bg-stone-100 p-5 pr-12 opacity-60 dark:bg-[#212529]"
          style={{ borderColor }}
        >
          <div className="flex items-center gap-3">
            <Identicon value={ws.id} size={36} />
            <span className="font-semibold dark:text-slate-200">{ws.name}</span>
          </div>
          {ws.description && <span className="text-xs text-zinc-500 dark:text-slate-400">{ws.description}</span>}
          <span className="text-xs text-zinc-400 dark:text-slate-500">
            削除日: {ws.deletedAt ? new Date(ws.deletedAt).toLocaleDateString("ja-JP") : ""}
          </span>
        </div>
      )}
      <div ref={menuRef} className="absolute right-2 top-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            onMenuToggle();
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 ${isMenuOpen ? "bg-zinc-50 ring-1 ring-zinc-300 dark:bg-slate-600 dark:ring-slate-500" : ""}`}
          aria-label="メニューを開く"
        >
          <MoreVerticalIcon className="h-5 w-5" />
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 top-10 z-20 min-w-[140px] rounded-lg border border-zinc-200 bg-white py-1 dark:border-slate-600 dark:bg-slate-800">
            <button
              onClick={(e) => {
                e.preventDefault();
                onRename(ws.id, ws.name, ws.description || "");
              }}
              className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              名前を変更
            </button>
            <div className="my-1 border-t border-zinc-100 dark:border-slate-600" />
            {tab === "active" ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onTrash(ws.id);
                }}
                className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ゴミ箱へ
              </button>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onRestore(ws.id);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  復元
                </button>
                <div className="my-1 border-t border-zinc-100 dark:border-slate-600" />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onDeletePermanently(ws.id, ws.name);
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
