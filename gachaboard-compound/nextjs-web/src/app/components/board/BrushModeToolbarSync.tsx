"use client";

import { useEditor, useValue } from "@cmpd/compound";
import { useLayoutEffect } from "react";
import { brushModeAtom } from "@/app/tools/SmartHandTool";

/**
 * select / brush-select の 2 ボタンを正しくハイライトする。
 *
 * compound ツールバーは activeToolId === toolItem.id で data-state="selected" を付けるが、
 * 両方とも underlying tool id が "select" なので compound は常に "select" ボタンだけを
 * selected にしてしまう。
 *
 * brushMode ON 時に select を解除し brush-select を selected にするため、
 * 動的 <style> タグを挿入して CSS で上書きする。
 */
export function BrushModeToolbarSync() {
  const editor = useEditor();
  const brushMode = useValue(brushModeAtom);
  const currentToolId = useValue(
    "currentToolId",
    () => editor.getCurrentToolId(),
    [editor]
  );

  useLayoutEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-brush-sync", "");

    if (currentToolId === "select" && brushMode) {
      style.textContent = `
        .tlui-button__tool[data-tool="select"][data-state="selected"] {
          color: var(--color-text-1) !important;
        }
        .tlui-button__tool[data-tool="select"][data-state="selected"]::after {
          background: transparent !important;
          opacity: 0 !important;
        }
        .tlui-button__tool[data-tool="brush-select"] {
          color: var(--color-selected-contrast) !important;
        }
        .tlui-button__tool[data-tool="brush-select"]::after {
          background: var(--color-selected) !important;
          opacity: 1 !important;
        }
      `;
    }

    document.head.appendChild(style);
    return () => style.remove();
  }, [currentToolId, brushMode, editor]);

  return null;
}
