"use client";

import { useMemo } from "react";

type YjsStoreResult = {
  status: string;
  connectionStatus?: "online" | "offline";
  error?: Error;
};

export function useSyncStatus(
  useSync: boolean,
  yjsStore: YjsStoreResult
): {
  syncStatus: string | null;
  syncAvailable: boolean;
  isSyncError: boolean;
  isLoading: boolean;
} {
  return useMemo(() => {
    const syncStatus =
      useSync && yjsStore.status === "synced-remote"
        ? yjsStore.connectionStatus === "online"
          ? "同期中"
          : "オフライン"
        : useSync && yjsStore.status === "error"
          ? `同期エラー: ${yjsStore.error?.message ?? "不明"}`
          : useSync && yjsStore.status === "loading"
            ? "接続中..."
            : null;

    const syncAvailable =
      useSync &&
      yjsStore.status === "synced-remote" &&
      yjsStore.connectionStatus === "online";

    const isSyncError = useSync && yjsStore.status === "error";
    const isLoading = useSync && yjsStore.status === "loading";

    return { syncStatus, syncAvailable, isSyncError, isLoading };
  }, [useSync, yjsStore.status, yjsStore.connectionStatus, yjsStore.error]);
}
