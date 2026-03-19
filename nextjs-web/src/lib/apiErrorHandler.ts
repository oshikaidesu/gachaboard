import { NextResponse } from "next/server";

/** クライアント切断（タブ閉じる等）による想定内エラーか */
function isClientAbort(e: unknown): boolean {
  if (e instanceof Error) {
    const code = (e as NodeJS.ErrnoException).code;
    const msg = e.message?.toLowerCase() ?? "";
    return code === "ECONNRESET" || msg.includes("aborted");
  }
  return false;
}

/**
 * API ルートの DB 等の例外を 500 に変換する。
 */
export function handleApiError(e: unknown, routeName: string): NextResponse {
  if (!isClientAbort(e)) {
    console.error(`[api:${routeName}]`, e);
  }
  const message =
    process.env.NODE_ENV === "development" && e instanceof Error
      ? e.message
      : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
