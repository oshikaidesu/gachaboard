/**
 * 簡易 in-memory レートリミット（API の濫用防止用）。
 * 本番で複数インスタンスの場合はリバースプロキシや Redis 等の利用を検討すること。
 */

const WINDOW_MS = 60 * 1000; // 1分

const store = new Map<string, { count: number; resetAt: number }>();

function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip;
}

/**
 * 指定キーでレートリミットをチェックする。
 * @param key 識別子（例: "invite:" + clientIp）
 * @param limitPerMinute 1分あたりの許可リクエスト数
 * @returns 許可する場合は true、制限超過の場合は false
 */
export function checkRateLimit(key: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= limitPerMinute) return false;
  entry.count++;
  return true;
}

/** リクエストからクライアント識別キーを生成（IP ベース） */
export function getRateLimitKey(req: Request, prefix: string): string {
  return `${prefix}:${getClientKey(req)}`;
}
