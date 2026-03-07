"use client";

import {
  createTLStore,
  TLStoreWithStatus,
  type TLAnyShapeUtilConstructor,
} from "@cmpd/editor";
import { defaultShapeUtils } from "@cmpd/compound";
import type { TLRecord } from "@cmpd/tlschema";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const LOCAL_ORIGIN = Symbol("local-store");
const CAMERA_LS_PREFIX = "gachaboard-camera:";

function saveCameraToLS(
  store: ReturnType<typeof createTLStore>,
  roomId: string
) {
  try {
    const cameraRecords: Record<string, TLRecord> = {};
    for (const rec of store.allRecords()) {
      if (rec.typeName === "camera" || rec.typeName === "instance_page_state") {
        cameraRecords[rec.id] = rec;
      }
    }
    localStorage.setItem(
      CAMERA_LS_PREFIX + roomId,
      JSON.stringify(cameraRecords)
    );
  } catch {
    // localStorage が使えない環境では無視
  }
}

function restoreCameraFromLS(
  store: ReturnType<typeof createTLStore>,
  roomId: string
) {
  try {
    const raw = localStorage.getItem(CAMERA_LS_PREFIX + roomId);
    if (!raw) return;
    const saved = JSON.parse(raw) as Record<string, TLRecord>;
    const toUpdate: TLRecord[] = [];
    for (const rec of Object.values(saved)) {
      if (store.has(rec.id as TLRecord["id"])) {
        toUpdate.push(rec);
      }
    }
    if (toUpdate.length > 0) {
      store.mergeRemoteChanges(() => {
        store.put(toUpdate);
      });
    }
  } catch {
    // パース失敗等は無視
  }
}

/** RecordsDiff 形式。store.listen の entry.changes の型 */
type RecordsDiffLike = {
  added: Record<string, TLRecord>;
  updated: Record<string, [TLRecord, TLRecord]>;
  removed: Record<string, TLRecord>;
};

/**
 * RecordsDiff を Y.Map に書き込む（per-record 形式）。
 * Yjs が差分のみを送信するためネットワーク効率が向上。
 */
function persistRecordsDiffToY(
  yMap: Y.Map<string>,
  changes: RecordsDiffLike,
  isLocalUpdateRef: { current: boolean },
  ydoc: Y.Doc
) {
  const toPut: TLRecord[] = [];
  const toDelete: string[] = [];

  for (const rec of Object.values(changes.added)) {
    toPut.push(rec);
  }
  for (const [, to] of Object.values(changes.updated)) {
    toPut.push(to);
  }
  for (const id of Object.keys(changes.removed)) {
    toDelete.push(id);
  }

  if (toPut.length === 0 && toDelete.length === 0) return;

  isLocalUpdateRef.current = true;
  ydoc.transact(() => {
    for (const rec of toPut) {
      yMap.set(rec.id, JSON.stringify(rec));
    }
    for (const id of toDelete) {
      yMap.delete(id);
    }
  }, LOCAL_ORIGIN);
  isLocalUpdateRef.current = false;
}

const USER_COLORS = [
  "#FF802B",
  "#EC5E41",
  "#F2555A",
  "#F04F88",
  "#E34BA9",
  "#BD54C6",
  "#9D5BD2",
  "#7B66DC",
  "#02B1CC",
  "#11B3A3",
  "#39B178",
  "#55B467",
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

type UseYjsStoreOptions = {
  roomId: string;
  wsUrl: string;
  shapeUtils: readonly TLAnyShapeUtilConstructor[];
  defaultName?: string;
  /** マルチカーソル用。未指定時は awareness を初期化しない */
  userId?: string;
  /** Discord アバターURL。awareness で他ユーザーに共有 */
  avatarUrl?: string | null;
  /** Y.Doc が空のとき DB からスナップショットを取得して復元する。sync-server 再起動対策 */
  fetchSnapshotWhenEmpty?: () => Promise<TLRecord[]>;
};

/**
 * compound TLStore と Yjs Y.Doc を双方向バインドするフック。
 * Phase 3: マルチプレイヤー同期用。
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
  const [error, setError] = useState<Error | null>(null);
  const storeRef = useRef<ReturnType<typeof createTLStore> | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const isLocalUpdateRef = useRef(false);

  const getStore = useCallback(() => {
    if (!storeRef.current) {
      // カスタム shapeUtils が持つ type を除外してからマージ（重複登録エラー回避）
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

  useEffect(() => {
    if (typeof window === "undefined" || !wsUrl) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const yMap = ydoc.getMap<string>("tldraw");
    const provider = new WebsocketProvider(wsUrl, roomId, ydoc, {
      connect: false, // Strict Mode 対策: 即接続するとアンマウント時に "closed before established" が出る
    });
    providerRef.current = provider;

    const connectTimer = setTimeout(() => provider.connect(), 50);

    // マルチカーソル用: Awareness に user を設定
    if (userId && defaultName) {
      const color = getUserColor(userId);
      provider.awareness.setLocalStateField("user", {
        id: userId,
        name: defaultName,
        color,
        avatarUrl: avatarUrl ?? null,
      });
    }

    const store = getStore();

    // Y.Doc → Store: per-record 形式
    let hasRestoredCamera = false;
    let syncRafScheduled = false;
    const changedKeys = new Set<string>();
    const handleYUpdate = (event: { changes: { keys: Map<string, { action: string }> } }) => {
      if (isLocalUpdateRef.current) return;
      event.changes.keys.forEach((_, key) => changedKeys.add(key));
      if (syncRafScheduled) return;
      syncRafScheduled = true;
      requestAnimationFrame(() => {
        syncRafScheduled = false;
        if (isLocalUpdateRef.current) return;
        const keys = Array.from(changedKeys);
        changedKeys.clear();
        const toPut: TLRecord[] = [];
        const toRemove: TLRecord["id"][] = [];
        for (const key of keys) {
          const raw = yMap.get(key);
          if (raw === undefined) {
            toRemove.push(key as TLRecord["id"]);
          } else {
            try {
              const record = typeof raw === "string" ? JSON.parse(raw) : raw;
              if (record && typeof record === "object" && record.id) {
                toPut.push(record);
              }
            } catch {
              // パース失敗はスキップ
            }
          }
        }
        if (toPut.length > 0 || toRemove.length > 0) {
          store.mergeRemoteChanges(() => {
            if (toRemove.length > 0) store.remove(toRemove);
            if (toPut.length > 0) store.put(toPut);
          });
        }
        if (!hasRestoredCamera) {
          restoreCameraFromLS(store, roomId);
          hasRestoredCamera = true;
        }
      });
    };

    // 初回: per-record フルスキャン
    const initialPut: TLRecord[] = [];
    yMap.forEach((value) => {
      try {
        const record = typeof value === "string" ? JSON.parse(value) : value;
        if (record && typeof record === "object" && record.id) {
          initialPut.push(record);
        }
      } catch {
        // パース失敗はスキップ
      }
    });
    if (initialPut.length > 0) {
      store.mergeRemoteChanges(() => store.put(initialPut));
    } else if (fetchSnapshotWhenEmpty) {
      // Y.Doc が空 → sync-server 再起動の可能性。DB から復元
      void fetchSnapshotWhenEmpty().then((records) => {
        if (records.length === 0) return;
        store.mergeRemoteChanges(() => store.put(records));
        isLocalUpdateRef.current = true;
        ydoc.transact(() => {
          for (const rec of records) {
            yMap.set(rec.id, JSON.stringify(rec));
          }
        }, LOCAL_ORIGIN);
        isLocalUpdateRef.current = false;
      });
    }
    restoreCameraFromLS(store, roomId);
    hasRestoredCamera = true;

    yMap.observe(handleYUpdate);

    // Store → Y.Doc: RecordsDiff を per-record 形式で Y に反映（FPS スロットル）
    let rafScheduled = false;
    let pendingChanges: RecordsDiffLike | null = null;
    let cameraSaveTimer: ReturnType<typeof setTimeout> | null = null;
    const flushToY = () => {
      if (!pendingChanges) return;
      const changes = pendingChanges;
      pendingChanges = null;
      persistRecordsDiffToY(yMap, changes, isLocalUpdateRef, ydoc);
    };
    const scheduleFlush = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        flushToY();
      });
    };
    const persistToY = (entry: { changes: RecordsDiffLike; source: string }) => {
      if (entry.source !== "user") return;
      if (!cameraSaveTimer) {
        cameraSaveTimer = setTimeout(() => {
          cameraSaveTimer = null;
          saveCameraToLS(store, roomId);
        }, 500);
      }
      // 変更をマージして 1 フレームに 1 回送信
      if (!pendingChanges) {
        pendingChanges = { added: {}, updated: {}, removed: {} };
      }
      const { added, updated, removed } = entry.changes;
      Object.assign(pendingChanges.added, added);
      Object.assign(pendingChanges.updated, updated);
      Object.assign(pendingChanges.removed, removed);
      scheduleFlush();
    };

    const unsubStore = store.listen(persistToY, {
      source: "user",
      scope: "document",
    });

    // ページ離脱時にカメラ位置を確実に保存
    const handleBeforeUnload = () => saveCameraToLS(store, roomId);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 接続状態: loading / synced-remote / error を明確に分ける
    let hasConnectedOnce = false;
    const handleStatus = (event: { status: string }) => {
      if (event.status === "connected") {
        hasConnectedOnce = true;
        setConnectionStatus("online");
        setStatus("synced-remote");
      } else if (event.status === "disconnected") {
        setConnectionStatus("offline");
        // 一度でも接続済みならオフラインでもストアは使える
        setStatus(hasConnectedOnce ? "synced-remote" : "loading");
      } else if (event.status === "connecting") {
        setConnectionStatus("offline");
        setStatus(hasConnectedOnce ? "synced-remote" : "loading");
      }
    };
    provider.on("status", handleStatus);

    // 初回: 接続前に synced-remote にしない。接続完了まで loading
    setConnectionStatus("offline");
    setStatus(provider.wsconnected ? "synced-remote" : "loading");

    return () => {
      clearTimeout(connectTimer);
      if (cameraSaveTimer) clearTimeout(cameraSaveTimer);
      saveCameraToLS(store, roomId);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      unsubStore();
      yMap.unobserve(handleYUpdate);
      provider.off("status", handleStatus);
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
    };
  }, [roomId, wsUrl, getStore, userId, defaultName]);

  // avatarUrl が後から取得された場合に awareness を更新
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider || !userId || !defaultName) return;
    const color = getUserColor(userId);
    provider.awareness.setLocalStateField("user", {
      id: userId,
      name: defaultName,
      color,
      avatarUrl: avatarUrl ?? null,
    });
  }, [userId, defaultName, avatarUrl]);

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
    provider: providerRef.current ?? undefined,
  };
}
