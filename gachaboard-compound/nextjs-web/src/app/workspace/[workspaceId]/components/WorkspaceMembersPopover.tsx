"use client";

import { useState, useRef } from "react";
import type { ApiWorkspaceMember } from "@shared/apiTypes";
import { Identicon } from "@/app/components/ui/Identicon";
import { useOnClickOutside } from "usehooks-ts";
import { getSafeHref } from "@/lib/safeUrl";

type Props = {
  members: ApiWorkspaceMember[];
  canKick: boolean;
  workspaceId: string;
  currentUserId: string;
  onKickSuccess?: () => void;
};

export function WorkspaceMembersPopover({
  members,
  canKick,
  workspaceId,
  currentUserId,
  onKickSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(containerRef, () => {
    if (open) setOpen(false);
  });

  const kickMember = async (userId: string, discordName: string) => {
    const isSelf = userId === currentUserId;
    const msg = isSelf
      ? "ワークスペースを退出しますか？\n招待リンクもリセットされます。"
      : `${discordName} をワークスペースから削除しますか？\n招待リンクもリセットされます。`;
    if (!confirm(msg)) return;
    setKickingUserId(userId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setOpen(false);
        onKickSuccess?.();
      }
    } finally {
      setKickingUserId(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-slate-600 dark:bg-slate-800"
        aria-label="メンバー一覧"
        title="メンバー一覧"
      >
        <div className="flex -space-x-2">
          {members.slice(0, 8).length === 0 ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs text-zinc-500 dark:bg-slate-600 dark:text-slate-400">
              —
            </span>
          ) : (
            members.slice(0, 8).map((m) => {
              const safeAvatar = getSafeHref(m.avatarUrl);
              return (
                <div
                  key={m.userId}
                  className="ring-2 ring-zinc-50 dark:ring-slate-800"
                  title={m.discordName}
                >
                  {safeAvatar ? (
                    <img
                      src={safeAvatar}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <Identicon value={m.userId} size={28} />
                  )}
                </div>
              );
            })
          )}
          {members.length > 8 && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs text-zinc-600 dark:bg-slate-600 dark:text-slate-300">
              +{members.length - 8}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[200px] rounded-lg border border-zinc-200 bg-white py-2 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <p className="px-4 py-1 text-xs font-medium text-zinc-500 dark:text-slate-400">
            メンバー
          </p>
          {members.map((m) => {
            const safeAvatar = getSafeHref(m.avatarUrl);
            return (
              <div
                key={m.userId}
                className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-slate-700"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {safeAvatar ? (
                    <img
                      src={safeAvatar}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <Identicon value={m.userId} size={32} />
                  )}
                  <span className="truncate text-sm text-zinc-800 dark:text-slate-200">
                  {m.discordName}
                  {m.role === "owner" && (
                    <span className="ml-1 text-zinc-400 dark:text-slate-500">
                      (オーナー)
                    </span>
                  )}
                </span>
              </div>
              {canKick && m.role === "member" && (
                <button
                  type="button"
                  onClick={() => kickMember(m.userId, m.discordName)}
                  disabled={kickingUserId === m.userId}
                  className="shrink-0 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/50 dark:text-red-400"
                >
                  {kickingUserId === m.userId
                    ? m.userId === currentUserId
                      ? "退出中..."
                      : "削除中..."
                    : m.userId === currentUserId
                      ? "（退出）"
                      : "キック"}
                </button>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
