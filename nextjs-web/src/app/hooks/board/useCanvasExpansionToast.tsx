"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Editor, TLRecord, TLShapeId } from "@cmpd/compound";
import { Box2d } from "@cmpd/editor";
import { toast } from "sonner";
import { getCreatedBy, getCreatedByAvatarUrl } from "@/app/shapes/common";
import { getSafeHref } from "@/lib/safeUrl";
import { VIDEO_DEFAULT_W } from "@/app/shapes/media/mediaConstants";

const VIDEO_UNIT = VIDEO_DEFAULT_W;
const GREEN_THRESHOLD_PX = VIDEO_UNIT * 1;
const RED_THRESHOLD_PX = VIDEO_UNIT * 5;
const RED_USER_DOMINANCE_RATIO = 0.8;
const EXPANSION_LOG_WINDOW_MS = 10 * 60 * 1000;
const GREEN_TOAST_DURATION_MS = 1400;
const GRACE_PERIOD_MS = 4000;
const BOUNDS_RECALC_INTERVAL_MS = 60 * 60 * 1000;

function getBoundsBox(bounds: { x: number; y: number; w: number; h: number }) {
  return new Box2d(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h);
}

function getExpansionAmount(known: Box2d, shapeBounds: Box2d): number {
  const left = known.minX - shapeBounds.minX;
  const right = shapeBounds.maxX - known.maxX;
  const top = known.minY - shapeBounds.minY;
  const bottom = shapeBounds.maxY - known.maxY;
  return Math.max(0, left, right, top, bottom);
}

function getCreatedById(shape: { meta?: unknown }): string {
  return ((shape.meta as Record<string, unknown>)?.createdById as string | undefined) ?? "";
}

type ExpansionLogEntry = { userId: string; amount: number; timestamp: number };

/**
 * キャンバス拡大トースト。仕様は docs/canvas-expansion-toast.md を参照。
 */
export function useCanvasExpansionToast(enabled: boolean) {
  const knownMaxBoundsRef = useRef<Box2d | null>(null);
  const expansionLogRef = useRef<ExpansionLogEntry[]>([]);
  const readyAtRef = useRef<number>(0);
  const hasInitializedRef = useRef(false);
  const boundsRecalcIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRecalcHashRef = useRef<string>("");
  const activeToastIdsRef = useRef<Set<string | number>>(new Set());
  const greenDismissTimerByToastIdRef = useRef<Map<string | number, number>>(new Map());
  const isPointerDownRef = useRef(false);
  const pendingShapeIdsRef = useRef<Set<TLShapeId>>(new Set());
  const storeListenerCleanupRef = useRef<(() => void) | null>(null);
  const pointerEventCleanupRef = useRef<(() => void) | null>(null);

  const dismissAllExpansionToasts = useCallback(() => {
    greenDismissTimerByToastIdRef.current.forEach((t) => clearTimeout(t));
    greenDismissTimerByToastIdRef.current.clear();
    activeToastIdsRef.current.forEach((id) => {
      toast.dismiss(id);
    });
    activeToastIdsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!enabled) {
      dismissAllExpansionToasts();
    }
    return () => {
      dismissAllExpansionToasts();
      if (boundsRecalcIntervalRef.current) {
        clearInterval(boundsRecalcIntervalRef.current);
        boundsRecalcIntervalRef.current = null;
      }
      if (storeListenerCleanupRef.current) {
        storeListenerCleanupRef.current();
        storeListenerCleanupRef.current = null;
      }
      if (pointerEventCleanupRef.current) {
        pointerEventCleanupRef.current();
        pointerEventCleanupRef.current = null;
      }
    };
  }, [enabled, dismissAllExpansionToasts]);

  const evaluateShapeExpansion = useCallback(
    (editor: Editor, shapeId: TLShapeId, pageId: string) => {
      const shape = editor.getShape(shapeId);
      if (!shape || shape.parentId !== pageId) return;

      const pageBounds = editor.getShapePageBounds(shape.id);
      if (!pageBounds) return;

      let known = knownMaxBoundsRef.current;
      if (known === null) return;

      const shapeBox = getBoundsBox(pageBounds);
      const expansion = getExpansionAmount(known, shapeBox);
      if (expansion < GREEN_THRESHOLD_PX) return;

      knownMaxBoundsRef.current = Box2d.Common([known, shapeBox]);
      known = knownMaxBoundsRef.current;

      const userId = getCreatedById(shape);
      const now = Date.now();
      expansionLogRef.current.push({ userId, amount: expansion, timestamp: now });
      const cutoff = now - EXPANSION_LOG_WINDOW_MS;
      expansionLogRef.current = expansionLogRef.current.filter((e) => e.timestamp > cutoff);

      const totalInWindow = expansionLogRef.current.reduce((s, e) => s + e.amount, 0);
      const userTotalInWindow = expansionLogRef.current
        .filter((e) => e.userId === userId)
        .reduce((s, e) => s + e.amount, 0);
      const userDominates =
        totalInWindow > 0 && userTotalInWindow / totalInWindow >= RED_USER_DOMINANCE_RATIO;
      const userReachedRed = userTotalInWindow >= RED_THRESHOLD_PX;

      const isRed =
        (expansion >= RED_THRESHOLD_PX || (userDominates && userReachedRed)) && userDominates;

      const name = getCreatedBy(shape);
      const avatarUrl = getSafeHref(getCreatedByAvatarUrl(shape) ?? null);
      const message = `${name}さんがキャンバスを広げました`;
      const duration = isRed ? Infinity : GREEN_TOAST_DURATION_MS;
      const boxClass = isRed
        ? "flex w-fit min-w-0 max-w-[240px] items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-900 shadow dark:border-red-800 dark:bg-red-950/90 dark:text-red-100"
        : "flex w-fit min-w-0 max-w-[240px] items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-700 shadow dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
      const closeBtnClass = isRed
        ? "ml-1 shrink-0 rounded p-0.5 text-red-600 hover:bg-red-100 hover:text-red-900 dark:text-red-300 dark:hover:bg-red-900/60 dark:hover:text-red-50"
        : "ml-1 shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200";

      const toastId = toast.custom(
        (id) => (
          <div className={boxClass}>
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt=""
                className="h-4 w-4 shrink-0 rounded-full"
              />
            )}
            <span className="min-w-0 flex-1 truncate">{message}</span>
            <button
              type="button"
              onClick={() => {
                const t = greenDismissTimerByToastIdRef.current.get(id);
                if (t) {
                  clearTimeout(t);
                  greenDismissTimerByToastIdRef.current.delete(id);
                }
                toast.dismiss(id);
                activeToastIdsRef.current.delete(id);
              }}
              className={closeBtnClass}
              aria-label="閉じる"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ),
        { duration, closeButton: false }
      );
      if (toastId != null) {
        activeToastIdsRef.current.add(toastId);
      }
      if (!isRed && toastId != null) {
        const timer = window.setTimeout(() => {
          greenDismissTimerByToastIdRef.current.delete(toastId);
          toast.dismiss(toastId);
          activeToastIdsRef.current.delete(toastId);
        }, GREEN_TOAST_DURATION_MS);
        greenDismissTimerByToastIdRef.current.set(toastId, timer);
      }
    },
    []
  );

  const registerListener = useCallback(
    (editor: Editor) => {
      if (!enabled) return;

      if (boundsRecalcIntervalRef.current) {
        clearInterval(boundsRecalcIntervalRef.current);
      }
      boundsRecalcIntervalRef.current = setInterval(() => {
        const shapes = editor.getCurrentPageShapes();
        const hash = shapes
          .map((s) => `${s.id}:${(s as { x?: number }).x ?? 0}:${(s as { y?: number }).y ?? 0}`)
          .sort()
          .join(",");
        if (hash === lastRecalcHashRef.current) return;
        lastRecalcHashRef.current = hash;

        const bounds = shapes
          .map((s) => editor.getShapePageBounds(s.id))
          .filter((b): b is NonNullable<typeof b> => b != null);
        if (bounds.length === 0) return;
        knownMaxBoundsRef.current = Box2d.Common(bounds.map(getBoundsBox));
      }, BOUNDS_RECALC_INTERVAL_MS);

      // pointerdown/pointerup を監視してドラッグ中かどうかを判定
      const container = document.getElementById("compound-editor");
      if (!container) return;

      const handlePointerDown = () => {
        isPointerDownRef.current = true;
        pendingShapeIdsRef.current.clear();
      };

      const handlePointerUp = () => {
        if (!isPointerDownRef.current) return;
        isPointerDownRef.current = false;

        // pointerup 時に pending のシェイプを判定
        const pageId = editor.getCurrentPageId();
        if (Date.now() < readyAtRef.current) {
          pendingShapeIdsRef.current.clear();
          return;
        }

        const pendingIds = Array.from(pendingShapeIdsRef.current);
        pendingShapeIdsRef.current.clear();

        // 最初の1つだけ判定（既存の break ロジックに合わせる）
        for (const shapeId of pendingIds) {
          evaluateShapeExpansion(editor, shapeId, pageId);
          break;
        }
      };

      container.addEventListener("pointerdown", handlePointerDown, { passive: true });
      container.addEventListener("pointerup", handlePointerUp, { passive: true });

      pointerEventCleanupRef.current = () => {
        container.removeEventListener("pointerdown", handlePointerDown);
        container.removeEventListener("pointerup", handlePointerUp);
      };

      storeListenerCleanupRef.current = editor.store.listen(
        (entry) => {
          const added = Object.values(entry.changes.added ?? {}) as TLRecord[];
          const updated = Object.values(entry.changes.updated ?? {}).map(
            ([, after]) => after as TLRecord
          );
          const changedShapes = [...added, ...updated].filter(
            (r): r is TLRecord & { typeName: "shape"; type: string; meta?: unknown } =>
              r.typeName === "shape"
          );
          if (changedShapes.length === 0) return;

          const pageId = editor.getCurrentPageId();
          let known = knownMaxBoundsRef.current;

          if (known === null) {
            const shapes = editor.getCurrentPageShapes();
            const bounds = shapes
              .map((s) => editor.getShapePageBounds(s.id))
              .filter((b): b is NonNullable<typeof b> => b != null);
            if (bounds.length === 0) return;
            known = Box2d.Common(bounds.map(getBoundsBox));
            knownMaxBoundsRef.current = known;
            if (!hasInitializedRef.current) {
              hasInitializedRef.current = true;
              readyAtRef.current = Date.now() + GRACE_PERIOD_MS;
            }
            return;
          }

          if (Date.now() < readyAtRef.current) return;

          for (const rec of changedShapes) {
            const shapeId = rec.id as TLShapeId;

            // pointerdown 中なら pending に追加（pointerup 時に判定）
            // これにより、ドラッグ中の連続更新やペン描画の完了を pointerup 時にまとめて判定できる
            if (isPointerDownRef.current) {
              pendingShapeIdsRef.current.add(shapeId);
              continue;
            }

            // pointerdown 中でない場合は即座に判定（リモートの更新など）
            evaluateShapeExpansion(editor, shapeId, pageId);
            break;
          }
        },
        { source: "user", scope: "document" }
      );
    },
    [enabled, evaluateShapeExpansion]
  );

  return { registerListener };
}
