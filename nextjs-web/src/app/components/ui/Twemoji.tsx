"use client";

import twemoji from "@twemoji/api";

const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/";
const TWEMOJI_FOLDER = "svg";
const TWEMOJI_EXT = ".svg";

/**
 * 絵文字 Unicode を Twemoji CDN の SVG URL に変換する
 * parse の callback で正規化された codepoint を取得（❤️→2764 など）
 */
export function twemojiUrl(emoji: string): string {
  let icon = "";
  twemoji.parse(emoji, {
    folder: TWEMOJI_FOLDER,
    ext: TWEMOJI_EXT,
    callback: (i) => {
      icon = i;
      return false;
    },
  });
  if (!icon) return "";
  return `${TWEMOJI_BASE}${TWEMOJI_FOLDER}/${icon}${TWEMOJI_EXT}`;
}

type TwemojiImgProps = {
  emoji: string;
  size?: number;
  style?: React.CSSProperties;
};

/**
 * 絵文字を Twemoji 画像で表示するコンポーネント
 */
export function TwemojiImg({ emoji, size = 16, style }: TwemojiImgProps) {
  return (
    <img
      src={twemojiUrl(emoji)}
      alt={emoji}
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "middle", pointerEvents: "none", ...style }}
      draggable={false}
    />
  );
}
