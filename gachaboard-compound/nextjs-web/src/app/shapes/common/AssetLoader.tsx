"use client";

import { useState, useEffect } from "react";
import { POLLING_INTERVAL_ASSET_LOADER } from "@shared/constants";

type Props = {
  assetId: string;
  children: React.ReactNode;
  converted?: boolean;
};

type Status = "loading" | "transcoding" | "ready" | "unavailable";

/**
 * アセットファイルが取得可能になるまでローディング表示を出す共通ラッパー。
 * HEAD 200 → ready、HEAD 202 → 変換中（ポーリング継続）、HEAD 404/410 等 → 利用不可（削除済み等）、HEAD その他 → ローディング継続
 */
export function AssetLoader({ assetId, children, converted }: Props) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    // assetId が空 = アップロード中。親がシェイプを更新するまで待つだけ
    if (!assetId) return;
    let cancelled = false;

    async function check() {
      const url = converted
        ? `/api/assets/${assetId}/file?converted=1`
        : `/api/assets/${assetId}/file`;
      while (!cancelled) {
        try {
          const res = await fetch(url, { method: "HEAD", cache: "no-store" });
          if (res.status === 200) {
            if (!cancelled) setStatus("ready");
            return;
          }
          if (res.status === 202) {
            // 変換中 — 表示を更新してポーリング継続
            if (!cancelled) setStatus("transcoding");
          } else if (res.status === 404 || res.status === 410) {
            // 削除済み・存在しない — ポーリング停止
            if (!cancelled) setStatus("unavailable");
            return;
          }
        } catch {
          // ネットワークエラーは無視してリトライ
        }
        await new Promise((r) => setTimeout(r, POLLING_INTERVAL_ASSET_LOADER));
      }
    }

    check();
    return () => { cancelled = true; };
  }, [assetId, converted]);

  if (status === "ready") return <>{children}</>;

  if (status === "unavailable") {
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
        background: "rgba(0,0,0,0.06)",
        color: "#94a3b8",
        fontSize: 12,
        fontFamily: "system-ui, sans-serif",
      }}>
        <span style={{ opacity: 0.6, fontSize: 16 }}>⚠</span>
        <span>ファイルが削除されたか存在しません</span>
      </div>
    );
  }

  const isTranscoding = status === "transcoding";

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
      // 変換中はサムネイルを背景に薄く表示
      backgroundImage: isTranscoding ? `url(/api/assets/${assetId}/thumbnail)` : undefined,
      backgroundSize: "cover",
      backgroundPosition: "center",
      background: isTranscoding ? undefined : "rgba(0,0,0,0.06)",
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
