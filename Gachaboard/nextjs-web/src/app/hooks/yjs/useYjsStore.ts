"use client";

import {
  createTLStore,
  TLStoreWithStatus,
  type TLAnyShapeUtilConstructor,
} from "@cmpd/editor";
import { defaultShapeUtils } from "@cmpd/compound";
import type { TLRecord } from "@cmpd/tlschema";
import { useCallback, useRef, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import { useYjsPersistence } from "./useYjsPersistence";
import { useYjsSync, type StoreLike } from "./useYjsSync";
import { useYjsAwareness } from "./useYjsAwareness";

type UseYjsStoreOptions = {
  roomId: string;
  wsUrl: string;
  shapeUtils: readonly TLAnyShapeUtilConstructor[];
  defaultName?: string;
  userId?: string;
  avatarUrl?: string | null;
  fetchSnapshotWhenEmpty?: () => Promise<{
    records: TLRecord[];
    reactions?: Record<string, string>;
    comments?: Record<string, string>;
    reactionEmojiPreset?: string[] | null;
  }>;
};

/**
 * compound TLStore と Yjs Y.Doc を双方向バインドするフック。
 * useYjsPersistence / useYjsSync / useYjsAwareness を構成。
 */
export function useYjsStore({
  roomId,
  wsUrl,
  shapeUtils,
  defaultName = "",
  userId = "",
  avatarUrl,
  fetchSnapshotWhenEmpty,
}: UseYjsStoreOptions): TLStoreWithStatus & { provider?: WebsocketProvider } {
  const [status, setStatus] = useState<
    TLStoreWithStatus["status"] extends infer S ? S : never
  >("loading");
  const [connectionStatus, setConnectionStatus] = useState<
    "online" | "offline"
  >("offline");
  const [error] = useState<Error | null>(null);
  const storeRef = useRef<ReturnType<typeof createTLStore> | null>(null);
  const isLocalUpdateRef = useRef(false);

  const getStore = useCallback(() => {
    if (!storeRef.current) {
      const customTypes = new Set(
        shapeUtils.map((u) => (u as { type: string }).type)
      );
      const filteredDefaults = defaultShapeUtils.filter(
        (u) => !customTypes.has((u as { type: string }).type)
      );
      storeRef.current = createTLStore({
        shapeUtils: [...filteredDefaults, ...shapeUtils],
        defaultName,
      });
    }
    return storeRef.current;
  }, [shapeUtils, defaultName]);

  const ydoc = useYjsPersistence({
    roomId,
    wsUrl,
    getStore: getStore as () => { put: (r: TLRecord[]) => void; mergeRemoteChanges: (fn: () => void) => void; has: (id: unknown) => boolean },
    fetchSnapshotWhenEmpty,
    onSynced: () => setStatus("synced-remote"),
    isLocalUpdateRef,
  });

  const provider = useYjsSync({
    roomId,
    wsUrl,
    ydoc,
    getStore: getStore as unknown as () => StoreLike,
    setConnectionStatus,
    setStatus,
    isLocalUpdateRef,
  });

  useYjsAwareness({
    provider,
    userId,
    defaultName,
    avatarUrl,
  });

  if (error) {
    return { status: "error", error };
  }
  if (status === "loading") {
    return { status: "loading" };
  }
  return {
    status: "synced-remote",
    connectionStatus,
    store: getStore(),
    provider,
  };
}
