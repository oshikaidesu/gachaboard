"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditor, useValue } from "@cmpd/compound";
import { EASINGS } from "@cmpd/editor";
import type { TLShapeId } from "@cmpd/tlschema";

const CAMERA_ANIM_MS = 280;
const CAMERA_ANIM_MS_VV = 220;
const VV_RESIZE_DEBOUNCE_MS = 90;

// ---------------------------------------------------------------------------
// チューニング（まずはこのオフセットで微調整。正の Y → 画面上ではテキストが上に寄る）
// centerOnPoint の基準点に「÷ zoom」で載せる＝画面 px 感覚で扱える
// ---------------------------------------------------------------------------
/** 横: 正で右寄り */
const OFFSET_FOCUS_SCREEN_PX_X = 0;
/**
 * 縦: 正で上寄り（キーボードから離す向き）。例: 48 でやや上、120 でかなり上
 */
const OFFSET_FOCUS_SCREEN_PX_Y = 200;

/** レイアウト下端付近が隠れているとみなす最大（異常値の抑制） */
const MAX_OBSCURED_RATIO = 0.65;
/** innerHeight − visualViewport.height をページシフトに換算するときの係数（0〜1） */
const KEYBOARD_SHIFT_FRACTION = 0.88;

function getMobileMatch() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

/** 仮想キーボード等で下端が隠れていると推定される高さ（CSS px） */
function getViewportBottomObscuredPx(): number {
  if (typeof window === "undefined" || !window.visualViewport) return 0;
  const innerH = window.innerHeight;
  const raw = innerH - window.visualViewport.height;
  const capped = Math.min(Math.max(0, raw), innerH * MAX_OBSCURED_RATIO);
  return capped;
}

/**
 * スマホ相当のときだけ、geo のテキスト編集でカメラを寄せる。
 * OFFSET_FOCUS_SCREEN_PX_* で基準をずらし、加えて visualViewport の下端隠れを KEYBOARD_SHIFT_FRACTION で反映。
 * 編集終了後のカメラ復帰はしない。
 */
export function useMobileCenterCameraOnTextEdit() {
  const editor = useEditor();
  const editingId = useValue(
    "editing-shape-for-mobile-camera",
    () => editor.getEditingShapeId(),
    [editor]
  );

  const prevEditingIdRef = useRef<TLShapeId | null>(null);

  const centerGeoOnKeyboardAwarePoint = useCallback(
    (duration: number) => {
      const id = editor.getEditingShapeId();
      if (!id) return;
      const shape = editor.getShape(id);
      if (!shape || shape.type !== "geo") return;
      const bounds = editor.getShapePageBounds(id);
      if (!bounds) return;

      const center = {
        x: bounds.x + bounds.w / 2,
        y: bounds.y + bounds.h / 2,
      };

      const obscuredPx = getViewportBottomObscuredPx();
      const zoom = editor.getZoomLevel();
      const keyboardShiftPageY =
        (obscuredPx * KEYBOARD_SHIFT_FRACTION) / zoom;
      const offsetPageY = OFFSET_FOCUS_SCREEN_PX_Y / zoom;
      const offsetPageX = OFFSET_FOCUS_SCREEN_PX_X / zoom;
      const shiftPageY = keyboardShiftPageY + offsetPageY;

      const point = {
        x: center.x + offsetPageX,
        y: center.y + shiftPageY,
      };

      editor.centerOnPoint(point, {
        duration,
        easing: EASINGS.easeOutCubic,
      });
    },
    [editor]
  );

  useEffect(() => {
    const prev = prevEditingIdRef.current;
    prevEditingIdRef.current = editingId;

    if (!getMobileMatch()) return;
    if (prev !== null || editingId === null) return;

    const shape = editor.getShape(editingId);
    if (!shape || shape.type !== "geo") return;

    let raf1 = 0;
    let raf2 = 0;
    queueMicrotask(() => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          centerGeoOnKeyboardAwarePoint(CAMERA_ANIM_MS);
        });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [editingId, editor, centerGeoOnKeyboardAwarePoint]);

  useEffect(() => {
    if (!getMobileMatch() || editingId === null) return;
    const shape = editor.getShape(editingId);
    if (!shape || shape.type !== "geo") return;
    const vv = window.visualViewport;
    if (!vv) return;

    let timeoutId: number | undefined;

    const onVvChange = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        if (editor.getEditingShapeId() !== editingId) return;
        if (getViewportBottomObscuredPx() < 48) return;
        centerGeoOnKeyboardAwarePoint(CAMERA_ANIM_MS_VV);
      }, VV_RESIZE_DEBOUNCE_MS);
    };

    vv.addEventListener("resize", onVvChange);
    vv.addEventListener("scroll", onVvChange);

    return () => {
      vv.removeEventListener("resize", onVvChange);
      vv.removeEventListener("scroll", onVvChange);
      window.clearTimeout(timeoutId);
    };
  }, [editingId, editor, centerGeoOnKeyboardAwarePoint]);
}
