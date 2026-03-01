"use client";

import { useCallback } from "react";
import { Editor, StateNode, type TLClickEventInfo, type TLImageShape, type TLVideoShape, type TLImageAsset, type TLVideoAsset } from "@tldraw/tldraw";
import type { FileIconShape } from "@/app/shapes";
import type { ApiAsset } from "@shared/apiTypes";

type IdleStateNode = StateNode & {
  onDoubleClick: (info: TLClickEventInfo) => void;
};

/** /api/assets/{id}/file 形式の src から assetId を取り出す */
function assetIdFromSrc(src: string): string | null {
  const m = src.match(/\/api\/assets\/([^/]+)\/file/);
  return m ? m[1] : null;
}

/**
 * FileIconShape・image・video シェイプのダブルクリックでプレビューモーダルを開くフック。
 * Editor の onMount 内で select.idle の onDoubleClick を上書きする関数を返す。
 */
export function useDoubleClickPreview(
  onOpen: (asset: ApiAsset) => void
) {
  const registerHandler = useCallback(
    (editor: Editor) => {
      const smartHandIdleState = editor.getStateDescendant<IdleStateNode>("select.idle");
      if (!smartHandIdleState) return;

      const originalOnDoubleClick = smartHandIdleState.onDoubleClick?.bind(smartHandIdleState);
      smartHandIdleState.onDoubleClick = function (info) {
        if (info.phase !== "up") {
          originalOnDoubleClick?.(info);
          return;
        }
        if (info.target === "shape") {
          const shape = info.shape as FileIconShape;

          if (shape.type === "file-icon") {
            onOpen({
              id: shape.props.assetId,
              fileName: shape.props.fileName,
              mimeType: shape.props.mimeType,
              kind: shape.props.kind,
              sizeBytes: "0",
            });
            return;
          }

          if (shape.type === "image") {
            const imageShape = info.shape as TLImageShape;
            const tlAsset = editor.getAsset(imageShape.props.assetId) as TLImageAsset | undefined;
            if (tlAsset?.props.src) {
              const id = assetIdFromSrc(tlAsset.props.src);
              if (id) {
                onOpen({
                  id,
                  fileName: tlAsset.props.name,
                  mimeType: tlAsset.props.mimeType ?? "image/*",
                  kind: "image",
                  sizeBytes: String(tlAsset.props.fileSize ?? 0),
                });
                return;
              }
            }
          }

          if (shape.type === "video") {
            const videoShape = info.shape as TLVideoShape;
            const tlAsset = editor.getAsset(videoShape.props.assetId) as TLVideoAsset | undefined;
            if (tlAsset?.props.src) {
              const id = assetIdFromSrc(tlAsset.props.src);
              if (id) {
                onOpen({
                  id,
                  fileName: tlAsset.props.name,
                  mimeType: tlAsset.props.mimeType ?? "video/*",
                  kind: "video",
                  sizeBytes: String(tlAsset.props.fileSize ?? 0),
                });
                return;
              }
            }
          }
        }
        originalOnDoubleClick?.(info);
      };
    },
    [onOpen]
  );

  return { registerHandler };
}
