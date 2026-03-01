"use client";

import { useCallback } from "react";
import { Editor, StateNode, type TLClickEventInfo } from "@tldraw/tldraw";
import type { FileIconShape } from "@/app/shapes";
import type { ApiAsset } from "@shared/apiTypes";

type IdleStateNode = StateNode & {
  onDoubleClick: (info: TLClickEventInfo) => void;
};

/**
 * FileIconShape のダブルクリックでプレビューモーダルを開くフック。
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
        }
        originalOnDoubleClick?.(info);
      };
    },
    [onOpen]
  );

  return { registerHandler };
}
