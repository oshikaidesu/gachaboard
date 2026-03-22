"use client";

import { useMobileCenterCameraOnTextEdit } from "@/app/hooks/board/useMobileCenterCameraOnTextEdit";

/** Compound 配下でマウントすること。スマホで geo 編集開始時にカメラを中央へイージング移動。 */
export function MobileEditCameraCenter() {
  useMobileCenterCameraOnTextEdit();
  return null;
}
