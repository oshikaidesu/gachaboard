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
import { IndexeddbPersistence } from "y-indexeddb";
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
 * 変更が位置のみ（x,y）の更新かどうか。ドラッグ中の連続更新を検出する。
 * ドラッグ中は Y.Doc に送らず、drop 時にまとめて送るため。
 */
function isPositionOnlyUpdate(changes: RecordsDiffLike): boolean {
  if (Object.keys(changes.added).length > 0 || Object.keys(changes.removed).length > 0) {
    return false;
  }
  const updated = Object.values(changes.updated);
  if (updated.length === 0) return false;
  for (const [from, to] of updated) {
    const fromShape = from as unknown as { x?: number; y?: number; [k: string]: unknown };
    const toShape = to as unknown as { x?: number; y?: number; [k: string]: unknown };
    if (typeof fromShape.x !== "number" || typeof fromShape.y !== "number") return false;
    if (typeof toShape.x !== "number" || typeof toShape.y !== "number") return false;
    if (fromShape.x === toShape.x && fromShape.y === toShape.y) return false;
    const fromRest = { ...fromShape, x: 0, y: 0 };
    const toRest = { ...toShape, x: 0, y: 0 };
    if (JSON.stringify(fromRest) !== JSON.stringify(toRest)) return false;
  }
  return true;
}

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
  fetchSnapshotWhenEmpty?: () => Promise<{
    records: TLRecord[];
    reactions?: Record<string, string>;
    comments?: Record<string, string>;
    reactionEmojiPreset?: string[] | null;
  }>;
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

    const persistence = new IndexeddbPersistence(roomId, ydoc);
    persistence.on("synced", () => {
      // IndexedDB から復元済み。空なら DB スナップショット取得（sync-server 再起動対策）
      const hasData = yMap.size > 0;
      if (!hasData && fetchSnapshotWhenEmpty) {
        void fetchSnapshotWhenEmpty().then((snapshot) => {
          const records = snapshot?.records ?? [];
          const hasReactions = snapshot?.reactions && Object.keys(snapshot.reactions).length > 0;
          const hasComments = snapshot?.comments && Object.keys(snapshot.comments).length > 0;
          const hasReactionEmojiPreset =
            Array.isArray(snapshot?.reactionEmojiPreset) && snapshot.reactionEmojiPreset.length > 0;
          if (records.length === 0 && !hasReactions && !hasComments && !hasReactionEmojiPreset) return;
          const store = getStore();
          if (records.length > 0) {
            store.mergeRemoteChanges(() => store.put(records));
            restoreCameraFromLS(store, roomId);
          }
          isLocalUpdateRef.current = true;
          ydoc.transact(() => {
            for (const rec of records) {
              yMap.set(rec.id, JSON.stringify(rec));
            }
            const reactionsMap = ydoc.getMap<string>("reactions");
            for (const [k, v] of Object.entries(snapshot?.reactions ?? {})) {
              reactionsMap.set(k, v);
            }
            const commentsMap = ydoc.getMap<string>("comments");
            for (const [k, v] of Object.entries(snapshot?.comments ?? {})) {
              commentsMap.set(k, v);
            }
            if (hasReactionEmojiPreset) {
              const presetMap = ydoc.getMap<string>("reactionEmojiPreset");
              presetMap.set("emojis", JSON.stringify(snapshot!.reactionEmojiPreset));
            }
          }, LOCAL_ORIGIN);
          isLocalUpdateRef.current = false;
        });
      }
      setStatus("synced-remote");
    });

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

    // 初回ロードは IndexedDB persistence.synced で行う（y-indexeddb が IndexedDB から復元後に発火）
    yMap.observe(handleYUpdate);

    // Store → Y.Doc: RecordsDiff を per-record 形式で Y に反映（FPS スロットル）
    // Phase 2: ドラッグ中（位置のみ更新）は Y に送らず、drop 時にまとめて送る
    const DRAG_DEFER_MS = 100;
    let rafScheduled = false;
    let pendingChanges: RecordsDiffLike | null = null;
    let cameraSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let dragDeferTimer: ReturnType<typeof setTimeout> | null = null;
    const flushToY = () => {
      if (!pendingChanges) return;
      provider.awareness.setLocalStateField("dragging", null);
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
    const scheduleFlushDeferred = () => {
      if (dragDeferTimer) clearTimeout(dragDeferTimer);
      dragDeferTimer = setTimeout(() => {
        dragDeferTimer = null;
        flushToY();
      }, DRAG_DEFER_MS);
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
      // 位置のみの更新（ドラッグ中）は drop まで遅延。それ以外は即時送信
      if (isPositionOnlyUpdate(entry.changes)) {
        const updated = Object.values(entry.changes.updated);
        if (updated.length === 1) {
          const [, to] = updated[0];
          const shape = to as { id: string; x: number; y: number };
          provider.awareness.setLocalStateField("dragging", {
            shapeId: shape.id,
            x: shape.x,
            y: shape.y,
          });
        }
        scheduleFlushDeferred();
      } else {
        provider.awareness.setLocalStateField("dragging", null);
        if (dragDeferTimer) {
          clearTimeout(dragDeferTimer);
          dragDeferTimer = null;
        }
        scheduleFlush();
      }
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
      if (dragDeferTimer) clearTimeout(dragDeferTimer);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      unsubStore();
      yMap.unobserve(handleYUpdate);
      provider.off("status", handleStatus);
      // 重いクリーンアップは遅延実行し、遷移先の描画をブロックしない
      const runHeavyCleanup = () => {
        saveCameraToLS(store, roomId);
        provider.destroy();
        persistence.destroy();
        ydoc.destroy();
        providerRef.current = null;
        ydocRef.current = null;
      };
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(runHeavyCleanup, { timeout: 500 });
      } else {
        setTimeout(runHeavyCleanup, 0);
      }
    };
  }, [roomId, wsUrl, getStore, userId, defaultName, fetchSnapshotWhenEmpty]);

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
