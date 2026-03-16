/**
 * E2E テストモード用: API 呼び出しに擬似セッションヘッダーを付与するヘルパー
 */

export type E2EHeaders = { userId: string; userName: string };

/** URL の testUserId / testUserName から E2E ヘッダーを取得（クライアントのみ） */
export function getE2EHeadersFromUrl(): E2EHeaders | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("testUserId")?.trim();
  const userName = params.get("testUserName")?.trim();
  return userId && userName ? { userId, userName } : null;
}

/** 既存の headers に E2E ヘッダーをマージ */
export function withE2EHeaders(headers: HeadersInit, e2e?: E2EHeaders | null): HeadersInit {
  if (!e2e) return headers;
  const base = headers instanceof Headers ? Object.fromEntries(headers) : { ...headers };
  return {
    ...base,
    "X-E2E-User-Id": e2e.userId,
    "X-E2E-User-Name": e2e.userName,
  };
}
