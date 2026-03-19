"use client";

import { useEffect, useState } from "react";
import {
  POLLING_INTERVAL_ASSET_LOADER,
  ASSET_404_RETRY_COUNT,
  ASSET_404_RETRY_MS,
} from "@shared/constants";
import { getSafeAssetId } from "@/lib/safeUrl";

export type AssetStatus = "loading" | "transcoding" | "ready" | "unavailable";

/**
 * アセットファイルの取得可否をポーリングで監視。
 * HEAD 200 → ready、HEAD 202 → 変換中、HEAD 404/410 → リトライ後に unavailable
 * 404/410 は一定回数・時間までリトライし、一過性の 404 を吸収する。
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
      let first404At: number | null = null;
      let consecutive404 = 0;

      while (!cancelled) {
        try {
          const res = await fetch(url, { method: "HEAD", cache: "no-store" });
          if (res.status === 200) {
            if (!cancelled) setStatus("ready");
            return;
          }
          if (res.status === 202) {
            if (!cancelled) setStatus("transcoding");
            first404At = null;
            consecutive404 = 0;
          } else if (res.status === 404 || res.status === 410) {
            if (first404At === null) first404At = Date.now();
            consecutive404 += 1;
            const elapsed = Date.now() - first404At;
            if (
              consecutive404 >= ASSET_404_RETRY_COUNT ||
              elapsed >= ASSET_404_RETRY_MS
            ) {
              if (!cancelled) setStatus("unavailable");
              return;
            }
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
