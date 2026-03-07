"use client";

/**
 * 接続中のユーザー一覧を表示。Yjs Awareness から取得。
 */
import { useEffect, useState } from "react";
import type { WebsocketProvider } from "y-websocket";

type UserSharePanelProps = {
  provider: WebsocketProvider;
  localUserId?: string;
};

type User = { id: string; name: string; color: string; avatarUrl?: string | null };

function getUsers(provider: WebsocketProvider): User[] {
  const states = provider.awareness.getStates();
  const seen = new Set<string>();
  const users: User[] = [];
  states.forEach((state) => {
    const user = state?.user as { id?: string; name?: string; color?: string; avatarUrl?: string | null } | undefined;
    if (user?.name && user.id && !seen.has(user.id)) {
      seen.add(user.id);
      users.push({
        id: user.id,
        name: user.name,
        color: user.color ?? "#888888",
        avatarUrl: user.avatarUrl ?? null,
      });
    }
  });
  return users;
}

export function UserSharePanel({ provider, localUserId }: UserSharePanelProps) {
  const [users, setUsers] = useState<User[]>(() => getUsers(provider));

  useEffect(() => {
    const update = () => setUsers(getUsers(provider));
    update(); // 初回
    provider.awareness.on("change", update);
    return () => provider.awareness.off("change", update);
  }, [provider]);

  // 部屋にいる全員を表示（自分含む）
  const displayUsers = users;

  if (displayUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5" title={displayUsers.map((u) => u.name).join(", ")}>
      <div className="flex -space-x-2">
        {displayUsers.slice(0, 8).map((u) => (
          <div
            key={u.id}
            className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-white bg-zinc-200 shadow-sm ring-1 ring-zinc-200"
            title={u.name}
          >
            {u.avatarUrl ? (
              <img
                src={u.avatarUrl}
                alt={u.name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ backgroundColor: u.color }}
                title={u.name}
              />
            )}
          </div>
        ))}
        {displayUsers.length > 8 && (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-[10px] font-medium text-zinc-600 shadow-sm ring-1 ring-zinc-200"
            title={displayUsers.map((u) => u.name).join(", ")}
          >
            +{displayUsers.length - 8}
          </div>
        )}
      </div>
    </div>
  );
}
