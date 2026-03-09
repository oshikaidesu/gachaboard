"use client";

import { useCallback } from "react";
import type { Editor } from "@cmpd/editor";
import { placeAsset } from "@/app/shapes";
import type { ApiAsset } from "@shared/apiTypes";

export function useRestoreAsset(userName: string) {
  return useCallback(
    async (editor: Editor) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);

      const singleId = params.get("restoreAsset");
      const multiIds = params.get("restoreAssets");
      const assetIds = multiIds
        ? multiIds.split(",").filter(Boolean)
        : singleId
          ? [singleId]
          : [];

      if (assetIds.length === 0) return;

      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);

      const hasShapeForAsset = (dbAssetId: string): boolean => {
        for (const shape of editor.getCurrentPageShapes()) {
          const aid = (shape.props as { assetId?: string }).assetId;
          if (!aid) continue;
          if (aid === dbAssetId) return true;
          if (aid.startsWith("asset:")) {
            const assetRecord = editor.store.get(aid as never);
            const src = (assetRecord as { props?: { src?: string } } | undefined)?.props?.src ?? "";
            if (src.includes(`/api/assets/${dbAssetId}/file`)) return true;
          }
        }
        return false;
      };

      let lastPosition: { x: number; y: number } | null = null;

      for (const assetId of assetIds) {
        if (hasShapeForAsset(assetId)) continue;
        try {
          const res = await fetch(`/api/assets/${assetId}`);
          if (!res.ok) continue;
          const asset = (await res.json()) as ApiAsset;

          const viewport = editor.getViewportScreenCenter();
          const position = {
            x: asset.lastKnownX ?? viewport.x - 160,
            y: asset.lastKnownY ?? viewport.y - 120,
          };

          await placeAsset(editor, asset, position, userName);
          lastPosition = position;
        } catch {
          // 復元失敗はサイレントに無視
        }
      }

      if (lastPosition) {
        editor.centerOnPoint({ x: lastPosition.x, y: lastPosition.y });
      }
    },
    [userName]
  );
}
