"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { restoreCameraFromLS, LOCAL_ORIGIN, recordsFromYMap } from "@/lib/yjsSyncHelpers";
import type { TLRecord } from "@cmpd/tlschema";

export type SnapshotData = {
  records: TLRecord[];
  reactions?: Record<string, string>;
  comments?: Record<string, string>;
  reactionEmojiPreset?: string[] | null;
};

type StoreLike = {
  put: (r: TLRecord[]) => void;
  mergeRemoteChanges: (fn: () => void) => void;
  has: (id: unknown) => boolean;
};

type UseYjsPersistenceOptions = {
  roomId: string;
  wsUrl: string;
  getStore: () => StoreLike;
  fetchSnapshotWhenEmpty?: () => Promise<SnapshotData>;
  onSynced: () => void;
  isLocalUpdateRef: React.MutableRefObject<boolean>;
};

/**
 * IndexedDB 永続化と、空の場合の DB スナップショット復元。
 * 公式パターン（https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb）:
 * - ydoc を作成
 * - IndexeddbPersistence(docName, ydoc) で同一 docName を Hocuspocus の name と統一
 * - persistence.on('synced') で DB ロード完了を検知
 */
export function useYjsPersistence({
  roomId,
  wsUrl,
  getStore,
  fetchSnapshotWhenEmpty,
  onSynced,
  isLocalUpdateRef,
}: UseYjsPersistenceOptions): Y.Doc | null {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  useEffect(() => {
    if (typeof window === "undefined" || !roomId || !wsUrl) return;

    const yd = new Y.Doc();
    const yMap = yd.getMap<string>("tldraw");

    let cancelled = false;
    // docName は HocuspocusProvider の name と統一（公式: 同一識別子を使用）
    const persistence = new IndexeddbPersistence(roomId, yd);
    persistence.on("synced", () => {
      const hasData = yMap.size > 0;
      if (!hasData && fetchSnapshotWhenEmpty) {
        void fetchSnapshotWhenEmpty().then((snapshot) => {
          if (cancelled) return;
          const records = snapshot?.records ?? [];
          const hasReactions = snapshot?.reactions && Object.keys(snapshot.reactions).length > 0;
          const hasComments = snapshot?.comments && Object.keys(snapshot.comments).length > 0;
          const hasReactionEmojiPreset =
            Array.isArray(snapshot?.reactionEmojiPreset) && snapshot.reactionEmojiPreset.length > 0;
          if (records.length === 0 && !hasReactions && !hasComments && !hasReactionEmojiPreset) {
            onSyncedRef.current();
            return;
          }
          const store = getStore();
          if (records.length > 0) {
            store.mergeRemoteChanges(() => store.put(records));
            restoreCameraFromLS(store, roomId);
          }
          isLocalUpdateRef.current = true;
          yd.transact(() => {
            for (const rec of records) {
              yMap.set(rec.id, JSON.stringify(rec));
            }
            const reactionsMap = yd.getMap<string>("reactions");
            for (const [k, v] of Object.entries(snapshot?.reactions ?? {})) {
              reactionsMap.set(k, v);
            }
            const commentsMap = yd.getMap<string>("comments");
            for (const [k, v] of Object.entries(snapshot?.comments ?? {})) {
              commentsMap.set(k, v);
            }
            if (hasReactionEmojiPreset) {
              const presetMap = yd.getMap<string>("reactionEmojiPreset");
              presetMap.set("emojis", JSON.stringify(snapshot!.reactionEmojiPreset));
            }
          }, LOCAL_ORIGIN);
          isLocalUpdateRef.current = false;
          onSyncedRef.current();
        });
      } else {
        // IndexedDB にデータがある場合: Y.Map → TLStore へ反映（初回ハイドレーションはここだけ）
        if (hasData) {
          const store = getStore();
          const records = recordsFromYMap(yMap);
          if (records.length > 0) {
            store.mergeRemoteChanges(() => store.put(records));
            restoreCameraFromLS(store, roomId);
          }
        }
        onSyncedRef.current();
      }
    });

    setYdoc(yd);

    return () => {
      cancelled = true;
      persistence.destroy();
      yd.destroy();
      setYdoc(null);
    };
  }, [roomId, wsUrl, getStore, fetchSnapshotWhenEmpty, isLocalUpdateRef]);

  return ydoc;
}
