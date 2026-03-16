"use client";

import {
  createTLStore,
  TLStoreWithStatus,
  type TLAnyShapeUtilConstructor,
} from "@cmpd/editor";
import { defaultShapeUtils } from "@cmpd/compound";
import type { TLRecord } from "@cmpd/tlschema";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
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
  /** sync-server ゲート用。undefined=取得中, string=接続時に渡す, null=トークンなしで接続 */
  syncToken?: string | null;
};

/**
 * compound TLStore と Yjs Y.Doc を双方向バインドするフック。
 * 公式パターン（https://tiptap.dev/docs/hocuspocus/guides/collaborative-editing）:
 * 1. ydoc 作成
 * 2. IndexeddbPersistence(roomId, ydoc) - オフライン永続化
 * 3. HocuspocusProvider({ url, name: roomId, document: ydoc }) - WebSocket 同期
 * docName を統一し、同一 ydoc を両 provider で共有。
 */
export function useYjsStore({
  roomId,
  wsUrl,
  shapeUtils,
  defaultName = "",
  userId = "",
  avatarUrl,
  fetchSnapshotWhenEmpty,
  syncToken,
}: UseYjsStoreOptions): TLStoreWithStatus & { provider?: HocuspocusProvider } {
  const [status, setStatusRaw] = useState<
    TLStoreWithStatus["status"] extends infer S ? S : never
  >("loading");
  const [connectionStatus, setConnectionStatus] = useState<
    "online" | "offline"
  >("offline");
  const [error, setError] = useState<Error | null>(null);
  const storeRef = useRef<ReturnType<typeof createTLStore> | null>(null);
  const isLocalUpdateRef = useRef(false);
  const offlineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setConnectionStatusDebounced = useCallback((next: "online" | "offline") => {
    if (next === "online") {
      if (offlineDebounceRef.current) {
        clearTimeout(offlineDebounceRef.current);
        offlineDebounceRef.current = null;
      }
      setConnectionStatus("online");
    } else {
      if (offlineDebounceRef.current) return;
      offlineDebounceRef.current = setTimeout(() => {
        offlineDebounceRef.current = null;
        setConnectionStatus("offline");
      }, 2000);
    }
  }, []);

  // IndexedDB 同期後に "synced-remote" になったら "loading" へ戻さない
  const setStatus = useMemo(() => {
    const fn = (next: "loading" | "synced-remote") => {
      setStatusRaw((prev) => {
        if (prev === "synced-remote" && next === "loading") return prev;
        return next;
      });
    };
    return fn;
  }, []);

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

  const getStoreRef = useRef(getStore);
  const setConnectionStatusRef = useRef(setConnectionStatusDebounced);
  const setStatusRef = useRef(setStatus);
  const setErrorRef = useRef(setError);
  getStoreRef.current = getStore;
  setConnectionStatusRef.current = setConnectionStatusDebounced;
  setStatusRef.current = setStatus;
  setErrorRef.current = setError;

  // 1. ydoc 作成 + IndexeddbPersistence(roomId, ydoc)
  const ydoc = useYjsPersistence({
    roomId,
    wsUrl,
    getStore: getStore as () => { put: (r: TLRecord[]) => void; mergeRemoteChanges: (fn: () => void) => void; has: (id: unknown) => boolean },
    fetchSnapshotWhenEmpty,
    onSynced: () => setStatus("synced-remote"),
    isLocalUpdateRef,
  });

  // 2. store を事前作成（useYjsSync 実行時に確実に存在させる）
  useEffect(() => {
    if (ydoc && syncToken !== undefined) {
      getStore();
    }
  }, [ydoc, syncToken, getStore]);

  // 3. HocuspocusProvider({ url, name: roomId, document: ydoc })
  const provider = useYjsSync({
    roomId,
    wsUrl,
    ydoc,
    getStoreRef: getStoreRef as RefObject<() => StoreLike>,
    setConnectionStatusRef,
    setStatusRef,
    setErrorRef,
    isLocalUpdateRef,
    syncToken,
  });

  useEffect(() => {
    return () => {
      if (offlineDebounceRef.current) {
        clearTimeout(offlineDebounceRef.current);
        offlineDebounceRef.current = null;
      }
    };
  }, []);

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
