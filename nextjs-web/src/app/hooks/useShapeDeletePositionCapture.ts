"use client";

import { useCallback, useRef, useEffect } from "react";
import { Editor, type TLRecord, type TLAsset, type TLAssetId } from "@cmpd/compound";
import { createDelayedActionQueue } from "@/lib/delayedActionQueue";

const TRASH_DELAY_MS = 0; // 即時 trash。Undo 時は file/thumbnail API がアクセス検知で自動復元する
const TRASH_STAGGER_MS = 50; // 一括実行時のリクエスト間隔（サーバー負荷分散）

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

/**
 * 指定の DB アセット ID を参照するシェイプが、現在のストアにまだ存在するか。
 * コピーで同じ assetId を持つシェイプが複数ある場合、最後の一つが消えるまで trash しない。
 */
function isAssetStillReferenced(editor: Editor, dbAssetId: string): boolean {
  for (const shape of editor.getCurrentPageShapes()) {
    const aid = (shape.props as { assetId?: string }).assetId;
    if (!aid) continue;
    if (aid === dbAssetId) return true;
    if (aid.startsWith("asset:")) {
      const assetRecord = editor.store.get(aid as TLAssetId) as TLAsset | undefined;
      const src = (assetRecord?.props as { src?: string } | undefined)?.src ?? "";
      if (src.includes(`/api/assets/${dbAssetId}/file`)) return true;
    }
  }
  return false;
}

// ---------- フック ------------------------------------------------------------

/**
 * シェイプ削除時にアセットをゴミ箱へ移動し、最終位置 (x, y) を DB に保存するフック。
 *
 * 即時 trash: Undo 時は file/thumbnail API がアクセス検知で自動復元するため遅延不要。
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
      },
      TRASH_STAGGER_MS
    );

    const handleBeforeUnload = () => queue.flushAll({ keepalive: true });
    window.addEventListener("beforeunload", handleBeforeUnload);

    const unsub = editor.store.listen(
      (entry) => {
        const removedShapes = Object.values(entry.changes.removed).filter(hasAssetId);
        const removedAssets = getAssetRecords(entry.changes.removed);
        for (const shape of removedShapes) {
          const dbAssetId = resolveDbAssetId(shape, removedAssets, editor);
          if (!dbAssetId) continue;
          // 同じ assetId を参照するシェイプが他に残っている場合は trash しない
          if (isAssetStillReferenced(editor, dbAssetId)) continue;
          queue.schedule(dbAssetId, { x: shape.x, y: shape.y });
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
