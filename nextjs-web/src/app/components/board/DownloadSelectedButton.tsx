"use client";

import { useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useEditor, useValue } from "@cmpd/compound";
import { getDownloadableFromSelectedShapes } from "@/lib/selectedAssetsForDownload";
import { downloadAsset } from "@/lib/downloadAsset";

const TOAST_ID_PROMPT = "multi-download-prompt";

/** 複数ダウンロード間の待機時間（ms）。ブラウザのブロック・負荷軽減のため */
const DOWNLOAD_DELAY_MS = 200;

/**
 * 選択中にダウンロード可能なアセットが2件以上あるとき、
 * 既存のダウンロードUI（sonner トースト・top-right）で「選択した N 件をダウンロード」を案内する。
 * 1件のときは各シェイプの DL ボタンを使う。
 */
export function DownloadSelectedButton() {
  const editor = useEditor();
  const selectedIds = useValue(
    "selected-ids",
    () => editor.getSelectedShapeIds(),
    [editor]
  );
  const downloadableCount = getDownloadableFromSelectedShapes(editor).length;
  const prevCountRef = useRef(0);

  const handleDownload = useCallback(() => {
    toast.dismiss(TOAST_ID_PROMPT);
    const list = getDownloadableFromSelectedShapes(editor);
    if (list.length === 0) return;

    const total = list.length;
    const loadingToastId = toast.loading(`ダウンロード中... 1/${total}`);

    (async () => {
      try {
        for (let i = 0; i < list.length; i++) {
          toast.loading(`ダウンロード中... ${i + 1}/${total}`, { id: loadingToastId });
          const { assetId, fileName } = list[i];
          await downloadAsset(assetId, fileName);
          if (i < list.length - 1) {
            await new Promise((r) => setTimeout(r, DOWNLOAD_DELAY_MS));
          }
        }
        toast.success("ダウンロード完了", { id: loadingToastId });
      } catch {
        toast.error("ダウンロードに失敗しました", { id: loadingToastId });
      }
    })();
  }, [editor]);

  useEffect(() => {
    const prev = prevCountRef.current;
    if (downloadableCount >= 2) {
      const isFirstShow = prev < 2;
      const isCountChanged = prev !== downloadableCount;
      if (isFirstShow || isCountChanged) {
        toast("選択した " + downloadableCount + " 件をダウンロード", {
          id: TOAST_ID_PROMPT,
          action: {
            label: "ダウンロード",
            onClick: () => handleDownload(),
          },
        });
      }
      prevCountRef.current = downloadableCount;
    } else {
      if (prev >= 2) {
        toast.dismiss(TOAST_ID_PROMPT);
      }
      prevCountRef.current = downloadableCount;
    }
  }, [downloadableCount, handleDownload]);

  return null;
}
