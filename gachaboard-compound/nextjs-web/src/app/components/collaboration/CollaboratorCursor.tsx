"use client";

import { useRef } from "react";
import { useTransform } from "@cmpd/editor";
import classNames from "classnames";

/**
 * Discord アバター付きコラボレーターカーソル。
 * LiveCollaborators から point, color, zoom, name, meta を受け取り、
 * meta.avatarUrl（Discord アバター）を名前タグ横に表示する。
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

  if (!point) return null;

  useTransform(rCursor, point.x, point.y, 1 / zoom);

  const avatarUrl = meta?.avatarUrl ?? null;

  return (
    <div
      ref={rCursor}
      className={classNames("tl-overlays__item", className)}
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
            fontSize: 12,
            lineHeight: 1,
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
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
                display: "block",
              }}
            />
          )}
          {chatMessage ? (
            <>
              {name && <span>{name}</span>}
              <span className="opacity-80">{chatMessage}</span>
            </>
          ) : (
            name
          )}
        </div>
      )}
    </div>
  );
}
