"use client";

import { TwemojiImg } from "@/app/components/ui/Twemoji";
import type { OgpData } from "@shared/apiTypes";
import { getSafeHref } from "@/lib/safeUrl";
import { useOgp } from "@/app/hooks/media/useOgp";

function OgpCard({ data, width }: { data: OgpData; width: number }) {
  const safeHref = getSafeHref(data.url);
  const safeImage = data.image ? getSafeHref(data.image) : null;

  const domain = (() => {
    if (safeHref) {
      try {
        return new URL(safeHref).hostname.replace(/^www\./, "");
      } catch {
        return data.url;
      }
    }
    return data.url;
  })();

  const cardHeight = Math.round(width * 0.56);

  const cardStyle = {
    display: "flex" as const,
    flexDirection: "column" as const,
    width: "100%",
    height: cardHeight,
    borderRadius: "0 0 8px 8px",
    overflow: "hidden" as const,
    border: "1px solid #e4e4e7",
    borderTop: "none",
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
    textDecoration: "none",
    color: "inherit",
  };

  const cardContent = (
    <>
      {safeImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safeImage}
          alt={data.title ?? ""}
          style={{
            width: "100%",
            flex: 1,
            objectFit: "cover",
            display: "block",
            minHeight: 0,
          }}
          draggable={false}
        />
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#f4f4f5",
            gap: 8,
            minHeight: 0,
          }}
        >
          <TwemojiImg emoji="🔗" size={36} />
          {data.description && (
            <span
              style={{
                fontSize: 11,
                color: "#71717a",
                textAlign: "center",
                padding: "0 16px",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {data.description}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          flexShrink: 0,
          height: 40,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderTop: "1px solid #e4e4e7",
          background: "#ffffff",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#18181b",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {data.title || domain}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "#a1a1aa",
            flexShrink: 0,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {domain}
        </span>
      </div>
    </>
  );

  if (safeHref) {
    return (
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        style={cardStyle}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {cardContent}
      </a>
    );
  }

  return (
    <div
      style={cardStyle}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {cardContent}
    </div>
  );
}

const YOUTUBE_ID_RE = /^[\w-]{11}$/;

function YoutubeCard({ data, width }: { data: OgpData; width: number }) {
  const height = Math.round(width * 9 / 16);
  const validId = data.youtubeId && YOUTUBE_ID_RE.test(data.youtubeId);
  if (!validId) return null;
  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: "0 0 8px 8px",
        overflow: "hidden",
        border: "1px solid #e4e4e7",
        borderTop: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <iframe
        src={`https://www.youtube.com/embed/${data.youtubeId}`}
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  );
}

type OgpPreviewItemProps = {
  ogpUrl: string;
  width: number;
  onDismiss?: () => void;
};

function OgpPreviewItem({ ogpUrl, width, onDismiss }: OgpPreviewItemProps) {
  const { data: ogp } = useOgp(ogpUrl);

  if (!ogp) return null;

  return (
    <div style={{ position: "relative", width, pointerEvents: "all" }}>
      {onDismiss && (
        <button
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            zIndex: 20,
            width: 22,
            height: 22,
            borderRadius: 11,
            border: "none",
            background: "rgba(0,0,0,0.45)",
            color: "#fff",
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
          onClick={onDismiss}
          onPointerDown={(e) => e.stopPropagation()}
        >
          ×
        </button>
      )}
      {ogp.isYoutube ? (
        <YoutubeCard data={ogp} width={width} />
      ) : (
        <OgpCard data={ogp} width={width} />
      )}
    </div>
  );
}

type OgpPreviewProps = {
  /** shape.meta.ogpUrls から渡される URL 配列 */
  ogpUrls?: string[];
  /** シェイプの横幅（px） */
  width: number;
  /** 特定 URL の × ボタン押下時のコールバック */
  onDismiss?: (url: string) => void;
};

/**
 * meta.ogpUrls を読んで OGP カード / YouTube iframe を縦に並べて描画するコンポーネント。
 * シェイプの component() 内で overflow:visible の下部コンテナに配置する。
 */
export function OgpPreview({ ogpUrls, width, onDismiss }: OgpPreviewProps) {
  if (!ogpUrls || ogpUrls.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {ogpUrls.map((url) => (
        <OgpPreviewItem
          key={url}
          ogpUrl={url}
          width={width}
          onDismiss={onDismiss ? () => onDismiss(url) : undefined}
        />
      ))}
    </div>
  );
}
