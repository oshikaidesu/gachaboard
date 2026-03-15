"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatFileSize } from "@shared/utils";
import { TwemojiImg } from "@/app/components/ui/Twemoji";
import { downloadAsset } from "@/lib/downloadAsset";

type Props = {
  assetId: string;
  fileName: string;
  style?: React.CSSProperties;
};

/** DownloadButton の左に並べて使うファイルサイズ表示 */
export function FileSizeLabel({ sizeBytes, style }: { sizeBytes?: string | number | null; style?: React.CSSProperties }) {
  const label = formatFileSize(sizeBytes);
  if (!label) return null;
  return (
    <span style={{
      fontSize: 10,
      color: "#94a3b8",
      whiteSpace: "nowrap",
      flexShrink: 0,
      ...style,
    }}>
      {label}
    </span>
  );
}

export function DownloadButton({ assetId, fileName, style }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);

    const toastId = toast.loading("ダウンロード中...");

    try {
      let lastPercent = -1;
      let lastBytesUpdate = 0;
      const BYTES_UPDATE_INTERVAL = 256 * 1024;

      await downloadAsset(assetId, fileName, (received, total) => {
        if (total) {
          const percent = Math.round((received / total) * 100);
          if (percent !== lastPercent && (percent % 5 === 0 || percent === 100)) {
            lastPercent = percent;
            toast.loading(`ダウンロード中... ${percent}%`, { id: toastId });
          }
        } else if (received - lastBytesUpdate >= BYTES_UPDATE_INTERVAL) {
          lastBytesUpdate = received;
          const sizeLabel = formatFileSize(received);
          toast.loading(sizeLabel ? `ダウンロード中... ${sizeLabel}` : "ダウンロード中...", { id: toastId });
        }
      });

      toast.success("ダウンロード完了", { id: toastId });
    } catch {
      toast.error("ダウンロードに失敗しました", { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const stopAll = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <button
      onClick={handleClick}
      onMouseDown={stopAll}
      onPointerDown={stopAll}
      onTouchStart={stopAll}
      title={downloading ? "ダウンロード中..." : "ダウンロード"}
      disabled={downloading}
      style={{
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: downloading ? "wait" : "pointer",
        opacity: downloading ? 0.7 : 1,
        transition: "opacity 0.15s",
        ...style,
      }}
    >
      {downloading ? <TwemojiImg emoji="⏳" size={16} /> : <TwemojiImg emoji="⬇" size={16} />}
    </button>
  );
}
