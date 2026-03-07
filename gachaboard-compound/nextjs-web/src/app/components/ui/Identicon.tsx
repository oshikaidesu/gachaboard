"use client";

import { minidenticon } from "minidenticons";

/** minidenticons と同じハッシュで value から色を算出（カード背景などに利用） */
export function getMinidenticonColor(value: string, saturation: number, lightness: number): string {
  const MAGIC_NUMBER = 5;
  const COLORS_NB = 9;
  const hash = value
    .split("")
    .reduce((h, c) => (h ^ c.charCodeAt(0)) * -MAGIC_NUMBER, MAGIC_NUMBER) >>> 2;
  const hue = (hash % COLORS_NB) * (360 / COLORS_NB);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

type Props = {
  /** ワークスペースID・ボードIDなど、一意の文字列 */
  value: string;
  /** アイコンサイズ（px） */
  size?: number;
  /** 彩度（0-100） */
  saturation?: number;
  /** 明度（0-100） */
  lightness?: number;
  /** 角丸 */
  className?: string;
};

/**
 * かわいいピクセル風 Identicon。
 * 背景は minidenticons 由来の色、アイコンは白。
 * @see https://github.com/laurentpayot/minidenticons
 */
export function Identicon({
  value,
  size = 40,
  saturation = 45,
  lightness = 58,
  className = "",
}: Props) {
  const bgColor = getMinidenticonColor(value, saturation, lightness);
  const svg = minidenticon(value, saturation, lightness)
    .replace("<svg ", '<svg width="100%" height="100%" ')
    .replace(/fill="hsl\([^"]+\)"/, 'fill="white"');

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-md ${className}`}
      style={{ width: size, height: size, backgroundColor: bgColor }}
      role="img"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
