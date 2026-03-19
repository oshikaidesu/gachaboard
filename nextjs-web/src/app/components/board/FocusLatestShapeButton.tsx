"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useEditor, useValue } from "@cmpd/compound";
import type { TLShapeId } from "@cmpd/tlschema";
import { getLatestShapeIds } from "@/app/shapes/common";

/** CreatorLabel と同じ emerald */
const EMERALD = "#10b981";

const RESET_DELAY_MS = 5_000;

/** フォーカス/ターゲットアイコン */
const FocusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960" fill="currentColor" aria-hidden>
    <path d="M200-280v80-560 480Zm480 160H280q-66 0-113-47t-47-113v-400q0-66 47-113t113-47h201v80H280q-33 0-56.5 23.5T200-680v400q0 33 23.5 56.5T280-200h400q33 0 56.5-23.5T760-280v-201h80v201q0 66-47 113t-113 47Zm60-440q-6 0-8-6-16-61-60.5-105.5T566-732q-6-2-6-8 0-7 6-8 61-16 105.5-60.5T732-914q2-6 8-6t8 6q16 61 60.5 105.5T914-748q6 1 6 8 0 6-6 8-61 16-105.5 60.5T748-566q-1 6-8 6Z" />
  </svg>
);

/**
 * 左下に配置する緑の丸ボタン。1〜5 の最新シェイプを順に追従。
 * クリックでアイコンが数字に置き換わりカメラ移動。5秒無操作でアイコンが元に戻る。
 */
export function FocusLatestShapeButton() {
  const editor = useEditor();
  const [index, setIndex] = useState(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ids = useValue(
    "latest-shape-ids",
    () => getLatestShapeIds(editor, 5),
    [editor]
  );

  useEffect(() => {
    if (ids.length > 0 && index > ids.length) setIndex(0);
  }, [ids.length, index]);

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      setIndex(0);
    }, RESET_DELAY_MS);
  }, []);

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  const focusShapeCenter = useCallback(
    (ed: typeof editor, shapeId: TLShapeId) => {
      const bounds = ed.getShapePageBounds(shapeId);
      if (!bounds) return;
      const center = {
        x: bounds.x + bounds.w / 2,
        y: bounds.y + bounds.h / 2,
      };
      ed.centerOnPoint(center);
    },
    []
  );

  const handleClick = useCallback(() => {
    if (ids.length === 0) return;
    const nextIndex = (index + 1) % (ids.length + 1);
    setIndex(nextIndex);
    if (nextIndex >= 1) {
      focusShapeCenter(editor, ids[nextIndex - 1] as TLShapeId);
      toast.success(`最新のシェイプ ${nextIndex} へ`, { duration: 1500 });
    }
    scheduleReset();
  }, [editor, ids, index, focusShapeCenter, scheduleReset]);

  const showIcon = index === 0;
  const displayNum = index;
  const hasShapes = ids.length > 0;

  if (typeof document === "undefined") return null;

  return createPortal(
    <button
      type="button"
      onClick={handleClick}
      disabled={!hasShapes}
      className="fixed bottom-4 left-[max(1rem,env(safe-area-inset-left))] z-[9999] flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white shadow-lg transition-all duration-150 hover:opacity-90 active:scale-95 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ backgroundColor: EMERALD }}
      title={hasShapes ? (showIcon ? "最新のシェイプへ" : `最新のシェイプ ${displayNum} へ`) : "シェイプがありません"}
      aria-label={hasShapes ? (showIcon ? "最新のシェイプへ移動" : `最新のシェイプ ${displayNum} へ移動`) : "シェイプがありません"}
    >
      {showIcon ? (
        <span className="flex items-center justify-center text-white">
          <FocusIcon />
        </span>
      ) : (
        <span className="text-lg font-semibold text-white">{displayNum}</span>
      )}
    </button>,
    document.body
  );
}
