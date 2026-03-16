"use client";

import { useState, useEffect } from "react";
import type { E2EHeaders } from "@/lib/e2eFetch";
import { withE2EHeaders } from "@/lib/e2eFetch";

/**
 * sync-server ゲート用の短期トークンを取得する。
 * - enabled が false のときは取得せず null（トークンなしで接続＝ゲート未使用時）
 * - 取得成功: string
 * - 403 等: null（接続しない）
 * - 取得中: undefined（接続を遅延）
 */
export function useSyncToken(
  boardId: string,
  enabled: boolean,
  e2eHeaders?: E2EHeaders | null
): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(enabled ? undefined : null);

  useEffect(() => {
    if (!enabled) {
      setToken(null);
      return;
    }
    let cancelled = false;
    setToken(undefined);
    fetch(`/api/sync-token?boardId=${encodeURIComponent(boardId)}`, {
      credentials: "include",
      headers: withE2EHeaders({}, e2eHeaders),
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) return res.json();
        setToken(null);
      })
      .then((data) => {
        if (cancelled || !data?.token) return;
        setToken(data.token);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, enabled, e2eHeaders]);

  return token;
}
