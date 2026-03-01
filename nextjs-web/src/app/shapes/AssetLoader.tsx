"use client";

import { useState, useEffect } from "react";
import { POLLING_INTERVAL_ASSET_LOADER } from "@shared/constants";

type Props = {
  assetId: string;
  children: React.ReactNode;
};

/**
 * アセットファイルが取得可能になるまでローディング表示を出す共通ラッパー。
 * HEAD リクエストで 200 が返るまでポーリングし、準備完了後に children を表示する。
 */
export function AssetLoader({ assetId, children }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // assetId が空 = アップロード中。親がシェイプを更新するまで待つだけ
    if (!assetId) return;
    let cancelled = false;

    async function check() {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/assets/${assetId}/file`, { method: "HEAD" });
          if (res.ok) {
            if (!cancelled) setReady(true);
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
  }, [assetId]);

  if (!ready) {
    return (
      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 8,
        background: "rgba(0,0,0,0.06)",
        color: "#94a3b8",
        fontSize: 12,
        fontFamily: "system-ui, sans-serif",
      }}>
        <span style={{ opacity: 0.6, fontSize: 16 }}>⏳</span>
        <span>読み込み中...</span>
      </div>
    );
  }

  return <>{children}</>;
}
