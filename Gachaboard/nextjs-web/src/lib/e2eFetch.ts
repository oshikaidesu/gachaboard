/**
 * E2E テストモード用: API 呼び出しに擬似セッションヘッダーを付与するヘルパー
 */

export type E2EHeaders = { userId: string; userName: string };

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
