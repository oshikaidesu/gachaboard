"use client";

import type { Editor } from "@cmpd/compound";

/**
 * shape.meta.createdBy から作成者名を取り出すヘルパー。
 * 全シェイプで共通して使用する。
 */
export function getCreatedBy(shape: { meta?: unknown }): string {
  const name = ((shape.meta as Record<string, unknown>)?.createdBy as string | undefined) ?? "";
  return name.trim() || "Unknown";
}

const RANK_FULLY_GREY = 10;
// 緑→黒の線形補間だと中間が濁るため、エメラルド系とダークグレーで補間
const GREEN = { r: 16, g: 185, b: 129, a: 0.9 }; // emerald-500 風
const GREY = { r: 63, g: 63, b: 70, a: 0.85 }; // zinc-700 風

function getBackgroundForRank(rank: number): string {
  if (rank <= 0 || rank > RANK_FULLY_GREY) {
    return `rgba(${GREY.r},${GREY.g},${GREY.b},${GREY.a})`;
  }
  const t = Math.min(1, (rank - 1) / (RANK_FULLY_GREY - 1));
  const r = Math.round(GREEN.r * (1 - t) + GREY.r * t);
  const g = Math.round(GREEN.g * (1 - t) + GREY.g * t);
  const b = Math.round(GREEN.b * (1 - t) + GREY.b * t);
  const a = GREEN.a * (1 - t) + GREY.a * t;
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * 現在ページ内で、作成日時順（新しい順）に並べたときの順位を返す。
 * 1＝1番新しい、2＝2番目、…。createdAt がないシェイプは最後尾扱い。
 */
export function getCreationRank(
  editor: Editor,
  shape: { id: string; meta?: unknown }
): number {
  const shapes = editor.getCurrentPageShapes();
  const sorted = [...shapes].sort((a, b) => {
    const at = (a.meta as { createdAt?: number })?.createdAt ?? 0;
    const bt = (b.meta as { createdAt?: number })?.createdAt ?? 0;
    if (bt !== at) return bt - at;
    return a.id.localeCompare(b.id);
  });
  const idx = sorted.findIndex((s) => s.id === shape.id);
  return idx >= 0 ? idx + 1 : Number.POSITIVE_INFINITY;
}

/**
 * シェイプの左上に作成者名を表示するラベル。
 * HTMLContainer の中（シェイプ座標系）に置くことで
 * 移動・ズーム・回転に自動追従する。
 * rank を渡すと、新しいシェイプほど緑、古いほどグレーの背景になる。
 * ※左上コーナーハンドル(RESIZE_HANDLE_SIZE/2 + scale*6 ≒ 30px)と重ならないよう left を確保
 */
const LABEL_TOP = -20;
const LABEL_LEFT = 28;

export function CreatorLabel({ name, rank }: { name: string; rank?: number }) {
  if (!name) return null;
  const background =
    rank !== undefined ? getBackgroundForRank(rank) : `rgba(${GREY.r},${GREY.g},${GREY.b},${GREY.a})`;
  return (
    <div
      style={{
        position: "absolute",
        top: LABEL_TOP,
        left: LABEL_LEFT,
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
        zIndex: 1,
      }}
    >
      <span
        style={{
          display: "inline-block",
          background,
          color: "#fff",
          fontSize: 10,
          fontFamily: "system-ui, sans-serif",
          fontWeight: 500,
          padding: "1px 5px",
          borderRadius: 3,
          lineHeight: "16px",
        }}
      >
        {name}
      </span>
    </div>
  );
}
