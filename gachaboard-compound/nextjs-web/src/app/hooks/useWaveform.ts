"use client";

import { useState, useEffect } from "react";

type WaveformStatus = "loading" | "ready" | "error";

type WaveformResult = {
  peaks: number[];
  status: WaveformStatus;
};

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 5;

/**
 * 波形 JSON を取得。アップロード直後は波形が非同期生成中のため 404 になることがある。
 * 404 の場合はリトライする。
 */
async function fetchWaveformWithRetry(
  assetId: string,
  signal: AbortSignal
): Promise<{ peaks: number[] }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`/api/assets/${assetId}/waveform`, { signal });
    if (res.ok) {
      return res.json() as Promise<{ peaks: number[] }>;
    }
    if (res.status === 404 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error("Max retries exceeded");
}

export function useWaveform(assetId: string): WaveformResult {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [status, setStatus] = useState<WaveformStatus>("loading");

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    const controller = new AbortController();
    setStatus("loading");
    setPeaks([]);

    fetchWaveformWithRetry(assetId, controller.signal)
      .then((data) => {
        if (cancelled) return;
        setPeaks(data.peaks ?? []);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.name === "AbortError") return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [assetId]);

  return { peaks, status };
}
