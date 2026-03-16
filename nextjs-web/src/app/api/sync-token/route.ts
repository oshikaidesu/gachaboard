import { NextResponse } from "next/server";
import { assertBoardAccess, requireLogin } from "@/lib/authz";
import { signSyncToken } from "@/lib/syncToken";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * sync-server WebSocket 接続用の短期トークンを発行する。
 * ボードへのアクセス権がある場合のみ発行。ゲートがこのトークンを検証して接続を許可する。
 * E2E モード時にボード未作成の場合は、セッションがあれば任意の boardId で発行する。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId");
  if (!boardId || typeof boardId !== "string" || boardId.length > 64) {
    return NextResponse.json({ error: "boardId required" }, { status: 400 });
  }

  let ctx = await assertBoardAccess(boardId);
  if (!ctx && env.E2E_TEST_MODE) {
    const session = await requireLogin();
    if (session) ctx = { session, board: null as any };
  }
  if (!ctx) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = signSyncToken(boardId, env.NEXTAUTH_SECRET);
  return NextResponse.json({ token });
}
