"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getE2EHeadersFromUrl } from "@/lib/e2eFetch";

export function useInviteJoin(token: string) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async () => {
    setJoining(true);
    setError(null);
    try {
      const e2e = getE2EHeadersFromUrl();
      const headers: HeadersInit = e2e ? { "X-E2E-User-Id": e2e.userId, "X-E2E-User-Name": e2e.userName } : {};
      const res = await fetch(`/api/invite/${token}/join`, { method: "POST", credentials: "include", headers });
      if (res.status === 401) {
        setJoining(false);
        router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error((msg as { error?: string }).error ?? "参加に失敗しました。招待リンクが無効か、期限切れの可能性があります。");
      }
      const data = await res.json();
      const workspaceId = (data as { workspaceId?: string }).workspaceId;
      if (!workspaceId) throw new Error("参加に失敗しました。");
      const search = typeof window !== "undefined" && window.location.search?.includes("testUserId")
        ? window.location.search
        : "";
      router.replace(`/workspace/${workspaceId}${search}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setJoining(false);
    }
  }, [token, router]);

  return { join, joining, error };
}
