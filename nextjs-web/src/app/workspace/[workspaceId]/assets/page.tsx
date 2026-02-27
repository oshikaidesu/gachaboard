"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MediaPlayer from "@/app/components/MediaPlayer";

type Asset = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: string;
  deletedAt: string | null;
  createdAt: string;
  uploader: { name: string | null; image: string | null };
};

export default function AssetsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Asset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/assets?workspaceId=${workspaceId}&${tab === "trash" ? "trash=1" : ""}`);
    if (res.ok) setAssets(await res.json());
    setLoading(false);
  }, [workspaceId, tab]);

  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.size > 0 && f.type !== "");
    if (fileArray.length === 0) return;
    setUploading(true);
    for (const file of fileArray) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("workspaceId", workspaceId);
      await fetch("/api/assets", { method: "POST", body: fd });
    }
    await load();
    setUploading(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (tab !== "active" || uploading) return;
    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry?.();
        // ディレクトリは無視
        if (entry?.isDirectory) continue;
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) await upload(files);
  };

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
    <main
      className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-8"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">アセット管理</h1>
          <Link href={`/workspace/${workspaceId}`} className="text-xs text-zinc-400 hover:underline">
            ← ボード一覧に戻る
          </Link>
        </div>
        {tab === "active" && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              {uploading ? "アップロード中..." : "+ アップロード"}
            </button>
            <span className="text-xs text-zinc-400">またはここにファイルをドロップ</span>
          </div>
        )}
        {/* webkitdirectory を付けないことでディレクトリ選択を防ぐ */}
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </header>

      <div className="flex gap-2 border-b border-zinc-200">
        {(["active", "trash"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-black text-black" : "text-zinc-400 hover:text-zinc-600"}`}>
            {t === "active" ? "アクティブ" : "🗑 ゴミ箱"}
          </button>
        ))}
      </div>

      {/* プレビューモーダル */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPreview(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
              <p className="text-sm text-zinc-500">プレビューできないファイルです。</p>
            )}
            <button onClick={() => setPreview(null)} className="mt-4 text-sm text-zinc-400 hover:text-zinc-600">閉じる</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-zinc-400">読み込み中...</div>
      ) : assets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          {tab === "active"
            ? "アセットがありません。「+ アップロード」またはファイルをここにドロップしてください。"
            : "ゴミ箱は空です。"}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <div key={a.id} className={`group relative rounded-lg border border-zinc-200 p-4 ${tab === "trash" ? "opacity-60" : ""}`}>
              {/* サムネイル */}
              <div
                className={`mb-3 flex h-32 items-center justify-center rounded bg-zinc-100 overflow-hidden ${isMedia(a) ? "cursor-pointer" : ""}`}
                onClick={() => isMedia(a) && setPreview(a)}
              >
                {a.kind === "image" || a.kind === "gif" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/assets/${a.id}/file`} alt={a.fileName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl">{fileIcon(a)}</span>
                )}
              </div>

              <p className="truncate text-sm font-medium" title={a.fileName}>{a.fileName}</p>
              <p className="text-xs text-zinc-400">{formatSize(a.sizeBytes)} · {a.uploader.name}</p>

              <div className="mt-2 flex gap-1 flex-wrap">
                {tab === "active" && (
                  <a
                    href={`/api/assets/${a.id}/file`}
                    download={a.fileName}
                    className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    DL
                  </a>
                )}
                {tab === "active" ? (
                  <button onClick={() => trash(a.id)}
                    className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500">
                    ゴミ箱へ
                  </button>
                ) : (
                  <>
                    <button onClick={() => restore(a.id)}
                      className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-green-50 hover:text-green-600">
                      復元
                    </button>
                    <button onClick={() => deletePermanently(a.id, a.fileName)}
                      className="rounded border border-zinc-200 px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600">
                      完全削除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
