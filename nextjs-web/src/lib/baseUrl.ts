/**
 * リクエストからアプリのベース URL を動的に取得する。
 * HTTPS のみ利用する前提のため、プロキシ未設定時は https をデフォルトにする。
 *
 * - サーバー（RSC / API Route）: next/headers の Host / X-Forwarded-* から取得
 * - フォールバック: NEXTAUTH_URL または https://localhost:PORT
 *
 * NEXTAUTH_URL を env で固定する必要はなく、Tailscale serve 等で
 * どの URL でアクセスされても同じオリジンでセッション・リンクが動作する。
 */
import { headers } from "next/headers";
import { env } from "@/lib/env";

export async function getBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // next/headers が使えないコンテキスト（スクリプト等）
  }
  if (env.NEXTAUTH_URL) {
    return env.NEXTAUTH_URL.replace(/\/$/, "");
  }
  const port = process.env.PORT || "18580";
  return `https://localhost:${port}`;
}
