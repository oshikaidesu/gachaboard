"use client";

import { useRef, useState, useEffect } from "react";
import {
  useEditor,
  useValue,
  usePeerIds,
  USER_COLORS,
} from "@tldraw/tldraw";
import { useBoardContext } from "./BoardContext";

/**
 * tldraw の SharePanel を置き換えるカスタムパネル。
 * デフォルトの人数ボタンは維持しつつ、
 * ポップアップ先頭を「自分の行」ではなくカラーパレットに置き換える。
 */
export function UserSharePanel() {
  const { avatarUrl } = useBoardContext();
  const editor = useEditor();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const myColor = useValue("myColor", () => editor.user.getColor(), [editor]);
  const myName = useValue("myName", () => editor.user.getName(), [editor]);
  const peerIds = usePeerIds();
  const collaborators = useValue("collaborators", () => editor.getCollaborators(), [editor]);
  const followingUserId = useValue("following", () => editor.getInstanceState().followingUserId, [editor]);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // キャンバス操作（ポインターダウン・ホイール）で追従を自動解除
  useEffect(() => {
    if (!followingUserId) return;
    const canvas = editor.getContainer();
    const stop = () => editor.stopFollowingUser();
    canvas.addEventListener("pointerdown", stop);
    canvas.addEventListener("wheel", stop);
    return () => {
      canvas.removeEventListener("pointerdown", stop);
      canvas.removeEventListener("wheel", stop);
    };
  }, [editor, followingUserId]);

  const handleFollowToggle = (userId: string) => {
    if (followingUserId === userId) {
      editor.stopFollowingUser();
    } else {
      editor.startFollowingUser(userId);
      setIsOpen(false);
    }
  };

  // コラボレーターが誰もいなければ表示しない（デフォルトと同じ挙動）
  if (peerIds.length === 0) return null;

  const visiblePeerIds = peerIds.slice(-5);

  return (
    <div className="tlui-share-zone" draggable={false} style={{ position: "relative" }}>
      {/* デフォルトPeopleMenu風のトリガー（人数アバター） */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((v) => !v)}
        title="ユーザーメニュー"
        style={{
          cursor: "pointer",
          background: "transparent",
          border: "none",
          padding: 0,
          display: "flex",
          alignItems: "center",
          outline: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {visiblePeerIds.map((userId) => {
            const col = collaborators.find((c) => c.userId === userId);
            const color = col?.color ?? "#999";
            const meta = (col as { meta?: Record<string, unknown> } | undefined)?.meta;
            const colAvatar = meta?.avatarUrl as string | null | undefined;
            const initial = (col?.userName ?? "?").charAt(0).toUpperCase();
            return (
              <div
                key={userId}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: `2px solid ${color}`,
                  overflow: "hidden",
                  background: color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {colAvatar ? (
                  <img src={colAvatar} alt={col?.userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, userSelect: "none" }}>{initial}</span>
                )}
              </div>
            );
          })}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `2px solid ${myColor}`,
              overflow: "hidden",
              background: myColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={myName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, userSelect: "none" }}>
                {(myName || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* ポップオーバー */}
      {isOpen && (
        <div
          ref={popoverRef}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 9999,
            background: "#fff",
            border: "1px solid #e4e4e7",
            borderRadius: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
            padding: "10px",
            minWidth: 220,
          }}
        >
          {/* 「新規ユーザー」行の代わりにカラーパレット */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#71717a", marginBottom: 6 }}>カーソルの色</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
              {USER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => editor.user.updateUserPreferences({ color: c })}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: c,
                    border: `2.5px solid ${myColor === c ? "#18181b" : "transparent"}`,
                    cursor: "pointer",
                    padding: 0,
                    transition: "transform 0.1s",
                    outline: "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                />
              ))}
            </div>
          </div>

          {/* 他ユーザー一覧 */}
          {collaborators.length > 0 && (
            <>
              <div style={{ height: 1, background: "#f4f4f5", margin: "8px 0" }} />
              <div style={{ fontSize: 11, color: "#71717a", marginBottom: 5 }}>接続中のユーザー（クリックで追従）</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {collaborators.map(({ userId, userName, color }) => {
                  const meta = (editor.getCollaborators().find(c => c.userId === userId) as { meta?: Record<string, unknown> } | undefined)?.meta;
                  const colAvatar = meta?.avatarUrl as string | null | undefined;
                  const isFollowing = followingUserId === userId;
                  return (
                    <button
                      key={userId}
                      onClick={() => handleFollowToggle(userId)}
                      title={isFollowing ? "追従を解除" : "このユーザーを追従"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "4px 6px",
                        borderRadius: 6,
                        background: isFollowing ? `${color}18` : "transparent",
                        border: `1px solid ${isFollowing ? color : "transparent"}`,
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                        outline: "none",
                      }}
                      onMouseEnter={(e) => { if (!isFollowing) e.currentTarget.style.background = "#f4f4f5"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isFollowing ? `${color}18` : "transparent"; }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: color,
                          border: `2px solid ${color}`,
                          overflow: "hidden",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {colAvatar ? (
                          <img src={colAvatar} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, userSelect: "none" }}>
                            {(userName ?? "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: "#18181b", flex: 1 }}>{userName ?? userId}</span>
                      {isFollowing && (
                        <span style={{ fontSize: 10, color: color, fontWeight: 600 }}>追従中</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
