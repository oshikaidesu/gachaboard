"use client";

import { useState, useEffect } from "react";
import type { E2EHeaders } from "@/lib/e2eFetch";
import { withE2EHeaders } from "@/lib/e2eFetch";

/** トークン TTL 30分の 80% = 24分ごとに再取得（再接続時の期限切れ防止） */
const TOKEN_REFRESH_INTERVAL_MS = 24 * 60 * 1000;

/** リトライ間隔: 2s, 4s, 8s（最大3回） */
const RETRY_DELAYS_MS = [2000, 4000, 8000];

/** 取得成功: string, 403等: null, ネットワークエラー: throw */
function fetchToken(
  boardId: string,
  e2eHeaders: E2EHeaders | null | undefined
): Promise<string | null> {
  return fetch(`/api/sync-token?boardId=${encodeURIComponent(boardId)}`, {
    credentials: "include",
    headers: withE2EHeaders({}, e2eHeaders),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data?.token ? data.token : null));
}

/**
 * sync-server ゲート用の短期トークンを取得する。
 * - enabled が false のときは取得せず null（トークンなしで接続＝ゲート未使用時）
 * - 取得成功: string（TTL 80% ごとに定期更新）
 * - 403 等: null（接続しない）
 * - 取得中: undefined（接続を遅延）
 * - ネットワークエラー時は指数バックオフでリトライ（2s, 4s, 8s）
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

    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const doFetch = (retryIndex = 0) => {
      if (cancelled) return;
      fetchToken(boardId, e2eHeaders)
        .then((t) => {
          if (cancelled) return;
          setToken(t ?? null);
        })
        .catch(() => {
          if (cancelled) return;
          if (retryIndex < RETRY_DELAYS_MS.length) {
            const delay = RETRY_DELAYS_MS[retryIndex];
            retryTimeoutId = setTimeout(() => {
              retryTimeoutId = null;
              doFetch(retryIndex + 1);
            }, delay);
          } else {
            setToken(null);
          }
        });
    };

    doFetch();
    const interval = setInterval(() => doFetch(0), TOKEN_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [boardId, enabled, e2eHeaders]);

  return token;
}
