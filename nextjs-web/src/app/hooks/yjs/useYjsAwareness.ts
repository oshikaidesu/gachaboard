"use client";

import { useEffect } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { getUserColor } from "@/lib/yjsSyncHelpers";

type UseYjsAwarenessOptions = {
  provider: HocuspocusProvider | undefined;
  userId: string;
  defaultName: string;
  avatarUrl?: string | null;
};

/**
 * マルチカーソル用: Awareness に user を設定。
 * avatarUrl が後から取得された場合も更新する。
 */
export function useYjsAwareness({
  provider,
  userId,
  defaultName,
  avatarUrl,
}: UseYjsAwarenessOptions): void {
  useEffect(() => {
    if (!provider?.awareness || !userId || !defaultName) return;
    const color = getUserColor(userId);
    provider.awareness.setLocalStateField("user", {
      id: userId,
      name: defaultName,
      color,
      avatarUrl: avatarUrl ?? null,
    });
  }, [provider, userId, defaultName, avatarUrl]);
}
