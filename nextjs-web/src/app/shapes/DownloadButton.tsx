"use client";

import { useState } from "react";

type Props = {
  assetId: string;
  fileName: string;
  style?: React.CSSProperties;
};

export function DownloadButton({ assetId, fileName, style }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/file?download=1`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
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
      {downloading ? "⏳" : "⬇"}
    </button>
  );
}
