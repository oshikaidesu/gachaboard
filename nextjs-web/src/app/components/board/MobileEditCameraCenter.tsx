"use client";

import {
  useGeoTextareaFocusScrollIntoView,
  useMobileCenterCameraOnTextEdit,
} from "@/app/hooks/board/useMobileCenterCameraOnTextEdit";

/**
 * Compound 配下でマウントすること。スマホで geo 編集時のカメラ寄せと textarea の可視化補助。
 *
 * 実機確認メモ用: IME 長文変換中に編集が閉じないか、横持ち、シェイプ外タップで編集終了、
 * textarea 内のドラッグ選択・長押し・コピペ。
 */
export function MobileEditCameraCenter() {
  useMobileCenterCameraOnTextEdit();
  useGeoTextareaFocusScrollIntoView();
  return null;
}
