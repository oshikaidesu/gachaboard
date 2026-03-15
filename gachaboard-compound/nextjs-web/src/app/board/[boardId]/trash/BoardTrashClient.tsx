"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GachaboardLogo } from "@/app/components/ui/GachaboardLogo";
import { ThemeToggle } from "@/app/components/theme/ThemeToggle";
import { TwemojiImg } from "@/app/components/ui/Twemoji";
import { useRouter } from "next/navigation";
import { formatFileSize } from "@shared/utils";
import { getFileEmoji } from "@/app/shapes";

type TrashAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: string;
  deletedAt: string;
  lastKnownX: number | null;
  lastKnownY: number | null;
  uploader: { name: string | null; image: string | null };
};

type SortKey = "deletedAt_desc" | "deletedAt_asc" | "size_desc" | "size_asc";

type ConfirmState = {
  ids: string[];
  totalBytes: number;
  onConfirm: () => void;
};

type Props = {
  boardId: string;
  boardName: string;
  workspaceId: string;
};

// ---- 削除確認モーダル --------------------------------------------------------

function ConfirmDeleteModal({
  state,
  onClose,
}: {
  state: ConfirmState;
  onClose: () => void;
}) {
  const count = state.ids.length;
  const size = formatFileSize(state.totalBytes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:border dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">本当に削除しますか？</h2>
        <p className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">
          {count} 件（{size}）を完全に削除します。
        </p>
        <p className="mb-6 text-sm font-medium text-red-500 dark:text-red-400">この操作は取り消せません。</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            いいえ、戻る
          </button>
          <button
            onClick={() => { state.onConfirm(); onClose(); }}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
          >
            はい、削除する
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- ユーティリティ ----------------------------------------------------------

function sortAssets(assets: TrashAsset[], key: SortKey): TrashAsset[] {
  return [...assets].sort((a, b) => {
    switch (key) {
      case "deletedAt_desc": return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
      case "deletedAt_asc":  return new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
      case "size_desc":      return Number(b.sizeBytes) - Number(a.sizeBytes);
      case "size_asc":       return Number(a.sizeBytes) - Number(b.sizeBytes);
    }
  });
}

// ---- メインコンポーネント ----------------------------------------------------

export default function BoardTrashClient({ boardId, boardName, workspaceId }: Props) {
  const router = useRouter();
  const [assets, setAssets] = useState<TrashAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("deletedAt_desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [actionState, setActionState] = useState<{ id: string; type: "restoring" | "deleting" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    const res = await fetch(`/api/assets?boardId=${boardId}&trash=1`);
    if (res.ok) {
      const data = await res.json();
      setAssets(data);
    }
    setLoading(false);
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  const sorted = sortAssets(assets, sortKey);
  const totalBytes = assets.reduce((sum, a) => sum + Number(a.sizeBytes), 0);

  // ---- 選択操作 ---------------------------------------------------------------

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((a) => a.id)));
    }
  };

  // ---- 復元 -------------------------------------------------------------------

  const restore = async (id: string) => {
    setActionState({ id, type: "restoring" });
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    setActionState(null);
    // 復元後にボードへ遷移し、クエリパラメータでシェイプ再配置をトリガー
    router.push(`/board/${boardId}?restoreAsset=${id}`);
  };

  const restoreSelected = async () => {
    const ids = [...selected];
    for (const id of ids) {
      setActionState({ id, type: "restoring" });
      await fetch(`/api/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
    }
    setActionState(null);
    // 複数復元後にボードへ遷移し、クエリパラメータでシェイプ再配置をトリガー
    router.push(`/board/${boardId}?restoreAssets=${ids.join(",")}`);
  };

  // ---- 個別削除 ---------------------------------------------------------------

  const requestDelete = (ids: string[]) => {
    const totalBytes = assets
      .filter((a) => ids.includes(a.id))
      .reduce((sum, a) => sum + Number(a.sizeBytes), 0);

    setConfirm({
      ids,
      totalBytes,
      onConfirm: () => executeDelete(ids),
    });
  };

  const executeDelete = async (ids: string[]) => {
    for (const id of ids) {
      setActionState({ id, type: "deleting" });
      await fetch(`/api/assets/${id}`, { method: "DELETE" });
    }
    setActionState(null);
    await load();
  };

  // ---- レンダリング -----------------------------------------------------------

  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const someSelected = selected.size > 0;

  return (
    <>
      {confirm && (
        <ConfirmDeleteModal
          state={confirm}
          onClose={() => setConfirm(null)}
        />
      )}

      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 bg-background p-8">
        {/* ヘッダー */}
        <header className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GachaboardLogo size="md" href={`/board/${boardId}`} />
              <h1 className="text-2xl font-semibold dark:text-zinc-100">アセットのゴミ箱</h1>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
              href={`/board/${boardId}`}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← ボードに戻る
            </Link>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ボード:{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{boardName}</span>
          </p>
        </header>

        {/* 統計バー */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {assets.length} 件
          </span>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            合計 {formatFileSize(totalBytes)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {/* 並び替え */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-500"
            >
              <option value="deletedAt_desc">削除日: 新しい順</option>
              <option value="deletedAt_asc">削除日: 古い順</option>
              <option value="size_desc">サイズ: 大きい順</option>
              <option value="size_asc">サイズ: 小さい順</option>
            </select>
          </div>
        </div>

        {/* 一括操作バー */}
        {sorted.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 cursor-pointer rounded"
              />
              {allSelected ? "全選択解除" : "全選択"}
            </label>
            {someSelected && (
              <>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{selected.size} 件選択中</span>
                <button
                  onClick={restoreSelected}
                  className="ml-auto rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  選択した {selected.size} 件を復元
                </button>
                <button
                  onClick={() => requestDelete([...selected])}
                  className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600"
                >
                  選択した {selected.size} 件を削除
                </button>
              </>
            )}
          </div>
        )}

        {/* アセット一覧 */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-400 dark:text-zinc-500">
            読み込み中...
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
            ゴミ箱は空です。
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((a) => {
              const isActing = actionState?.id === a.id;
              const bytes = Number(a.sizeBytes);

              return (
                <li
                  key={a.id}
                  className={`flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-900 ${
                    selected.has(a.id) ? "border-zinc-400 bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-800" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggleSelect(a.id)}
                    className="h-4 w-4 cursor-pointer rounded"
                  />
                  <span className="inline-flex items-center leading-none"><TwemojiImg emoji={getFileEmoji(a.fileName, a.kind)} size={28} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200" title={a.fileName}>
                      {a.fileName}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatFileSize(bytes)}
                      {" · "}
                      削除日: {new Date(a.deletedAt).toLocaleDateString("ja-JP")}
                      {a.lastKnownX !== null && (
                        <span className="ml-1 text-zinc-300">
                          (x: {Math.round(a.lastKnownX)}, y: {Math.round(a.lastKnownY ?? 0)})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => restore(a.id)}
                      disabled={isActing}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      {isActing && actionState?.type === "restoring" ? "復元中..." : "復元"}
                    </button>
                    <button
                      onClick={() => requestDelete([a.id])}
                      disabled={isActing}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      {isActing && actionState?.type === "deleting" ? "削除中..." : "削除"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* フッター */}
        <div className="mt-auto pt-4 text-center">
          <Link
            href={`/workspace/${workspaceId}`}
            className="text-xs text-zinc-400 hover:underline dark:text-zinc-500 dark:hover:text-zinc-400"
          >
            ← ワークスペースに戻る
          </Link>
        </div>
      </main>
    </>
  );
}
