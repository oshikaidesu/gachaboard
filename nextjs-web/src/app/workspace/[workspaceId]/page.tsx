"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Board = { id: string; name: string; createdAt: string };

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/boards`);
    if (res.status === 401) { router.replace("/"); return; }
    if (res.status === 404) { router.replace("/workspaces"); return; }
    if (res.ok) setBoards(await res.json());
    setLoading(false);
  }, [workspaceId, router]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/boards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName(""); setShowForm(false);
      await load();
    }
    setCreating(false);
  };

  const remove = async (boardId: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}`, { method: "DELETE" });
    await load();
  };

  const copyBoardUrl = (boardId: string) => {
    const url = `${window.location.origin}/board/${boardId}`;
    navigator.clipboard.writeText(url);
    setCopied(boardId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ボード一覧</h1>
          <Link href="/workspaces" className="text-xs text-zinc-400 hover:underline">
            ← ワークスペース一覧に戻る
          </Link>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
        >
          + 新規ボード
        </button>
      </header>

      {showForm && (
        <div className="flex gap-2 rounded-lg border border-zinc-200 p-4">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="ボード名"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <button
            onClick={create}
            disabled={creating || !newName.trim()}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {creating ? "作成中..." : "作成"}
          </button>
          <button
            onClick={() => { setShowForm(false); setNewName(""); }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            キャンセル
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-zinc-400">読み込み中...</div>
      ) : boards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          ボードがありません。「+ 新規ボード」から作成してください。
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {boards.map((b) => (
            <li key={b.id} className="group relative">
              <Link
                href={`/board/${b.id}`}
                className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-5 transition hover:border-zinc-400 hover:bg-zinc-50"
              >
                <span className="font-semibold">{b.name}</span>
                <span className="text-xs text-zinc-400">
                  {new Date(b.createdAt).toLocaleDateString("ja-JP")}
                </span>
              </Link>
              <div className="absolute right-3 top-3 hidden gap-1 group-hover:flex">
                <button
                  onClick={() => copyBoardUrl(b.id)}
                  className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
                >
                  {copied === b.id ? "コピー済み" : "URLコピー"}
                </button>
                <button
                  onClick={() => remove(b.id, b.name)}
                  className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500"
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
