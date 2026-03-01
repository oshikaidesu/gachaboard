"use client";

import { useState, useEffect } from "react";

type WaveformStatus = "loading" | "ready" | "error";

type WaveformResult = {
  peaks: number[];
  status: WaveformStatus;
};

export function useWaveform(assetId: string): WaveformResult {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [status, setStatus] = useState<WaveformStatus>("loading");

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    setStatus("loading");
    setPeaks([]);

    fetch(`/api/assets/${assetId}/waveform`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ peaks: number[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setPeaks(data.peaks);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => { cancelled = true; };
  }, [assetId]);

  return { peaks, status };
}
