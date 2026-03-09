"use client";

import { useCallback, useRef, useEffect } from "react";
import { Editor, type TLRecord, type TLAsset, type TLAssetId } from "@cmpd/compound";
import { createDelayedActionQueue } from "@/lib/delayedActionQueue";

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
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const registerListener = useCallback((editor: Editor) => {
    const queue = createDelayedActionQueue<{ x: number; y: number }>(
      TRASH_DELAY_MS,
      (dbAssetId, { x, y }, options) => {
        fetch(`/api/assets/${dbAssetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "trash", lastKnownX: x, lastKnownY: y }),
          keepalive: options?.keepalive,
        }).catch(() => {});
      }
    );

    const handleBeforeUnload = () => queue.flushAll({ keepalive: true });
    window.addEventListener("beforeunload", handleBeforeUnload);

    const unsub = editor.store.listen(
      (entry) => {
        const removedShapes = Object.values(entry.changes.removed).filter(hasAssetId);
        const removedAssets = getAssetRecords(entry.changes.removed);
        for (const shape of removedShapes) {
          const dbAssetId = resolveDbAssetId(shape, removedAssets, editor);
          if (dbAssetId) queue.schedule(dbAssetId, { x: shape.x, y: shape.y });
        }

        const addedShapes = Object.values(entry.changes.added).filter(hasAssetId);
        const addedAssets = getAssetRecords(entry.changes.added);
        for (const shape of addedShapes) {
          const dbAssetId = resolveDbAssetId(shape, addedAssets, editor);
          if (dbAssetId) queue.cancel(dbAssetId);
        }
      },
      { source: "user", scope: "document" }
    );

    const cleanup = () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      queue.flushAll();
      unsub?.();
    };
    cleanupRef.current = cleanup;

    return cleanup;
  }, []);

  return { registerListener };
}
