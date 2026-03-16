"use client";

/**
 * 他ユーザーがドラッグ中のシェイプをリアルタイムで表示する軽量ゴースト。
 * meta.dragging（awareness）のみを使用し、Y.Doc 同期はドロップ時のみ。
 * 元のシェイプのジオメトリ（サイズ）を参照する。
 */
import type { TLShapeId } from "@cmpd/tlschema";
import { toDomPrecision, useEditor, useTransform } from "@cmpd/editor";
import { useValue } from "@cmpd/state";
import { useMemo } from "react";
import { useRef } from "react";
import { getSafeColor } from "@/lib/safeUrl";

function usePeerIds() {
  const editor = useEditor();
  const $presences = useMemo(
    () =>
      editor.store.query.records("instance_presence", () => ({
        userId: { neq: editor.user.getId() },
      })),
    [editor]
  );
  return useValue(
    "peerIds",
    () => [...new Set($presences.get().map((p) => p.userId))].sort(),
    []
  );
}

function usePresence(userId: string) {
  const editor = useEditor();
  const $presences = useMemo(
    () =>
      editor.store.query.records("instance_presence", () => ({
        userId: { eq: userId },
      })),
    [editor, userId]
  );
  return useValue(
    `latestPresence:${userId}`,
    () =>
      $presences
        .get()
        .slice()
        .sort((a, b) => b.lastActivityTimestamp - a.lastActivityTimestamp)[0] ?? null,
    []
  );
}

const GHOST_OPACITY = 0.35;

function GhostShape({
  shapeId,
  topLeftX,
  topLeftY,
  color,
}: {
  shapeId: TLShapeId;
  topLeftX: number;
  topLeftY: number;
  color: string;
}) {
  const editor = useEditor();
  const rSvg = useRef<SVGSVGElement>(null);

  const geometry = editor.getShapeGeometry(shapeId);
  const bounds = geometry?.bounds;

  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return null;

  // dragging は shape origin の page 座標。ゴーストはページ上のシェイプなのでズームに合わせてスケール（1/zoom は不要）
  useTransform(rSvg, topLeftX, topLeftY);

  return (
    <svg
      ref={rSvg}
      className="tl-overlays__item tl-dragging-ghost"
      style={{ pointerEvents: "none" }}
    >
      <rect
        width={toDomPrecision(bounds.w)}
        height={toDomPrecision(bounds.h)}
        fill={color}
        opacity={GHOST_OPACITY}
        rx={4}
        ry={4}
      />
    </svg>
  );
}

function PeerDraggingGhost({ userId }: { userId: string }) {
  const editor = useEditor();
  const presence = usePresence(userId);
  const dragging = (presence?.meta as { dragging?: { shapeId: string; x: number; y: number } | null })
    ?.dragging;
  if (!presence || !dragging?.shapeId) return null;

  const color = getSafeColor(presence.color) ?? "#888888";
  const bounds = editor.getShapeGeometry(dragging.shapeId as TLShapeId)?.bounds;
  // dragging は shape origin の page 座標。bounds は geometry の local オフセット（y は座標系で反転するため減算）
  const topLeftX = dragging.x + (bounds?.x ?? 0);
  const topLeftY = dragging.y - (bounds?.y ?? 0);

  return (
    <GhostShape
      shapeId={dragging.shapeId as TLShapeId}
      topLeftX={topLeftX}
      topLeftY={topLeftY}
      color={color}
    />
  );
}

export function DraggingGhostOverlay() {
  const peerIds = usePeerIds();
  return (
    <>
      {peerIds.map((userId) => (
        <PeerDraggingGhost key={userId} userId={userId} />
      ))}
    </>
  );
}
