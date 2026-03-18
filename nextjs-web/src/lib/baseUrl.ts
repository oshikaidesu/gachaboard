/**
 * リクエストからアプリのベース URL を動的に取得する。
 * HTTPS のみ利用する前提のため、プロキシ未設定時は https をデフォルトにする。
 *
 * - サーバー（RSC / API Route）: next/headers の Host / X-Forwarded-* から取得
 * - *.ts.net のときは X-Forwarded-Proto が無くても https に強制（Caddy なしの tailscale serve 対策）
 * - フォールバック: NEXTAUTH_URL または https://localhost:PORT
 *
 * NEXTAUTH_URL を env で固定する必要はなく、Tailscale serve 等で
 * どの URL でアクセスされても同じオリジンでセッション・リンクが動作する。
 */
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Tailscale のホスト名なら HTTPS 必須（Caddy なしで tailscale serve のみのとき X-Forwarded-Proto が無くても https にする） */
function isTailscaleHost(host: string): boolean {
  try {
    const hostname = host.split(":")[0];
    return hostname.endsWith(".ts.net");
  } catch {
    return false;
  }
}

export async function getBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    let proto = h.get("x-forwarded-proto") || "https";
    if (host) {
      if (isTailscaleHost(host) && proto !== "https") proto = "https";
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
