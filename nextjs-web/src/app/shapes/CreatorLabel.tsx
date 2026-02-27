"use client";

/**
 * shape.meta.createdBy から作成者名を取り出すヘルパー。
 * 全シェイプで共通して使用する。
 */
export function getCreatedBy(shape: { meta?: unknown }): string {
  const name = ((shape.meta as Record<string, unknown>)?.createdBy as string | undefined) ?? "";
  return name.trim() || "Unknown";
}

/**
 * シェイプの左上に作成者名を表示するラベル。
 * HTMLContainer の中（シェイプ座標系）に置くことで
 * 移動・ズーム・回転に自動追従する。
 */
export function CreatorLabel({ name }: { name: string }) {
  if (!name) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: -20,
        left: 0,
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
        zIndex: 1,
      }}
    >
      <span
        style={{
          display: "inline-block",
          background: "rgba(0,0,0,0.55)",
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
