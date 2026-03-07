"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { ApiWorkspace } from "@shared/apiTypes";
import { Identicon, getMinidenticonColor } from "../components/ui/Identicon";
import { InviteLinkInline } from "../components/ui/InviteLinkInline";
import { MoreVerticalIcon } from "../components/ui/MoreVerticalIcon";
import { RenameModal } from "../components/ui/RenameModal";

type Workspace = ApiWorkspace;

export default function WorkspacesClient({ currentUserId }: { currentUserId: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string; description: string } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameDesc, setRenameDesc] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/workspaces?includeDeleted=1");
    if (res.ok) setWorkspaces(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!openMenu) return;
      const el = menuRefs.current.get(openMenu);
      if (el && !el.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
    });
    if (res.ok) { setNewName(""); setNewDesc(""); setShowForm(false); await load(); }
    setCreating(false);
  };

  const trash = async (id: string) => {
    await fetch(`/api/workspaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trash" }),
    });
    await load();
  };

  const restore = async (id: string) => {
    await fetch(`/api/workspaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    await load();
  };

  const deletePermanently = async (id: string, name: string) => {
    if (!confirm(`「${name}」を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", name: renameName.trim(), description: renameDesc.trim() || undefined }),
    });
    setRenameSaving(false);
    if (res.ok) { setRenaming(null); await load(); }
  };

  const active = workspaces.filter((w) => !w.deletedAt);
  const trashed = workspaces.filter((w) => w.deletedAt);
  const list = tab === "active" ? active : trashed;

  return (
    <main className="flex min-h-screen flex-col bg-background bg-grid-subtle">
      {/* ヘッダー（ライト: 白、ダーク: 背景と同系） */}
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-[#25292e]">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">ワークスペース</h1>
              <p className="text-sm text-zinc-500 dark:text-slate-300">共有ホワイトボードのプロジェクトグループ</p>
            </div>
            {tab === "active" && (
              <button
                onClick={() => setShowForm(true)}
                className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white/20 dark:text-white dark:hover:bg-white/30"
              >
                + 新規作成
              </button>
            )}
          </div>
          <div className="flex gap-2 border-t border-zinc-200 pt-3 dark:border-slate-600/50">
            <button
              onClick={() => setTab("active")}
              className={`px-4 py-2 text-sm font-medium ${tab === "active" ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
            >
              アクティブ ({active.length})
            </button>
            <button
              onClick={() => setTab("trash")}
              className={`px-4 py-2 text-sm font-medium ${tab === "trash" ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
            >
              ゴミ箱 ({trashed.length})
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">

      {showForm && tab === "active" && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-slate-600 dark:bg-slate-800/80">
          <input
            autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="ワークスペース名"
            className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-slate-500"
          />
          <input
            value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="説明（任意）"
            className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-slate-500"
          />
          <div className="flex gap-2">
            <button onClick={create} disabled={creating || !newName.trim()}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white/20 dark:hover:bg-white/30">
              {creating ? "作成中..." : "作成"}
            </button>
            <button onClick={() => { setShowForm(false); setNewName(""); setNewDesc(""); }}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-zinc-400 dark:text-slate-400">読み込み中...</div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-slate-600 dark:text-slate-400">
          {tab === "active" ? "ワークスペースがありません。「+ 新規作成」から始めてください。" : "ゴミ箱は空です。"}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((ws) => {
            const isOwner = ws.ownerUserId === currentUserId;
            return (
              <li key={ws.id} className="group relative">
                {tab === "active" ? (
                  <div
                    className="flex flex-col rounded-lg border-2 bg-stone-100 p-5 pr-12 transition hover:border-zinc-400 hover:bg-stone-200/50 dark:bg-[#212529] dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
                    style={{ borderColor: getMinidenticonColor(ws.id, 45, 58) }}
                  >
                    <Link href={`/workspace/${ws.id}`} className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <Identicon value={ws.id} size={36} />
                        <span className="font-semibold dark:text-slate-200">{ws.name}</span>
                      </div>
                      {ws.description && <span className="text-xs text-zinc-500 dark:text-slate-400">{ws.description}</span>}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400 dark:text-slate-500">ボード {ws._count.boards}件</span>
                        <span className="text-xs text-zinc-400 dark:text-slate-500">
                          {isOwner ? "自分" : ws.ownerName}
                        </span>
                      </div>
                    </Link>
                    {isOwner && <InviteLinkInline workspaceId={ws.id} />}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 rounded-lg border-2 bg-stone-100 p-5 pr-12 opacity-60 dark:bg-[#212529]"
                    style={{ borderColor: getMinidenticonColor(ws.id, 45, 58) }}>
                    <div className="flex items-center gap-3">
                      <Identicon value={ws.id} size={36} />
                      <span className="font-semibold dark:text-slate-200">{ws.name}</span>
                    </div>
                    {ws.description && <span className="text-xs text-zinc-500 dark:text-slate-400">{ws.description}</span>}
                    <span className="text-xs text-zinc-400 dark:text-slate-500">
                      削除日: {new Date(ws.deletedAt!).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                )}
                {/* 三点リーダーメニュー */}
                <div ref={(el) => { if (el) menuRefs.current.set(ws.id, el); else menuRefs.current.delete(ws.id); }} className="absolute right-2 top-2">
                    <button
                      onClick={(e) => { e.preventDefault(); setOpenMenu(openMenu === ws.id ? null : ws.id); }}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 ${openMenu === ws.id ? "bg-zinc-50 ring-1 ring-zinc-300 dark:bg-slate-600 dark:ring-slate-500" : ""}`}
                      aria-label="メニューを開く"
                    >
                      <MoreVerticalIcon className="w-5 h-5" />
                    </button>
                    {openMenu === ws.id && (
                      <div className="absolute right-0 top-10 z-20 min-w-[140px] rounded-lg border border-zinc-200 bg-white py-1 dark:border-slate-600 dark:bg-slate-800">
                        <button
                          onClick={(e) => { e.preventDefault(); openRename(ws.id, ws.name, ws.description || ""); }}
                          className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          名前を変更
                        </button>
                        <div className="my-1 border-t border-zinc-100 dark:border-slate-600" />
                        {tab === "active" ? (
                          <button
                            onClick={(e) => { e.preventDefault(); trash(ws.id); setOpenMenu(null); }}
                            className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            ゴミ箱へ
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(e) => { e.preventDefault(); restore(ws.id); setOpenMenu(null); }}
                              className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              復元
                            </button>
                            <div className="my-1 border-t border-zinc-100 dark:border-slate-600" />
                            <button
                              onClick={(e) => { e.preventDefault(); deletePermanently(ws.id, ws.name); setOpenMenu(null); }}
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
          })}
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
