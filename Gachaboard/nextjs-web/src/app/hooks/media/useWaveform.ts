"use client";

import { useState, useEffect } from "react";
import pRetry from "p-retry";
import { getSafeAssetId } from "@/lib/safeUrl";

type WaveformStatus = "loading" | "ready" | "error";

type WaveformResult = {
  peaks: number[];
  status: WaveformStatus;
};

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 5;

class Retryable404Error extends Error {
  constructor() {
    super("Waveform not ready (404)");
    this.name = "Retryable404Error";
  }
}

/**
 * 波形 JSON を取得。アップロード直後は波形が非同期生成中のため 404 になることがある。
 * 404 の場合は p-retry でリトライする。
 */
async function fetchWaveformWithRetry(
  assetId: string,
  signal: AbortSignal
): Promise<{ peaks: number[] }> {
  return pRetry(
    async () => {
      const res = await fetch(`/api/assets/${assetId}/waveform`, { signal });
      if (res.ok) {
        return res.json() as Promise<{ peaks: number[] }>;
      }
      if (res.status === 404) {
        throw new Retryable404Error();
      }
      throw new Error(`HTTP ${res.status}`);
    },
    {
      retries: MAX_RETRIES,
      minTimeout: RETRY_DELAY_MS,
      maxTimeout: RETRY_DELAY_MS,
      shouldRetry: ({ error }) => error instanceof Retryable404Error,
      signal,
    }
  );
}

export function useWaveform(assetId: string): WaveformResult {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [status, setStatus] = useState<WaveformStatus>("loading");

  useEffect(() => {
    const safe = getSafeAssetId(assetId);
    if (!safe) return;
    let cancelled = false;
    const controller = new AbortController();
    setStatus("loading");
    setPeaks([]);

    fetchWaveformWithRetry(safe, controller.signal)
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
