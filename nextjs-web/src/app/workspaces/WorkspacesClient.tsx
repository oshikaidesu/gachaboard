"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { ApiWorkspace } from "@shared/apiTypes";

type Workspace = ApiWorkspace;

export default function WorkspacesClient({ currentUserId }: { currentUserId: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"active" | "trash">("active");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/workspaces?includeDeleted=1");
    if (res.ok) setWorkspaces(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const active = workspaces.filter((w) => !w.deletedAt);
  const trashed = workspaces.filter((w) => w.deletedAt);
  const list = tab === "active" ? active : trashed;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ワークスペース</h1>
          <p className="text-sm text-zinc-500">共有ホワイトボードのプロジェクトグループ</p>
        </div>
        {tab === "active" && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
          >
            + 新規作成
          </button>
        )}
      </header>

      <div className="flex gap-2 border-b border-zinc-200">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-medium ${tab === "active" ? "border-b-2 border-black text-black" : "text-zinc-400 hover:text-zinc-600"}`}
        >
          アクティブ ({active.length})
        </button>
        <button
          onClick={() => setTab("trash")}
          className={`px-4 py-2 text-sm font-medium ${tab === "trash" ? "border-b-2 border-black text-black" : "text-zinc-400 hover:text-zinc-600"}`}
        >
          ゴミ箱 ({trashed.length})
        </button>
      </div>

      {showForm && tab === "active" && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4">
          <input
            autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="ワークスペース名"
            className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <input
            value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="説明（任意）"
            className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <div className="flex gap-2">
            <button onClick={create} disabled={creating || !newName.trim()}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40">
              {creating ? "作成中..." : "作成"}
            </button>
            <button onClick={() => { setShowForm(false); setNewName(""); setNewDesc(""); }}
              className="rounded border border-zinc-300 px-3 py-2 text-sm">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-zinc-400">読み込み中...</div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          {tab === "active" ? "ワークスペースがありません。「+ 新規作成」から始めてください。" : "ゴミ箱は空です。"}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((ws) => {
            const isOwner = ws.ownerUserId === currentUserId;
            return (
              <li key={ws.id} className="group relative">
                {tab === "active" ? (
                  <Link href={`/workspace/${ws.id}`}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-5 transition hover:border-zinc-400 hover:bg-zinc-50">
                    <span className="font-semibold">{ws.name}</span>
                    {ws.description && <span className="text-xs text-zinc-500">{ws.description}</span>}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">ボード {ws._count.boards}件</span>
                      <span className="text-xs text-zinc-400">
                        {isOwner ? "自分" : ws.ownerName}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-5 opacity-60">
                    <span className="font-semibold">{ws.name}</span>
                    {ws.description && <span className="text-xs text-zinc-500">{ws.description}</span>}
                    <span className="text-xs text-zinc-400">
                      削除日: {new Date(ws.deletedAt!).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                )}
                {/* オーナーのみ操作ボタンを表示 */}
                {isOwner && (
                  <div className="absolute right-3 top-3 hidden gap-1 group-hover:flex">
                    {tab === "active" ? (
                      <button onClick={() => trash(ws.id)}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500">
                        ゴミ箱へ
                      </button>
                    ) : (
                      <>
                        <button onClick={() => restore(ws.id)}
                          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-green-50 hover:text-green-600">
                          復元
                        </button>
                        <button onClick={() => deletePermanently(ws.id, ws.name)}
                          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600">
                          完全削除
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
