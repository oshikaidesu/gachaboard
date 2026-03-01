"use client";

import { useState, useEffect, useRef } from "react";
import { useEditor, useValue, useTransform, useSharedSafeId, type TLCursorProps } from "@tldraw/tldraw";

/**
 * Discord アバター付きコラボレーターカーソル。
 * 3秒間カーソルが動かなかった場合にフェードアウトする。
 * useTransform で DefaultCursor と同じ方法でキャンバス座標に配置する。
 */
export function CollaboratorCursorWithName(props: TLCursorProps) {
  const { name, color, point, zoom, userId } = props;

  const editor = useEditor();
  const rCursor = useRef<HTMLDivElement>(null);
  const cursorId = useSharedSafeId("cursor");

  // presence の meta から avatarUrl を取得
  const avatarUrl = useValue("collaboratorAvatar", () => {
    const collaborators = editor.getCollaborators();
    const collaborator = collaborators.find((c) => c.userId === userId);
    // TLInstancePresence の meta フィールドに avatarUrl を格納している
    const meta = (collaborator as { meta?: Record<string, unknown> } | undefined)?.meta;
    return (meta?.avatarUrl as string | null | undefined) ?? null;
  }, [editor, userId]);

  // キャンバス座標への位置変換のみ行い、スケールは 1/zoom で打ち消す
  useTransform(rCursor, point?.x, point?.y, 1 / zoom);

  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!point) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [point?.x, point?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!point) return null;

  return (
    <div
      ref={rCursor}
      className="tl-overlays__item"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}
    >
      {/* カーソル SVG（DefaultCursor と同じ構造） */}
      <svg className="tl-cursor" aria-hidden="true">
        <use href={`#${cursorId}`} color={color} />
      </svg>

      {/* 名前タグ + アバター：zoom の逆数スケールを打ち消して画面上のサイズを固定 */}
      {name && (
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
          {name}
        </div>
      )}
    </div>
  );
}
