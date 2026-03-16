import { NextResponse } from "next/server";

/**
 * API ルートの DB 等の例外を 500 に変換する。
 */
export function handleApiError(e: unknown, routeName: string): NextResponse {
  console.error(`[api:${routeName}]`, e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
