/**
 * useYjsStore から抽出したヘルパー。
 * カメラ保存・復元、RecordsDiff の Y 反映、ドラッグ検出など。
 */

import type { TLRecord } from "@cmpd/tlschema";

const CAMERA_LS_PREFIX = "gachaboard-camera:";

/** ユーザーカーソル用。爽やかで視認性の良い色パレット（茶系・くすみ色を避ける） */
const USER_CURSOR_COLORS = [
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#22c55e", // green
  "#84cc16", // lime
  "#eab308", // yellow
  "#f97316", // orange
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#6366f1", // indigo
] as const;

export function saveCameraToLS(
  store: { allRecords: () => Iterable<TLRecord> },
  roomId: string,
): void {
  try {
    const cameraRecords: Record<string, TLRecord> = {};
    for (const rec of store.allRecords()) {
      if (rec.typeName === "camera" || rec.typeName === "instance_page_state") {
        cameraRecords[rec.id] = rec;
      }
    }
    localStorage.setItem(CAMERA_LS_PREFIX + roomId, JSON.stringify(cameraRecords));
  } catch {
    // localStorage が使えない環境では無視
  }
}

export function restoreCameraFromLS(
  store: { has: (id: TLRecord["id"]) => boolean; mergeRemoteChanges: (fn: () => void) => void; put: (records: TLRecord[]) => void },
  roomId: string,
): void {
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
export type RecordsDiffLike = {
  added: Record<string, TLRecord>;
  updated: Record<string, [TLRecord, TLRecord]>;
  removed: Record<string, TLRecord>;
};

/**
 * 変更が位置のみ（x,y）の更新かどうか。ドラッグ中の連続更新を検出する。
 * ドラッグ中は Y.Doc に送らず、drop 時にまとめて送るため。
 */
export function isPositionOnlyUpdate(changes: RecordsDiffLike): boolean {
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

export const LOCAL_ORIGIN = Symbol("local-store");

import type { Map as YMap, Doc as YDoc } from "yjs";

/** Y.Map の値 (string | object) を TLRecord にパース。不正なら null */
export function parseYMapValue(raw: unknown): TLRecord | null {
  try {
    const record: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (record && typeof record === "object" && (record as TLRecord).id) {
      return record as TLRecord;
    }
  } catch {
    /* skip */
  }
  return null;
}

/** Y.Map 全体から TLRecord 配列を生成（IndexedDB synced 時の初回ハイドレーション用） */
export function recordsFromYMap(yMap: YMap<string>): TLRecord[] {
  const records: TLRecord[] = [];
  yMap.forEach((raw) => {
    const rec = parseYMapValue(raw);
    if (rec) records.push(rec);
  });
  return records;
}

/**
 * RecordsDiff を Y.Map に書き込む（per-record 形式）。
 * Yjs が差分のみを送信するためネットワーク効率が向上。
 */
export function persistRecordsDiffToY(
  yMap: YMap<string>,
  changes: RecordsDiffLike,
  isLocalUpdateRef: { current: boolean },
  ydoc: YDoc,
): void {
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
  ydoc.transact(
    () => {
      for (const rec of toPut) {
        yMap.set(rec.id, JSON.stringify(rec));
      }
      for (const id of toDelete) {
        yMap.delete(id);
      }
    },
    LOCAL_ORIGIN,
  );
  isLocalUpdateRef.current = false;
}

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getUserColor(userId: string): string {
  const i = simpleHash(userId) % USER_CURSOR_COLORS.length;
  return USER_CURSOR_COLORS[i];
}
