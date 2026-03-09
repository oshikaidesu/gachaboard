"use client";

import { useEffect, useState } from "react";
import { POLLING_INTERVAL_ASSET_LOADER } from "@shared/constants";
import { getSafeAssetId } from "@/lib/safeUrl";

export type AssetStatus = "loading" | "transcoding" | "ready" | "unavailable";

/**
 * アセットファイルの取得可否をポーリングで監視。
 * HEAD 200 → ready、HEAD 202 → 変換中、HEAD 404/410 → unavailable
 */
export function useAssetStatus(assetId: string, converted?: boolean): AssetStatus {
  const [status, setStatus] = useState<AssetStatus>("loading");

  useEffect(() => {
    const safe = getSafeAssetId(assetId);
    if (!safe) return;
    let cancelled = false;

    async function check() {
      const url = converted
        ? `/api/assets/${safe}/file?converted=1`
        : `/api/assets/${safe}/file`;
      while (!cancelled) {
        try {
          const res = await fetch(url, { method: "HEAD", cache: "no-store" });
          if (res.status === 200) {
            if (!cancelled) setStatus("ready");
            return;
          }
          if (res.status === 202) {
            if (!cancelled) setStatus("transcoding");
          } else if (res.status === 404 || res.status === 410) {
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

  return status;
}
