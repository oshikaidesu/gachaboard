"use client";

import { useBoardContext } from "@/app/components/board/BoardContext";
import { useAssetStatus } from "@/app/hooks/media/useAssetStatus";
import { getSafeAssetId } from "@/lib/safeUrl";

type Props = {
  assetId: string;
  children: React.ReactNode;
  converted?: boolean;
  /** 削除済み表示時にファイル名を表示する（任意） */
  fileName?: string | null;
};

/**
 * アセットファイルが取得可能になるまでローディング表示を出す共通ラッパー。
 * HEAD 200 → ready、HEAD 202 → 変換中、HEAD 404/410 等 → 利用不可
 */
export function AssetLoader({ assetId, children, converted, fileName }: Props) {
  const status = useAssetStatus(assetId, converted);
  const { boardId, workspaceId } = useBoardContext();

  if (status === "ready") return <>{children}</>;

  if (status === "unavailable") {
    const showRestoreLink = boardId && workspaceId;
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 8,
          background: "rgba(0,0,0,0.06)",
          color: "#94a3b8",
          fontSize: 12,
          fontFamily: "system-ui, sans-serif",
          pointerEvents: "auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ opacity: 0.6, fontSize: 16 }}>⚠</span>
        <span>ファイルが削除されたか存在しません</span>
        {fileName?.trim() && (
          <span style={{ fontSize: 11, opacity: 0.9, maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            「{fileName}」
          </span>
        )}
        {showRestoreLink && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `/board/${boardId}/trash`;
            }}
            className="mt-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
            style={{ pointerEvents: "auto", position: "relative", zIndex: 2 }}
          >
            ゴミ箱から復元する
          </button>
        )}
      </div>
    );
  }

  const isTranscoding = status === "transcoding";
  const safeId = getSafeAssetId(assetId);
  const thumbUrl = isTranscoding && safeId ? `url(/api/assets/${safeId}/thumbnail)` : "none";

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 8,
      backgroundColor: isTranscoding ? "transparent" : "rgba(0,0,0,0.06)",
      backgroundImage: thumbUrl,
      backgroundSize: isTranscoding && safeId ? "cover" : undefined,
      backgroundPosition: isTranscoding && safeId ? "center" : undefined,
      backgroundRepeat: "no-repeat",
      color: "#94a3b8",
      fontSize: 12,
      fontFamily: "system-ui, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {isTranscoding && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
        }} />
      )}
      {isTranscoding ? (
        <>
          <TranscodingSpinner />
          <span style={{ color: "#e2e8f0", fontWeight: 500, position: "relative" }}>変換中...</span>
          <span style={{ fontSize: 10, color: "#cbd5e1", position: "relative" }}>再生用に最適化しています</span>
        </>
      ) : (
        <>
          <span style={{ opacity: 0.6, fontSize: 16 }}>⏳</span>
          <span>読み込み中...</span>
        </>
      )}
    </div>
  );
}

function TranscodingSpinner() {
  return (
    <div style={{
      width: 32,
      height: 32,
      border: "3px solid #e2e8f0",
      borderTop: "3px solid #6366f1",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
