import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health - 生存確認用（Docker healthcheck・LB 用）
 * 認証不要。200 を返すだけでアプリが応答可能な状態であることを示す。
 */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
