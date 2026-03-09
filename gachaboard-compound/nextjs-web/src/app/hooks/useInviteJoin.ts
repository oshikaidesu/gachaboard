"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export function useInviteJoin(token: string) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async () => {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${token}/join`, { method: "POST" });
      if (!res.ok) throw new Error("参加に失敗しました");
      const { workspaceId } = await res.json();
      router.replace(`/workspace/${workspaceId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setJoining(false);
    }
  }, [token, router]);

  return { join, joining, error };
}
