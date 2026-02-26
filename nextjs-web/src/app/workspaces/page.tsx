"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { boards: number };
};

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/workspaces");
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
    if (res.ok) {
      setNewName(""); setNewDesc(""); setShowForm(false);
      await load();
    }
    setCreating(false);
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\n中のボードも全て削除されます。`)) return;
    await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ワークスペース</h1>
          <p className="text-sm text-zinc-500">プロジェクトのグループを管理します。</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
        >
          + 新規作成
        </button>
      </header>

      {showForm && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="ワークスペース名"
            className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="説明（任意）"
            className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={creating || !newName.trim()}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {creating ? "作成中..." : "作成"}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewName(""); setNewDesc(""); }}
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-zinc-400">読み込み中...</div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          ワークスペースがありません。「+ 新規作成」から始めてください。
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {workspaces.map((ws) => (
            <li key={ws.id} className="group relative">
              <Link
                href={`/workspace/${ws.id}`}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-5 transition hover:border-zinc-400 hover:bg-zinc-50"
              >
                <span className="font-semibold">{ws.name}</span>
                {ws.description && (
                  <span className="text-xs text-zinc-500">{ws.description}</span>
                )}
                <span className="text-xs text-zinc-400">ボード {ws._count.boards}件</span>
              </Link>
              <button
                onClick={() => remove(ws.id, ws.name)}
                className="absolute right-3 top-3 hidden rounded px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500 group-hover:block"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
