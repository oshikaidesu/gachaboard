"use client";

import { useCallback, useEffect, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";

/**
 * Y.Doc の Map を購読し、パース・グループ化した状態を返す汎用フック。
 * BoardCommentProvider / BoardReactionProvider で共通利用。
 */
export function useYMapSync<T, K extends string>(
  provider: HocuspocusProvider | undefined,
  mapKey: string,
  parse: (value: string) => T | null,
  groupBy: (items: T[]) => Map<K, T[]>
): Map<K, T[]> {
  const [grouped, setGrouped] = useState<Map<K, T[]>>(new Map());

  const applyYUpdate = useCallback(
    (yMap: { forEach: (fn: (v: string, k: string) => void) => void }) => {
      const items: T[] = [];
      yMap.forEach((value) => {
        const parsed = parse(value);
        if (parsed) items.push(parsed);
      });
      setGrouped(groupBy(items));
    },
    [parse, groupBy]
  );

  useEffect(() => {
    if (!provider) return;
    const ydoc = provider.document;
    const yMap = ydoc.getMap<string>(mapKey);

    const handler = () => applyYUpdate(yMap);
    handler();
    yMap.observe(handler);
    return () => yMap.unobserve(handler);
  }, [provider, mapKey, applyYUpdate]);

  return grouped;
}
