"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { GachaboardLogo } from "@/app/components/ui/GachaboardLogo";
import { ThemeToggle } from "@/app/components/theme/ThemeToggle";
import { TwemojiImg } from "@/app/components/ui/Twemoji";
import { AssetPreviewModal } from "./components/AssetPreviewModal";
import { AssetFilters } from "./components/AssetFilters";
import {
  AssetListItem,
  type Asset,
} from "./components/AssetListItem";

export default function AssetsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [preview, setPreview] = useState<Asset | null>(null);
  const [search, setSearch] = useState("");
  const [filterBoard, setFilterBoard] = useState("");
  const [filterKind, setFilterKind] = useState("");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const res = await fetch(
      `/api/assets?workspaceId=${workspaceId}&${tab === "trash" ? "trash=1" : ""}`
    );
    if (res.ok) setAssets(await res.json());
    setLoading(false);
  }, [workspaceId, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const trash = async (id: string) => {
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trash" }),
    });
    await load();
  };

  const restore = async (id: string) => {
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    await load();
  };

  const deletePermanently = async (id: string, name: string) => {
    if (!confirm(`「${name}」を完全に削除しますか？`)) return;
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    await load();
  };

  const filteredAssets = assets.filter((a) => {
    const q = search.trim().toLowerCase();
    if (q && !a.fileName.toLowerCase().includes(q)) return false;
    if (filterBoard) {
      if (filterBoard === "__none__" && a.board !== null) return false;
      if (filterBoard === "__none__" && a.board === null) return true;
      if (filterBoard !== "__none__" && a.board?.id !== filterBoard)
        return false;
    }
    if (filterKind && a.kind !== filterKind) return false;
    return true;
  });

  const boardOptions = Array.from(
    new Map(
      assets
        .filter((a) => a.board)
        .map((a) => [a.board!.id, { id: a.board!.id, name: a.board!.name }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="flex min-h-screen flex-col bg-background bg-grid-subtle">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-[#25292e]">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <GachaboardLogo size="md" href={`/workspace/${workspaceId}`} />
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
                アセット管理
              </h1>
              <Link
                href={`/workspace/${workspaceId}`}
                className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:text-slate-300 dark:hover:text-white"
              >
                ← ボード一覧に戻る
              </Link>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div className="mx-auto mt-3 flex max-w-5xl gap-2 border-t border-zinc-200 pt-3 dark:border-slate-600/50">
          {(["active", "trash"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium ${
                tab === t
                  ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t === "active" ? (
                "アクティブ"
              ) : (
                <>
                  <TwemojiImg
                    emoji="🗑"
                    size={14}
                    style={{ verticalAlign: "text-bottom" }}
                  />{" "}
                  ゴミ箱
                </>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-8">
        {preview && workspaceId && (
          <AssetPreviewModal
            asset={preview}
            workspaceId={workspaceId}
            onClose={() => setPreview(null)}
          />
        )}

        {!loading && assets.length > 0 && (
          <AssetFilters
            search={search}
            onSearchChange={setSearch}
            filterBoard={filterBoard}
            onFilterBoardChange={setFilterBoard}
            filterKind={filterKind}
            onFilterKindChange={setFilterKind}
            boardOptions={boardOptions}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-400 dark:text-slate-400">
            読み込み中...
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-slate-600 dark:text-slate-400">
            {tab === "active"
              ? "アセットがありません。ボードにファイルをドロップしてアップロードしてください。"
              : "ゴミ箱は空です。"}
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-slate-600 dark:text-slate-400">
            条件に一致するアセットがありません。
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filteredAssets.map((a) => (
              <AssetListItem
                key={a.id}
                asset={a}
                tab={tab}
                onPreview={setPreview}
                onTrash={trash}
                onRestore={restore}
                onDeletePermanently={deletePermanently}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
