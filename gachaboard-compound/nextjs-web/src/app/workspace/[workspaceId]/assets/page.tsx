"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MediaPlayer from "@/app/components/ui/MediaPlayer";
import { TwemojiImg } from "@/app/components/ui/Twemoji";

type Asset = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: string;
  deletedAt: string | null;
  createdAt: string;
  uploader: { name: string | null; image: string | null };
  board?: { id: string; name: string } | null;
};

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "すべての種類" },
  { value: "image", label: "画像" },
  { value: "gif", label: "GIF" },
  { value: "video", label: "動画" },
  { value: "audio", label: "音声" },
  { value: "file", label: "その他" },
];

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
    setLoading(true);
    const res = await fetch(`/api/assets?workspaceId=${workspaceId}&${tab === "trash" ? "trash=1" : ""}`);
    if (res.ok) setAssets(await res.json());
    setLoading(false);
  }, [workspaceId, tab]);

  useEffect(() => { load(); }, [load]);

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

  const formatSize = (bytes: string) => {
    const n = Number(bytes);
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(1)}GB`;
  };

  const isMedia = (a: Asset) => a.kind === "image" || a.kind === "video" || a.kind === "audio" || a.kind === "gif";

  // 検索・フィルタ適用
  const filteredAssets = assets.filter((a) => {
    const q = search.trim().toLowerCase();
    if (q && !a.fileName.toLowerCase().includes(q)) return false;
    if (filterBoard) {
      if (filterBoard === "__none__" && a.board !== null) return false;
      if (filterBoard === "__none__" && a.board === null) return true;
      if (filterBoard !== "__none__" && a.board?.id !== filterBoard) return false;
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

  const fileIcon = (a: Asset) => {
    if (a.kind === "video") return "🎬";
    if (a.kind === "audio") return "🎵";
    const ext = a.fileName.split(".").pop()?.toLowerCase() ?? "";
    if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) return "🗜️";
    if (["pdf"].includes(ext)) return "📕";
    if (["doc", "docx"].includes(ext)) return "📝";
    if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
    if (["ppt", "pptx"].includes(ext)) return "📊";
    if (["txt", "md", "log"].includes(ext)) return "📄";
    if (["json", "yaml", "yml", "toml", "xml"].includes(ext)) return "🔧";
    if (["js", "ts", "py", "go", "rs", "cpp", "c", "java"].includes(ext)) return "💻";
    if (["exe", "dmg", "pkg", "deb", "rpm"].includes(ext)) return "⚙️";
    if (["stem", "als", "flp", "ptx", "logic"].includes(ext)) return "🎛️";
    return "📦";
  };

  return (
    <main className="flex min-h-screen flex-col bg-background bg-grid-subtle">
      {/* ヘッダー（ライト: 白、ダーク: 背景と同系） */}
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-[#25292e]">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">アセット管理</h1>
            <Link href={`/workspace/${workspaceId}`} className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:text-slate-300 dark:hover:text-white">
              ← ボード一覧に戻る
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-3 flex max-w-5xl gap-2 border-t border-zinc-200 pt-3 dark:border-slate-600/50">
          {(["active", "trash"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
              {t === "active" ? "アクティブ" : <><TwemojiImg emoji="🗑" size={14} style={{ verticalAlign: "text-bottom" }} /> ゴミ箱</>}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-8">

      {/* プレビューモーダル */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80" onClick={() => setPreview(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:border dark:border-slate-600 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            {preview.kind === "image" || preview.kind === "gif" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/assets/${preview.id}/file`} alt={preview.fileName} className="max-h-[70vh] w-full object-contain rounded" />
            ) : (preview.kind === "video" || preview.kind === "audio") ? (
              <MediaPlayer
                assetId={preview.id}
                mimeType={preview.mimeType}
                fileName={preview.fileName}
                workspaceId={workspaceId}
                isConverted={preview.mimeType === "audio/wav"}
              />
            ) : (
              <p className="text-sm text-zinc-500 dark:text-slate-400">プレビューできないファイルです。</p>
            )}
            <button onClick={() => setPreview(null)} className="mt-4 text-sm text-zinc-400 hover:text-zinc-600 dark:text-slate-400 dark:hover:text-slate-300">閉じる</button>
          </div>
        </div>
      )}

      {/* 検索・フィルタ */}
      {!loading && assets.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="ファイル名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1 rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-zinc-500"
          />
          <select
            value={filterBoard}
            onChange={(e) => setFilterBoard(e.target.value)}
            className="rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-100 dark:focus:border-zinc-500"
          >
            <option value="">すべてのボード</option>
            <option value="__none__">未配置</option>
            {boardOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            className="rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-100 dark:focus:border-zinc-500"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value || "_all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {(search || filterBoard || filterKind) && (
            <button
              onClick={() => { setSearch(""); setFilterBoard(""); setFilterKind(""); }}
              className="text-xs text-zinc-500 hover:underline dark:text-slate-400 dark:hover:text-slate-300"
            >
              クリア
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-zinc-400 dark:text-slate-400">読み込み中...</div>
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
            <li
              key={a.id}
              className={`flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50 ${tab === "trash" ? "opacity-60" : ""}`}
            >
              {/* 簡易プレビュー（画像・動画はサムネイル、動画は変換済みを再生） */}
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-700 ${isMedia(a) ? "cursor-pointer" : ""}`}
                onClick={() => isMedia(a) && setPreview(a)}
              >
                {(a.kind === "image" || a.kind === "gif") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/assets/${a.id}/file`} alt="" className="h-full w-full object-cover" />
                ) : a.kind === "video" ? (
                  // 動画: サムネイル（.mov 等は変換済み mp4 を再生）
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/assets/${a.id}/thumbnail`} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }} />
                ) : null}
                {(a.kind !== "image" && a.kind !== "gif") && (
                  <span className={a.kind === "video" ? "hidden" : ""}>
                    <TwemojiImg emoji={fileIcon(a)} size={24} />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-medium dark:text-slate-200 ${isMedia(a) ? "cursor-pointer hover:underline" : ""}`}
                  title={a.fileName}
                  onClick={() => isMedia(a) && setPreview(a)}
                >
                  {a.fileName}
                </p>
                <p className="text-xs text-zinc-400 dark:text-slate-500">
                  {formatSize(a.sizeBytes)} · {a.uploader.name}
                  {a.board && (
                    <>
                      {" · "}
                      <Link href={`/board/${a.board.id}`} className="hover:underline">
                        {a.board.name}
                      </Link>
                    </>
                  )}
                  {a.board === null && " · 未配置"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {tab === "active" && (
                  <a
                    href={`/api/assets/${a.id}/file?download=1`}
                    download={a.fileName}
                    className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    DL
                  </a>
                )}
                {tab === "active" ? (
                  <button onClick={() => trash(a.id)}
                    className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:border-slate-600 dark:hover:bg-red-950/50 dark:hover:text-red-400">
                    ゴミ箱へ
                  </button>
                ) : (
                  <>
                    <button onClick={() => restore(a.id)}
                      className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-green-50 hover:text-green-600 dark:border-slate-600 dark:hover:bg-green-950/50 dark:hover:text-green-400">
                      復元
                    </button>
                    <button onClick={() => deletePermanently(a.id, a.fileName)}
                      className="rounded border border-zinc-200 px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:hover:bg-red-950/50 dark:hover:text-red-300">
                      完全削除
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
    </main>
  );
}
