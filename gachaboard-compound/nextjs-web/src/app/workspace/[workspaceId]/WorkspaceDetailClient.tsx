"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ApiBoard, ApiWorkspaceInfo } from "@shared/apiTypes";
import type { ApiWorkspaceMember } from "@/app/api/workspaces/[workspaceId]/members/route";
import { Identicon, getMinidenticonColor } from "@/app/components/ui/Identicon";
import { MoreVerticalIcon } from "@/app/components/ui/MoreVerticalIcon";
import { RenameModal } from "@/app/components/ui/RenameModal";
import { useCopyToClipboard } from "usehooks-ts";

type Board = ApiBoard;
type WorkspaceInfo = ApiWorkspaceInfo;

type Props = { workspaceId: string; currentUserId: string };

export default function WorkspaceDetailClient({ workspaceId, currentUserId }: Props) {
  const router = useRouter();

  const [wsInfo, setWsInfo] = useState<WorkspaceInfo | null>(null);
  const [members, setMembers] = useState<ApiWorkspaceMember[]>([]);
  const [canKick, setCanKick] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedText, copyToClipboard] = useCopyToClipboard();
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [showMembersPopover, setShowMembersPopover] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const membersButtonRef = useRef<HTMLDivElement>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const [wsRes, boardsRes, membersRes] = await Promise.all([
      fetch(`/api/workspaces/${workspaceId}`),
      fetch(`/api/workspaces/${workspaceId}/boards?includeDeleted=1`),
      fetch(`/api/workspaces/${workspaceId}/members`),
    ]);
    if (wsRes.status === 401 || boardsRes.status === 401) { router.replace("/"); return; }
    if (wsRes.status === 403 || boardsRes.status === 403) { router.replace("/access-denied"); return; }
    if (wsRes.status === 404 || boardsRes.status === 404) { router.replace("/workspaces"); return; }
    if (wsRes.ok) setWsInfo(await wsRes.json());
    if (boardsRes.ok) setBoards(await boardsRes.json());
    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(data.members ?? []);
      setCanKick(data.canKick ?? false);
    }
    setLoading(false);
  }, [workspaceId, router]);

  useEffect(() => { load(); }, [load]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (openMenu) {
        const el = menuRefs.current.get(openMenu);
        if (el && !el.contains(e.target as Node)) setOpenMenu(null);
      }
      if (showMembersPopover && membersButtonRef.current && !membersButtonRef.current.contains(e.target as Node)) {
        setShowMembersPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu, showMembersPopover]);

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
    copyToClipboard(`${window.location.origin}/board/${boardId}`);
  };

  const openRenameBoard = (boardId: string, name: string) => {
    setOpenMenu(null);
    setRenaming({ id: boardId, name });
    setRenameName(name);
  };

  const kickMember = async (userId: string, discordName: string) => {
    if (!confirm(`${discordName} をワークスペースから削除しますか？\n招待リンクもリセットされます。`)) return;
    setKickingUserId(userId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setShowMembersPopover(false);
        await load();
      }
    } finally {
      setKickingUserId(null);
    }
  };

  const saveRenameBoard = async () => {
    if (!renaming || !renameName.trim()) return;
    setRenameSaving(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/boards/${renaming.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", name: renameName.trim() }),
    });
    setRenameSaving(false);
    if (res.ok) { setRenaming(null); await load(); }
  };

  const isOwner = wsInfo?.ownerUserId === currentUserId;
  const active = boards.filter((b) => !b.deletedAt);
  const trashed = boards.filter((b) => b.deletedAt);
  const list = tab === "active" ? active : trashed;

  return (
    <main className="flex min-h-screen flex-col bg-background bg-grid-subtle">
      {/* ヘッダー（ライト: 白、ダーク: 背景と同系） */}
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-[#25292e]">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Identicon value={workspaceId} size={40} />
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
                  {wsInfo ? wsInfo.name : "ボード一覧"}
                </h1>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <Link href="/workspaces" className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:text-slate-300 dark:hover:text-white">
                  ← ワークスペース一覧に戻る
                </Link>
                <Link href={`/workspace/${workspaceId}/assets`} className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:text-slate-300 dark:hover:text-white">
                  アセット管理 →
                </Link>
                {wsInfo && (
                  <span className="text-xs text-zinc-400 dark:text-slate-400">
                    オーナー: {isOwner ? "自分" : wsInfo.ownerName}
                  </span>
                )}
              </div>
            </div>
            <div ref={membersButtonRef} className="relative">
              <button
                type="button"
                onClick={() => setShowMembersPopover(!showMembersPopover)}
                className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-slate-600 dark:bg-slate-800"
                aria-label="メンバー一覧"
                title="メンバー一覧"
              >
                <div className="flex -space-x-2">
                  {members.slice(0, 8).length === 0 ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs text-zinc-500 dark:bg-slate-600 dark:text-slate-400">—</span>
                  ) : members.slice(0, 8).map((m) => (
                    <div
                      key={m.userId}
                      className="ring-2 ring-zinc-50 dark:ring-slate-800"
                      title={m.discordName}
                    >
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <Identicon value={m.userId} size={28} />
                      )}
                    </div>
                  ))}
                  {members.length > 8 && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs text-zinc-600 dark:bg-slate-600 dark:text-slate-300">
                      +{members.length - 8}
                    </span>
                  )}
                </div>
              </button>

              {showMembersPopover && (
                <div className="absolute right-0 top-full z-30 mt-1 min-w-[200px] rounded-lg border border-zinc-200 bg-white py-2 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                  <p className="px-4 py-1 text-xs font-medium text-zinc-500 dark:text-slate-400">メンバー</p>
                  {members.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-slate-700"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                        ) : (
                          <Identicon value={m.userId} size={32} />
                        )}
                        <span className="truncate text-sm text-zinc-800 dark:text-slate-200">
                          {m.discordName}
                          {m.role === "owner" && (
                            <span className="ml-1 text-zinc-400 dark:text-slate-500">(オーナー)</span>
                          )}
                        </span>
                      </div>
                      {canKick && m.role === "member" && (
                        <button
                          type="button"
                          onClick={() => kickMember(m.userId, m.discordName)}
                          disabled={kickingUserId === m.userId}
                          className="shrink-0 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/50 dark:text-red-400"
                        >
                          {kickingUserId === m.userId ? "削除中..." : "キック"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-slate-600/50">
            <button onClick={() => setTab("active")}
              className={`px-4 py-2 text-sm font-medium ${tab === "active" ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
              アクティブ ({active.length})
            </button>
            <button onClick={() => setTab("trash")}
              className={`px-4 py-2 text-sm font-medium ${tab === "trash" ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
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
        <div className="flex gap-2 rounded-lg border border-zinc-200 p-4 dark:border-slate-600 dark:bg-slate-800/80">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="ボード名"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-slate-500"
          />
          <button onClick={create} disabled={creating || !newName.trim()}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white/20 dark:hover:bg-white/30">
            {creating ? "作成中..." : "作成"}
          </button>
          <button onClick={() => { setShowForm(false); setNewName(""); }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
            キャンセル
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-zinc-400 dark:text-slate-400">読み込み中...</div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-slate-600 dark:text-slate-400">
          {tab === "active" ? "ボードがありません。「+ 新規ボード」から作成してください。" : "ゴミ箱は空です。"}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((b) => (
            <li key={b.id} className="group relative">
              {tab === "active" ? (
                <Link href={`/board/${b.id}`}
                  className="flex flex-col gap-1 rounded-lg border-2 bg-stone-100 p-5 pr-10 transition hover:border-zinc-400 hover:bg-stone-200/50 dark:bg-[#212529] dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
                  style={{ borderColor: getMinidenticonColor(b.id, 45, 58) }}>
                  <div className="flex items-center gap-3">
                    <Identicon value={b.id} size={32} />
                    <span className="font-semibold dark:text-slate-200">{b.name}</span>
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-slate-500">{new Date(b.createdAt).toLocaleDateString("ja-JP")}</span>
                </Link>
              ) : (
                <div className="flex flex-col gap-1 rounded-lg border-2 bg-stone-100 p-5 pr-10 opacity-60 dark:bg-[#212529]"
                  style={{ borderColor: getMinidenticonColor(b.id, 45, 58) }}>
                  <div className="flex items-center gap-3">
                    <Identicon value={b.id} size={32} />
                    <span className="font-semibold dark:text-slate-200">{b.name}</span>
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-slate-500">
                    削除日: {new Date(b.deletedAt!).toLocaleDateString("ja-JP")}
                  </span>
                </div>
              )}

              {/* 三点リーダーメニュー */}
              <div ref={(el) => { if (el) menuRefs.current.set(b.id, el); else menuRefs.current.delete(b.id); }} className="absolute right-2 top-2">
                <button
                  onClick={(e) => { e.preventDefault(); setOpenMenu(openMenu === b.id ? null : b.id); }}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 ${openMenu === b.id ? "bg-zinc-50 ring-1 ring-zinc-300 dark:bg-slate-600 dark:ring-slate-500" : ""}`}
                  aria-label="メニューを開く"
                >
                  <MoreVerticalIcon className="w-5 h-5" />
                </button>

                {openMenu === b.id && (
                  <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 dark:border-slate-600 dark:bg-slate-800">
                    {tab === "active" ? (
                      <>
                        <button
                          onClick={(e) => { e.preventDefault(); openRenameBoard(b.id, b.name); }}
                          className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          名前を変更
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); copyBoardUrl(b.id); setOpenMenu(null); }}
                          className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          {copiedText?.endsWith(`/board/${b.id}`) ? "✓ コピー済み" : "URLをコピー"}
                        </button>
                        <Link
                          href={`/board/${b.id}/trash`}
                          onClick={() => setOpenMenu(null)}
                          className="block px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          アセットのゴミ箱
                        </Link>
                        <Link
                          href={`/board/${b.id}/reaction-preset`}
                          onClick={() => setOpenMenu(null)}
                          className="block px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          リアクション絵文字をカスタマイズ
                        </Link>
                        <div className="my-1 border-t border-zinc-100 dark:border-slate-600" />
                        <button
                          onClick={(e) => { e.preventDefault(); trash(b.id); setOpenMenu(null); }}
                          className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                        >
                          ゴミ箱へ移動
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.preventDefault(); restore(b.id); setOpenMenu(null); }}
                          className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          復元
                        </button>
                        <div className="my-1 border-t border-zinc-100 dark:border-slate-600" />
                        <button
                          onClick={(e) => { e.preventDefault(); deletePermanently(b.id, b.name); setOpenMenu(null); }}
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
