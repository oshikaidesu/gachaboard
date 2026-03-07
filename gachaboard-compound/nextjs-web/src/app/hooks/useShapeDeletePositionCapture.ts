"use client";

import { useCallback } from "react";
import { Editor, type TLRecord, type TLAsset, type TLAssetId } from "@cmpd/compound";

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
  removedAssets: Record<string, TLRecord>,
  editor: Editor
): string | null {
  const tlAssetId = shape.props.assetId;
  if (!tlAssetId) return null;

  // tldraw 内部 ID 形式でなければ DB の ID としてそのまま使う
  if (!tlAssetId.startsWith("asset:")) return tlAssetId;

  // tldraw ネイティブシェイプ: 削除されたアセットレコードから src を取得
  // 同一トランザクションで削除されたアセットが removedAssets に含まれる場合と
  // store にまだ残っている場合の両方を試みる
  const assetRecord =
    (removedAssets[tlAssetId] as TLAsset | undefined) ??
    (editor.store.get(tlAssetId as TLAssetId) as TLAsset | undefined);

  if (!assetRecord) return null;

  const src = (assetRecord as { props?: { src?: string } }).props?.src ?? "";
  // /api/assets/{dbId}/file の形式から dbId を抽出
  const match = src.match(/\/api\/assets\/([^/]+)\/file/);
  return match ? match[1] : null;
}

// ---------- フック ------------------------------------------------------------

/**
 * シェイプ削除時にアセットをゴミ箱へ移動し、最終位置 (x, y) を DB に保存するフック。
 *
 * 対応シェイプ:
 *   - カスタム: file-icon / text-file / audio-player / video-player
 *   - ネイティブ: image / video（tldraw アセットレコードから DB ID を逆引き）
 */
export function useShapeDeletePositionCapture() {
  const registerListener = useCallback((editor: Editor) => {
    editor.store.listen(
      (entry) => {
        const removedShapes = Object.values(entry.changes.removed).filter(hasAssetId);
        if (removedShapes.length === 0) return;

        // 同一トランザクションで削除されたアセットレコード（image/video 用）
        const removedAssets = Object.fromEntries(
          Object.entries(entry.changes.removed).filter(
            ([, r]) => (r as TLRecord).typeName === "asset"
          )
        );

        for (const shape of removedShapes) {
          const dbAssetId = resolveDbAssetId(shape, removedAssets, editor);
          if (!dbAssetId) continue;

          fetch(`/api/assets/${dbAssetId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "trash",
              lastKnownX: shape.x,
              lastKnownY: shape.y,
            }),
          }).catch(() => {
            // 失敗はサイレントに無視（削除操作は止めない）
          });
        }
      },
      { source: "user", scope: "document" }
    );
  }, []);

  return { registerListener };
}
