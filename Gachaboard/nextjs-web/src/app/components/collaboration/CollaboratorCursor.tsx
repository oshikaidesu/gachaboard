"use client";

import { useRef, useState, useEffect } from "react";
import { useTransform } from "@cmpd/editor";
import classNames from "classnames";
import { UserAvatarLabel } from "@/app/shapes/common/UserAvatarLabel";

const IDLE_HIDE_MS = 5000;

/**
 * Discord アバター付きコラボレーターカーソル。
 * LiveCollaborators から point, color, zoom, name, meta を受け取り、
 * UserAvatarLabel で名前タグを表示する。
 * 5秒間操作がないと非表示になる。
 */
export function CollaboratorCursorWithName(props: {
  className?: string;
  point: { x: number; y: number } | null;
  color?: string;
  zoom: number;
  name: string | null;
  chatMessage: string;
  meta?: { avatarUrl?: string | null };
}) {
  const { point, color, zoom, name, chatMessage, meta, className } = props;
  const rCursor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const lastPointRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!point) return;
    const pointKey = `${point.x},${point.y}`;
    const isNewPosition = pointKey !== lastPointRef.current;
    lastPointRef.current = pointKey;

    if (isNewPosition) {
      setVisible(true);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      timeoutRef.current = null;
    }, IDLE_HIDE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [point?.x, point?.y]);

  if (!point) return null;

  useTransform(rCursor, point.x, point.y, 1 / zoom);

  return (
    <div
      ref={rCursor}
      className={classNames("tl-overlays__item", className)}
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease-out",
        pointerEvents: visible ? undefined : "none",
      }}
    >
      <svg className="tl-cursor" aria-hidden="true">
        <use href="#cursor" color={color} />
      </svg>

      {(name || chatMessage) && (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 8,
            background: color ?? "#1d1d1d",
            color: "#fff",
            padding: "3px 6px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
            fontFamily: "sans-serif",
            fontWeight: 500,
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          {name && (
            <UserAvatarLabel
              name={name}
              avatarUrl={meta?.avatarUrl ?? null}
              size="md"
              style={{ color: "#fff" }}
            />
          )}
          {chatMessage && (
            <span className="opacity-80">{chatMessage}</span>
          )}
        </div>
      )}
    </div>
  );
}
