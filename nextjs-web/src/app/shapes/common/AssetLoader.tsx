"use client";

import { useAssetStatus } from "@/app/hooks/media/useAssetStatus";
import { getSafeAssetId } from "@/lib/safeUrl";

type Props = {
  assetId: string;
  children: React.ReactNode;
  converted?: boolean;
  /** 削除済み表示時にファイル名を表示する（任意） */
  fileName?: string | null;
  /** 動画サムネイルを背景に表示するか（動画のみ true 推奨） */
  showThumbnail?: boolean;
};

/**
 * アセットファイルが取得可能になるまでローディング表示を出す共通ラッパー。
 * HEAD 200 → ready、HEAD 202 → 変換中、HEAD 404/410 等 → 利用不可
 */
export function AssetLoader({ assetId, children, converted, fileName, showThumbnail = false }: Props) {
  const status = useAssetStatus(assetId, converted);

  if (status === "ready") return <>{children}</>;

  if (status === "unavailable") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          borderRadius: 8,
          background: "rgba(0,0,0,0.04)",
          color: "#94a3b8",
          fontSize: 11,
          fontFamily: "system-ui, sans-serif",
          pointerEvents: "auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ opacity: 0.5, fontSize: 24 }}>📄</span>
        {fileName?.trim() && (
          <span style={{ maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName}
          </span>
        )}
      </div>
    );
  }

  const isTranscoding = status === "transcoding";
  const safeId = getSafeAssetId(assetId);
  const thumbUrl = showThumbnail && safeId ? `url(/api/assets/${safeId}/thumbnail)` : "none";

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderRadius: 8,
      backgroundColor: "rgba(0,0,0,0.04)",
      backgroundImage: thumbUrl,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      color: "#94a3b8",
      fontSize: 11,
      fontFamily: "system-ui, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {isTranscoding && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
        }} />
      )}
      <span style={{ opacity: 0.5, fontSize: 24, position: "relative" }}>
        {isTranscoding ? "⏳" : "📄"}
      </span>
      {fileName?.trim() && (
        <span style={{ maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", position: "relative" }}>
          {fileName}
        </span>
      )}
    </div>
  );
}
