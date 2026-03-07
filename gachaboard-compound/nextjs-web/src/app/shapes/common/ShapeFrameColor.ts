/**
 * シェイプ枠線用の色ユーティリティ。
 * Geo / Arrow と同じ色ルールで、カスタムシェイプにも枠を適用する。
 *
 * getColorForShape: シェイプIDから TLDefaultColorStyle を決定
 * getStrokeHexForColorStyle: DefaultColorThemePalette lightMode の solid 値（矢印描画と同じ色）
 */

import type { TLDefaultColorStyle } from "@cmpd/compound";

/** Geo / Arrow で使っている pastel パレットと同じ */
const PASTEL_COLORS: TLDefaultColorStyle[] = [
  "light-blue",
  "light-green",
  "light-violet",
  "light-red",
  "yellow",
  "orange",
  "blue",
  "green",
  "violet",
];

/**
 * シェイプIDから色スタイルを決定（矢印も同じルールで個別色を割り当て済み）
 */
export function getColorForShape(shapeId: string): TLDefaultColorStyle {
  let hash = 0;
  for (let i = 0; i < shapeId.length; i++) {
    hash = (hash << 5) - hash + shapeId.charCodeAt(i);
    hash = hash & hash;
  }
  return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
}

/**
 * 矢印と同一の色（DefaultColorThemePalette lightMode の solid 値）
 */
const STROKE_HEX: Record<TLDefaultColorStyle, string> = {
  black: "#1d1d1d",
  grey: "#adb5bd",
  "light-violet": "#e599f7",
  violet: "#ae3ec9",
  blue: "#4263eb",
  "light-blue": "#4dabf7",
  yellow: "#facc15",
  orange: "#f76707",
  green: "#099268",
  "light-green": "#40c057",
  "light-red": "#ff8787",
  red: "#e03131",
};

/**
 * TLDefaultColorStyle を枠線用 HEX に変換
 */
export function getStrokeHexForColorStyle(color: TLDefaultColorStyle): string {
  return STROKE_HEX[color] ?? STROKE_HEX.blue;
}
