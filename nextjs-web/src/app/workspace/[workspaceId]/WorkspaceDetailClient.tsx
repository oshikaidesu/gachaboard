"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ApiBoard, ApiWorkspaceInfo } from "@shared/apiTypes";

type Board = ApiBoard;
type WorkspaceInfo = ApiWorkspaceInfo;

type Props = { workspaceId: string; currentUserId: string };

export default function WorkspaceDetailClient({ workspaceId, currentUserId }: Props) {
  const router = useRouter();

  const [wsInfo, setWsInfo] = useState<WorkspaceInfo | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "trash">("active");

  const load = useCallback(async () => {
    setLoading(true);
    const [wsRes, boardsRes] = await Promise.all([
      fetch(`/api/workspaces/${workspaceId}`),
      fetch(`/api/workspaces/${workspaceId}/boards?includeDeleted=1`),
    ]);
    if (wsRes.status === 401 || boardsRes.status === 401) { router.replace("/"); return; }
    if (wsRes.status === 404 || boardsRes.status === 404) { router.replace("/workspaces"); return; }
    if (wsRes.ok) setWsInfo(await wsRes.json());
    if (boardsRes.ok) setBoards(await boardsRes.json());
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
    if (res.ok) { setNewName(""); setShowForm(false); await load(); }
    setCreating(false);
  };

  const trash = async (boardId: string) => {
    await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trash" }),
    });
    await load();
  };

  const restore = async (boardId: string) => {
    await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    await load();
  };

  const deletePermanently = async (boardId: string, name: string) => {
    if (!confirm(`「${name}」を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}`, { method: "DELETE" });
    await load();
  };

  const copyBoardUrl = (boardId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/board/${boardId}`);
    setCopied(boardId);
    setTimeout(() => setCopied(null), 2000);
  };

  const isOwner = wsInfo?.ownerUserId === currentUserId;
  const active = boards.filter((b) => !b.deletedAt);
  const trashed = boards.filter((b) => b.deletedAt);
  const list = tab === "active" ? active : trashed;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {wsInfo ? wsInfo.name : "ボード一覧"}
          </h1>
          <div className="flex items-center gap-3">
            <Link href="/workspaces" className="text-xs text-zinc-400 hover:underline">
              ← ワークスペース一覧に戻る
            </Link>
            <Link href={`/workspace/${workspaceId}/assets`} className="text-xs text-zinc-400 hover:underline">
              アセット管理 →
            </Link>
            {wsInfo && (
              <span className="text-xs text-zinc-400">
                オーナー: {isOwner ? "自分" : wsInfo.ownerName}
              </span>
            )}
          </div>
        </div>
        {/* ボード作成はログイン済み全員に開放 */}
        {tab === "active" && (
          <button onClick={() => setShowForm(true)}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800">
            + 新規ボード
          </button>
        )}
      </header>

      <div className="flex gap-2 border-b border-zinc-200">
        <button onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-medium ${tab === "active" ? "border-b-2 border-black text-black" : "text-zinc-400 hover:text-zinc-600"}`}>
          アクティブ ({active.length})
        </button>
        <button onClick={() => setTab("trash")}
          className={`px-4 py-2 text-sm font-medium ${tab === "trash" ? "border-b-2 border-black text-black" : "text-zinc-400 hover:text-zinc-600"}`}>
          ゴミ箱 ({trashed.length})
        </button>
      </div>

      {showForm && tab === "active" && (
        <div className="flex gap-2 rounded-lg border border-zinc-200 p-4">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="ボード名"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <button onClick={create} disabled={creating || !newName.trim()}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40">
            {creating ? "作成中..." : "作成"}
          </button>
          <button onClick={() => { setShowForm(false); setNewName(""); }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm">
            キャンセル
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-zinc-400">読み込み中...</div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          {tab === "active" ? "ボードがありません。「+ 新規ボード」から作成してください。" : "ゴミ箱は空です。"}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((b) => (
            <li key={b.id} className="group relative">
              {tab === "active" ? (
                <Link href={`/board/${b.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-5 transition hover:border-zinc-400 hover:bg-zinc-50">
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-xs text-zinc-400">{new Date(b.createdAt).toLocaleDateString("ja-JP")}</span>
                </Link>
              ) : (
                <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-5 opacity-60">
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-xs text-zinc-400">
                    削除日: {new Date(b.deletedAt!).toLocaleDateString("ja-JP")}
                  </span>
                </div>
              )}
              <div className="absolute right-3 top-3 hidden gap-1 group-hover:flex">
                {tab === "active" ? (
                  <>
                    <button onClick={() => copyBoardUrl(b.id)}
                      className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50">
                      {copied === b.id ? "コピー済み" : "URLコピー"}
                    </button>
                    {/* ゴミ箱へはオーナーのみ */}
                    {isOwner && (
                      <button onClick={() => trash(b.id)}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500">
                        ゴミ箱へ
                      </button>
                    )}
                  </>
                ) : (
                  /* ゴミ箱内の操作もオーナーのみ */
                  isOwner && (
                    <>
                      <button onClick={() => restore(b.id)}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-green-50 hover:text-green-600">
                        復元
                      </button>
                      <button onClick={() => deletePermanently(b.id, b.name)}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600">
                        完全削除
                      </button>
                    </>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
