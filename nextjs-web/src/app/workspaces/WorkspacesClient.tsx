"use client";

import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { useOnClickOutside } from "usehooks-ts";
import type { ApiWorkspace } from "@shared/apiTypes";
import { RenameModal } from "@/app/components/ui/RenameModal";
import { useWorkspaces } from "@/app/hooks/workspace/useWorkspaces";
import type { E2EHeaders } from "@/lib/e2eFetch";
import { withE2EHeaders } from "@/lib/e2eFetch";
import type { WorkspacesTab } from "./types";
import { WorkspacesHeader } from "./components/WorkspacesHeader";
import { WorkspacesEmptyState } from "./components/WorkspacesEmptyState";
import { WorkspaceCard } from "./components/WorkspaceCard";

type Props = {
  currentUserId: string;
  e2eHeaders?: E2EHeaders | null;
  /** E2E 以外でワークスペース画面を見ているとき true（動画設定リンク表示） */
  showServerMediaLink?: boolean;
};

export default function WorkspacesClient({ currentUserId, e2eHeaders, showServerMediaLink }: Props) {
  const { workspaces, loading, load } = useWorkspaces(e2eHeaders);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<WorkspacesTab>("active");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string; description: string } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameDesc, setRenameDesc] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const openMenuContainerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    openMenuContainerRef.current = openMenu ? (menuRefs.current.get(openMenu) ?? null) : null;
  }, [openMenu]);
  useOnClickOutside(openMenuContainerRef, () => {
    if (openMenu) setOpenMenu(null);
  });

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: withE2EHeaders({ "Content-Type": "application/json" }, e2eHeaders),
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
    });
    if (res.ok) {
      setNewName("");
      setNewDesc("");
      setShowForm(false);
      await load();
    }
    setCreating(false);
  };

  const trash = async (id: string) => {
    await fetch(`/api/workspaces/${id}`, {
      method: "PATCH",
      headers: withE2EHeaders({ "Content-Type": "application/json" }, e2eHeaders),
      body: JSON.stringify({ action: "trash" }),
    });
    await load();
  };

  const restore = async (id: string) => {
    await fetch(`/api/workspaces/${id}`, {
      method: "PATCH",
      headers: withE2EHeaders({ "Content-Type": "application/json" }, e2eHeaders),
      body: JSON.stringify({ action: "restore" }),
    });
    await load();
  };

  const deletePermanently = async (id: string, name: string) => {
    if (!confirm(`「${name}」を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    await fetch(`/api/workspaces/${id}`, {
      method: "DELETE",
      headers: withE2EHeaders({}, e2eHeaders),
    });
    await load();
  };

  const openRename = (id: string, name: string, description: string) => {
    setOpenMenu(null);
    setRenaming({ id, name, description: description || "" });
    setRenameName(name);
    setRenameDesc(description || "");
  };

  const saveRename = async () => {
    if (!renaming || !renameName.trim()) return;
    setRenameSaving(true);
    const res = await fetch(`/api/workspaces/${renaming.id}`, {
      method: "PATCH",
      headers: withE2EHeaders({ "Content-Type": "application/json" }, e2eHeaders),
      body: JSON.stringify({ action: "rename", name: renameName.trim(), description: renameDesc.trim() || undefined }),
    });
    setRenameSaving(false);
    if (res.ok) {
      setRenaming(null);
      await load();
    }
  };

  const active = workspaces.filter((w) => !w.deletedAt);
  const trashed = workspaces.filter((w) => w.deletedAt);
  const list = tab === "active" ? active : trashed;

  return (
    <main className="flex min-h-screen flex-col bg-background bg-grid-subtle">
      <WorkspacesHeader
        tab={tab}
        onTabChange={setTab}
        activeCount={active.length}
        trashedCount={trashed.length}
        onNewCreateClick={() => setShowForm(true)}
        serverMediaHref={showServerMediaLink ? "/server/media-encoding" : undefined}
      />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
        {showForm && tab === "active" && (
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-slate-600 dark:bg-slate-800/80">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="ワークスペース名"
              className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-slate-500"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="説明（任意）"
              className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-slate-500"
            />
            <div className="flex gap-2">
              <button
                onClick={create}
                disabled={creating || !newName.trim()}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white/20 dark:hover:bg-white/30"
              >
                {creating ? "作成中..." : "作成"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setNewName("");
                  setNewDesc("");
                }}
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        <WorkspacesEmptyState loading={loading} tab={tab} hasItems={list.length > 0} />

        {!loading && list.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws as ApiWorkspace}
                tab={tab}
                isOwner={ws.ownerUserId === currentUserId}
                e2eHeaders={e2eHeaders}
                isMenuOpen={openMenu === ws.id}
                onMenuToggle={() => setOpenMenu(openMenu === ws.id ? null : ws.id)}
                menuRef={(el) => {
                  if (el) menuRefs.current.set(ws.id, el);
                  else menuRefs.current.delete(ws.id);
                }}
                onRename={openRename}
                onTrash={(id) => {
                  trash(id);
                  setOpenMenu(null);
                }}
                onRestore={(id) => {
                  restore(id);
                  setOpenMenu(null);
                }}
                onDeletePermanently={(id, name) => {
                  deletePermanently(id, name);
                  setOpenMenu(null);
                }}
              />
            ))}
          </ul>
        )}

        {renaming && (
          <RenameModal
            title="ワークスペース名を変更"
            nameLabel="ワークスペース名"
            nameValue={renameName}
            onNameChange={setRenameName}
            descLabel="説明（任意）"
            descValue={renameDesc}
            onDescChange={setRenameDesc}
            onSave={saveRename}
            onClose={() => setRenaming(null)}
            saving={renameSaving}
          />
        )}
      </div>
    </main>
  );
}
