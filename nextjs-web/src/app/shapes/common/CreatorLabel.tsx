"use client";

import type { Editor } from "@cmpd/compound";
import { UserAvatarLabel } from "./UserAvatarLabel";

/**
 * shape.meta.createdBy から作成者名を取り出すヘルパー。
 * 全シェイプで共通して使用する。
 */
export function getCreatedBy(shape: { meta?: unknown }): string {
  const name = ((shape.meta as Record<string, unknown>)?.createdBy as string | undefined) ?? "";
  return name.trim() || "Unknown";
}

/**
 * shape.meta.createdByAvatarUrl から作成者の Discord アバター URL を取り出すヘルパー。
 */
export function getCreatedByAvatarUrl(shape: { meta?: unknown }): string | null {
  const url = ((shape.meta as Record<string, unknown>)?.createdByAvatarUrl as string | undefined | null) ?? null;
  return url && typeof url === "string" ? url : null;
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

type ShapeWithMeta = { id: string; meta?: unknown };

/**
 * 現在ページ内のシェイプを、作成日時順（新しい順）にソートした配列を返す。
 * createdAt がないシェイプは最後尾。同値なら id 辞書順。
 * getCreationRank と getLatestShapeIds で共通利用。
 */
export function getShapesSortedByCreationDesc(editor: Editor): ShapeWithMeta[] {
  const shapes = editor.getCurrentPageShapes();
  return [...shapes].sort((a, b) => {
    const at = (a.meta as { createdAt?: number })?.createdAt ?? 0;
    const bt = (b.meta as { createdAt?: number })?.createdAt ?? 0;
    if (bt !== at) return bt - at;
    return a.id.localeCompare(b.id);
  });
}

/**
 * 現在ページ内で、作成日時順（新しい順）に並べたときの順位を返す。
 * 1＝1番新しい、2＝2番目、…。createdAt がないシェイプは最後尾扱い。
 */
export function getCreationRank(
  editor: Editor,
  shape: { id: string; meta?: unknown }
): number {
  const sorted = getShapesSortedByCreationDesc(editor);
  const idx = sorted.findIndex((s) => s.id === shape.id);
  return idx >= 0 ? idx + 1 : Number.POSITIVE_INFINITY;
}

/**
 * 作成日時順（新しい順）で上位 limit 件のシェイプ ID を返す。
 * デフォルトは5件。シェイプが少ない場合は存在する分だけ返す。
 */
export function getLatestShapeIds(editor: Editor, limit = 5): string[] {
  const sorted = getShapesSortedByCreationDesc(editor);
  return sorted.slice(0, limit).map((s) => s.id);
}

/**
 * シェイプの左上に作成者名を表示するラベル。
 * HTMLContainer の中（シェイプ座標系）に置くことで
 * 移動・ズーム・回転に自動追従する。
 * rank を渡すと、新しいシェイプほど緑、古いほどグレーの背景になる。
 * ※左上コーナーハンドルと重ならないよう left を確保
 */
export const LABEL_TOP = -20;
export const LABEL_LEFT = 20;

export function CreatorLabel({
  name,
  avatarUrl,
  rank,
  rightSlot,
}: {
  name: string;
  avatarUrl?: string | null;
  rank?: number;
  /** ラベルの右隣に表示する要素（例: アイコン切替ボタン）。pointerEvents: "all" でクリック可能にすること */
  rightSlot?: React.ReactNode;
}) {
  if (!name && !rightSlot) return null;
  const background =
    rank !== undefined ? getBackgroundForRank(rank) : `rgba(${GREY.r},${GREY.g},${GREY.b},${GREY.a})`;
  const labelContent = name ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background,
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        fontWeight: 500,
        padding: "2px 6px",
        borderRadius: 3,
        lineHeight: "16px",
      }}
    >
      <UserAvatarLabel
        name={name}
        avatarUrl={avatarUrl}
        size="sm"
        minWidth={56}
        maxWidth={140}
        style={{ color: "#fff" }}
      />
    </span>
  ) : null;

  const content = rightSlot ? (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {labelContent}
      <span style={{ pointerEvents: "all", display: "inline-flex" }}>{rightSlot}</span>
    </div>
  ) : (
    labelContent
  );

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
      {content}
    </div>
  );
}
