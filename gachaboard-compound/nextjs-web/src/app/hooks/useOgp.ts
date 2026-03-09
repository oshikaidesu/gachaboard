"use client";

import { useEffect, useState } from "react";
import type { OgpData } from "@shared/apiTypes";
import { OGP_CACHE_LIMIT } from "@shared/constants";

const ogpCache = new Map<string, OgpData>();

function ogpCacheSet(key: string, value: OgpData) {
  if (ogpCache.size >= OGP_CACHE_LIMIT) {
    const oldest = ogpCache.keys().next().value;
    if (oldest !== undefined) ogpCache.delete(oldest);
  }
  ogpCache.set(key, value);
}

async function fetchOgpData(url: string): Promise<OgpData> {
  if (ogpCache.has(url)) return ogpCache.get(url)!;
  try {
    const res = await fetch(`/api/ogp?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const data = (await res.json()) as OgpData;
      ogpCacheSet(url, data);
      return data;
    }
  } catch {
    // フェッチ失敗
  }
  const fallback: OgpData = { url };
  ogpCacheSet(url, fallback);
  return fallback;
}

export function useOgp(url: string | null): { data: OgpData | null; loading: boolean } {
  const [data, setData] = useState<OgpData | null>(() =>
    url && ogpCache.has(url) ? ogpCache.get(url)! : null
  );
  const [loading, setLoading] = useState(!!url && !(url && ogpCache.has(url)));

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOgpData(url).then((d) => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [url]);

  return { data, loading };
}
