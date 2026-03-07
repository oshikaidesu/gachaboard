"use client";

import { useCallback, useRef, useEffect } from "react";
import { Editor, type TLRecord, type TLAsset, type TLAssetId } from "@cmpd/compound";

// テスト用: 1秒猶予。本番は 10 * 60 * 1000
const TRASH_DELAY_MS = 1000; // 10 * 60 * 1000; // 10分（Undo の猶予）

// ---------- 型ガード ----------------------------------------------------------

type AssetShape = TLRecord & {
  typeName: "shape";
  type: string;
  x: number;
  y: number;
  props: { assetId?: string };
};

function hasAssetId(record: TLRecord): record is AssetShape {
  return (
    record.typeName === "shape" &&
    "props" in record &&
    typeof (record as AssetShape).props?.assetId === "string" &&
    (record as AssetShape).props.assetId !== "" &&
    typeof (record as AssetShape).x === "number" &&
    typeof (record as AssetShape).y === "number"
  );
}

// ---------- DB アセット ID 解決 -----------------------------------------------

/**
 * シェイプの props.assetId から DB のアセット ID を解決する。
 *
 * カスタムシェイプ（file-icon / text-file / audio-player / video-player）は
 * props.assetId が直接 DB の ID なのでそのまま返す。
 *
 * tldraw ネイティブシェイプ（image / video）は props.assetId が
 * tldraw 内部の "asset:xxx" 形式なので、store からアセットレコードを
 * 取得して src URL（/api/assets/{dbId}/file）から DB の ID を抽出する。
 */
function resolveDbAssetId(
  shape: AssetShape,
  assetRecords: Record<string, TLRecord>,
  editor: Editor
): string | null {
  const tlAssetId = shape.props.assetId;
  if (!tlAssetId) return null;

  // tldraw 内部 ID 形式でなければ DB の ID としてそのまま使う
  if (!tlAssetId.startsWith("asset:")) return tlAssetId;

  // tldraw ネイティブシェイプ: アセットレコードから src を取得
  const assetRecord =
    (assetRecords[tlAssetId] as TLAsset | undefined) ??
    (editor.store.get(tlAssetId as TLAssetId) as TLAsset | undefined);

  if (!assetRecord) return null;

  const src = (assetRecord as { props?: { src?: string } }).props?.src ?? "";
  const match = src.match(/\/api\/assets\/([^/]+)\/file/);
  return match ? match[1] : null;
}

function getAssetRecords(changes: Record<string, TLRecord>): Record<string, TLRecord> {
  return Object.fromEntries(
    Object.entries(changes).filter(([, r]) => (r as TLRecord).typeName === "asset")
  );
}

// ---------- フック ------------------------------------------------------------

type PendingTrash = {
  timer: ReturnType<typeof setTimeout>;
  x: number;
  y: number;
};

/**
 * シェイプ削除時にアセットをゴミ箱へ移動し、最終位置 (x, y) を DB に保存するフック。
 *
 * 10分の猶予: 即座に trash せず、10分後に実行。その間に Undo されたらキャンセル。
 * タブを閉じる場合は即時フラッシュ。詳細は docs/database-and-storage-inventory.md 参照。
 *
 * 対応シェイプ:
 *   - カスタム: file-icon / text-file / audio-player / video-player
 *   - ネイティブ: image / video（tldraw アセットレコードから DB ID を逆引き）
 */
export function useShapeDeletePositionCapture() {
  const pendingRef = useRef<Map<string, PendingTrash>>(new Map());
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const registerListener = useCallback((editor: Editor) => {
    const scheduleTrash = (dbAssetId: string, x: number, y: number) => {
      const prev = pendingRef.current.get(dbAssetId);
      if (prev) clearTimeout(prev.timer);

      const timer = setTimeout(() => {
        pendingRef.current.delete(dbAssetId);
        fetch(`/api/assets/${dbAssetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "trash", lastKnownX: x, lastKnownY: y }),
        }).catch(() => {});
      }, TRASH_DELAY_MS);

      pendingRef.current.set(dbAssetId, { timer, x, y });
    };

    const cancelTrash = (dbAssetId: string) => {
      const prev = pendingRef.current.get(dbAssetId);
      if (prev) {
        clearTimeout(prev.timer);
        pendingRef.current.delete(dbAssetId);
      }
    };

    const flushAll = (keepalive: boolean) => {
      for (const [dbAssetId, { timer, x, y }] of pendingRef.current) {
        clearTimeout(timer);
        fetch(`/api/assets/${dbAssetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "trash", lastKnownX: x, lastKnownY: y }),
          keepalive,
        }).catch(() => {});
      }
      pendingRef.current.clear();
    };

    const handleBeforeUnload = () => flushAll(true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    const unsub = editor.store.listen(
      (entry) => {
        // 削除時: 10分後に trash をスケジュール
        const removedShapes = Object.values(entry.changes.removed).filter(hasAssetId);
        const removedAssets = getAssetRecords(entry.changes.removed);
        for (const shape of removedShapes) {
          const dbAssetId = resolveDbAssetId(shape, removedAssets, editor);
          if (dbAssetId) scheduleTrash(dbAssetId, shape.x, shape.y);
        }

        // 追加時（Undo）: 該当 assetId の trash をキャンセル
        const addedShapes = Object.values(entry.changes.added).filter(hasAssetId);
        const addedAssets = getAssetRecords(entry.changes.added);
        for (const shape of addedShapes) {
          const dbAssetId = resolveDbAssetId(shape, addedAssets, editor);
          if (dbAssetId) cancelTrash(dbAssetId);
        }
      },
      { source: "user", scope: "document" }
    );

    const cleanup = () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushAll(false); // アンマウント時は即時フラッシュ（keepalive 不要）
      unsub?.();
    };
    cleanupRef.current = cleanup;

    return cleanup;
  }, []);

  return { registerListener };
}
