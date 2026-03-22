"use client";

import { useEditor, useValue } from "@cmpd/compound";
import { useLayoutEffect, useRef } from "react";
import { eraserLockAtom, eraserSecondTapPendingAtom } from "@/app/tools/eraserLockAtom";

const STYLE_ID = "gachaboard-eraser-lock-toolbar";

/** Google Material Icons — lock（24dp） */
const MATERIAL_LOCK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="black" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>';

/** Material lock_open（960 系 viewBox）— mask 用に fill を black */
const MATERIAL_LOCK_OPEN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path fill="black" d="M240-160h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM240-160v-400 400Zm0 80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h280v-80q0-83 58.5-141.5T720-920q83 0 141.5 58.5T920-720h-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80h120q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Z"/></svg>';

const MATERIAL_LOCK_MASK_URL = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(MATERIAL_LOCK_SVG)}")`;
const MATERIAL_LOCK_OPEN_MASK_URL = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(MATERIAL_LOCK_OPEN_SVG)}")`;

type Props = {
  /** E2E などロック UI・再ロックを無効化する */
  skipLockUi?: boolean;
};

/**
 * 消しゴムがロック中のときツールボタン右上に鍵を出す。
 * 消しゴムから他ツールへ切り替えたら再ロックする。
 */
export function EraserLockToolbarSync({ skipLockUi }: Props) {
  const editor = useEditor();
  const eraserLocked = useValue(eraserLockAtom);
  const secondTapPending = useValue(eraserSecondTapPendingAtom);
  const currentToolId = useValue("currentToolId", () => editor.getCurrentToolId(), [editor]);

  const prevToolRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (skipLockUi) return;
    const prev = prevToolRef.current;
    const toolChanged = prev != null && prev !== currentToolId;
    prevToolRef.current = currentToolId;

    if (prev === "eraser" && currentToolId !== "eraser") {
      eraserLockAtom.set(true);
      eraserSecondTapPendingAtom.set(false);
    }

    // 1 回目タップ後（解除待ち）のまま他ツールへ切り替えたら、また 1 回目（鍵アイコン）から
    if (toolChanged && currentToolId !== "eraser") {
      eraserSecondTapPendingAtom.set(false);
    }
  }, [currentToolId, skipLockUi]);

  useLayoutEffect(() => {
    if (skipLockUi || !eraserLocked) {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    const maskUrl = secondTapPending ? MATERIAL_LOCK_OPEN_MASK_URL : MATERIAL_LOCK_MASK_URL;
    el.textContent = `
      .tlui-button__tool[data-tool="eraser"] {
        position: relative;
      }
      .tlui-button__tool[data-tool="eraser"]::before {
        content: "";
        position: absolute;
        top: -2px;
        right: -1px;
        width: 22px;
        height: 22px;
        pointer-events: none;
        z-index: 1;
        opacity: 0.92;
        background-color: currentColor;
        -webkit-mask-image: ${maskUrl};
        mask-image: ${maskUrl};
        -webkit-mask-size: contain;
        mask-size: contain;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
      }
    `;
  }, [eraserLocked, secondTapPending, skipLockUi]);

  return null;
}
