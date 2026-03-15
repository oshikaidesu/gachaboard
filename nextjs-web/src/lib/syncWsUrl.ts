/**
 * クライアント用: 同期 WebSocket URL を取得。
 * ローカル以外（Tailscale 等）では同一オリジン /ws を利用し、
 * ローカルでは NEXT_PUBLIC_SYNC_WS_URL を使用する。
 */
import { env } from "@/lib/env";

export function getSyncWsUrl(): string {
  if (typeof window === "undefined") return "";
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!isLocal) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}/ws`;
  }
  const url = env.NEXT_PUBLIC_SYNC_WS_URL;
  return url.startsWith("__placeholder") ? "" : url;
}

/** getSyncWsUrl() が有効な URL を返すか */
export function isSyncWsUrlValid(url: string): boolean {
  return typeof url === "string" && url.length > 0 && !url.startsWith("__placeholder");
}
