"use client";

import { useState } from "react";
import Link from "next/link";
import { GachaboardLogo } from "@/app/components/ui/GachaboardLogo";
import type { ApiBoard } from "@shared/apiTypes";
import { Identicon } from "@/app/components/ui/Identicon";
import { RenameModal } from "@/app/components/ui/RenameModal";
import { useCopyToClipboard } from "usehooks-ts";
import { useWorkspaceDetail } from "@/app/hooks/workspace/useWorkspaceDetail";
import { WorkspaceMembersPopover } from "./components/WorkspaceMembersPopover";
import { WorkspaceBoardCard } from "./components/WorkspaceBoardCard";
import { BoardCreateForm } from "./components/BoardCreateForm";
import type { E2EHeaders } from "@/lib/e2eFetch";
import { withE2EHeaders } from "@/lib/e2eFetch";

type Props = { workspaceId: string; currentUserId: string; e2eHeaders?: E2EHeaders | null };

export default function WorkspaceDetailClient({ workspaceId, currentUserId, e2eHeaders }: Props) {
  const { wsInfo, members, canKick, boards, loading, load } = useWorkspaceDetail(workspaceId, e2eHeaders);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [copiedText, copyToClipboard] = useCopyToClipboard();

  const create = async (name: string) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/boards`, {
      method: "POST",
      headers: withE2EHeaders({ "Content-Type": "application/json" }, e2eHeaders),
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setShowForm(false);
      await load();
    }
  };

  const trash = async (boardId: string) => {
    await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}`, {
      method: "PATCH",
      headers: withE2EHeaders({ "Content-Type": "application/json" }, e2eHeaders),
      body: JSON.stringify({ action: "trash" }),
    });
    await load();
  };

  const restore = async (boardId: string) => {
    await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}`, {
      method: "PATCH",
      headers: withE2EHeaders({ "Content-Type": "application/json" }, e2eHeaders),
      body: JSON.stringify({ action: "restore" }),
    });
    await load();
  };

  const deletePermanently = async (boardId: string, name: string) => {
    if (!confirm(`「${name}」を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}`, {
      method: "DELETE",
      headers: withE2EHeaders({}, e2eHeaders),
    });
    await load();
  };

  const copyBoardUrl = (boardId: string) => {
    copyToClipboard(`${window.location.origin}/board/${boardId}`);
  };

  const openRenameBoard = (boardId: string, name: string) => {
    setOpenMenu(null);
    setRenaming({ id: boardId, name });
    setRenameName(name);
  };

  const saveRenameBoard = async () => {
    if (!renaming || !renameName.trim()) return;
    setRenameSaving(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/boards/${renaming.id}`, {
      method: "PATCH",
      headers: withE2EHeaders({ "Content-Type": "application/json" }, e2eHeaders),
      body: JSON.stringify({ action: "rename", name: renameName.trim() }),
    });
    setRenameSaving(false);
    if (res.ok) {
      setRenaming(null);
      await load();
    }
  };

  const isOwner = wsInfo?.ownerUserId === currentUserId;
  const active = boards.filter((b) => !b.deletedAt);
  const trashed = boards.filter((b) => b.deletedAt);
  const list = tab === "active" ? active : trashed;

  return (
    <main className="flex min-h-screen flex-col bg-background bg-grid-subtle">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-[#25292e]">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <GachaboardLogo size="md" href={e2eHeaders ? `/workspaces?testUserId=${encodeURIComponent(e2eHeaders.userId)}&testUserName=${encodeURIComponent(e2eHeaders.userName)}` : "/workspaces"} />
                <Identicon value={workspaceId} size={40} />
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
                  {wsInfo ? wsInfo.name : "ボード一覧"}
                </h1>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <Link
                  href={e2eHeaders ? `/workspaces?testUserId=${encodeURIComponent(e2eHeaders.userId)}&testUserName=${encodeURIComponent(e2eHeaders.userName)}` : "/workspaces"}
                  className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:text-slate-300 dark:hover:text-white"
                >
                  ← ワークスペース一覧に戻る
                </Link>
                <Link
                  href={`/workspace/${workspaceId}/assets`}
                  className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:text-slate-300 dark:hover:text-white"
                >
                  アセット管理 →
                </Link>
                {wsInfo && (
                  <span className="text-xs text-zinc-400 dark:text-slate-400">
                    オーナー: {isOwner ? "自分" : wsInfo.ownerName}
                  </span>
                )}
              </div>
            </div>
            <WorkspaceMembersPopover
              members={members}
              canKick={canKick}
              workspaceId={workspaceId}
              onKickSuccess={load}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-slate-600/50">
            <button
              onClick={() => setTab("active")}
              className={`px-4 py-2 text-sm font-medium ${
                tab === "active"
                  ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              アクティブ ({active.length})
            </button>
            <button
              onClick={() => setTab("trash")}
              className={`px-4 py-2 text-sm font-medium ${
                tab === "trash"
                  ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              ゴミ箱 ({trashed.length})
            </button>
            {tab === "active" && (
              <button
                onClick={() => setShowForm(true)}
                className="ml-auto rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white/20 dark:hover:bg-white/30"
              >
                + 新規ボード
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
        {showForm && tab === "active" && (
          <BoardCreateForm
            onCreate={create}
            onCancel={() => setShowForm(false)}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-400 dark:text-slate-400">
            読み込み中...
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-slate-600 dark:text-slate-400">
            {tab === "active"
              ? "ボードがありません。「+ 新規ボード」から作成してください。"
              : "ゴミ箱は空です。"}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((b) => (
              <WorkspaceBoardCard
                key={b.id}
                board={b}
                tab={tab}
                copiedBoardId={copiedText?.endsWith(`/board/${b.id}`) ? b.id : null}
                openMenuId={openMenu}
                onOpenMenu={setOpenMenu}
                onCopyUrl={copyBoardUrl}
                onRename={openRenameBoard}
                onTrash={trash}
                onRestore={restore}
                onDeletePermanently={deletePermanently}
              />
            ))}
          </ul>
        )}

        {renaming && (
          <RenameModal
            title="ボード名を変更"
            nameLabel="ボード名"
            nameValue={renameName}
            onNameChange={setRenameName}
            onSave={saveRenameBoard}
            onClose={() => setRenaming(null)}
            saving={renameSaving}
          />
        )}
      </div>
    </main>
  );
}
