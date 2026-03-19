import { NextResponse } from "next/server";

/**
 * API ルートの DB 等の例外を 500 に変換する。
 */
export function handleApiError(e: unknown, routeName: string): NextResponse {
  console.error(`[api:${routeName}]`, e);
  const message =
    process.env.NODE_ENV === "development" && e instanceof Error
      ? e.message
      : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
