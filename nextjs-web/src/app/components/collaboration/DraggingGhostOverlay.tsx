"use client";

/**
 * 他ユーザーがドラッグ中のシェイプをリアルタイムで表示する軽量ゴースト。
 * meta.dragging（awareness）のみを使用し、Y.Doc 同期はドロップ時のみ。
 * 元のシェイプのジオメトリ（サイズ・回転）を参照する。
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
  x,
  y,
  color,
}: {
  shapeId: TLShapeId;
  x: number;
  y: number;
  color: string;
}) {
  const editor = useEditor();
  const rSvg = useRef<SVGSVGElement>(null);

  const geometry = editor.getShapeGeometry(shapeId);
  const pageTransform = editor.getShapePageTransform(shapeId);
  const bounds = geometry?.bounds;
  const rotation = pageTransform?.rotation() ?? 0;

  useTransform(rSvg, x, y, 1, rotation);

  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return null;

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
  const presence = usePresence(userId);
  const dragging = (presence?.meta as { dragging?: { shapeId: string; x: number; y: number } | null })
    ?.dragging;
  if (!presence || !dragging?.shapeId) return null;

  const color = getSafeColor(presence.color) ?? "#888888";
  return (
    <GhostShape
      shapeId={dragging.shapeId as TLShapeId}
      x={dragging.x}
      y={dragging.y}
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
