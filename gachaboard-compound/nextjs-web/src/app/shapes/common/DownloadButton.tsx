"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatFileSize } from "@shared/utils";
import { TwemojiImg } from "@/app/components/ui/Twemoji";

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
      const res = await fetch(`/api/assets/${assetId}/file?download=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentLength = res.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : null;
      const reader = res.body?.getReader();

      if (!reader) throw new Error("ReadableStream not supported");

      const chunks: Uint8Array[] = [];
      let received = 0;
      let lastPercent = -1;
      let lastBytesUpdate = 0;
      const BYTES_UPDATE_INTERVAL = 256 * 1024; // 256KB ごとに更新

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;

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
      }

      const blob = new Blob(chunks as BlobPart[]);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);

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
