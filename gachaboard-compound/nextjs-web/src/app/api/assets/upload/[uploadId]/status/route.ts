import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { CHUNKS_DIR } from "@/lib/storage";
import { existsSync, readdirSync } from "fs";
import path from "path";

type Params = { params: Promise<{ uploadId: string }> };

/**
 * GET /api/assets/upload/[uploadId]/status
 * 完了済みチャンクのインデックス一覧を返す（再開可能アップロード用）
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uploadId } = await params;

  const uploadDir = path.join(CHUNKS_DIR, uploadId);
  if (!existsSync(uploadDir)) {
    return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
  }

  const metaPath = path.join(uploadDir, "meta.json");
  if (!existsSync(metaPath)) {
    return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
  }

  const entries = readdirSync(uploadDir);
  const completedChunks = entries
    .filter((f) => f.endsWith(".part"))
    .map((f) => parseInt(f.replace(/\.part$/, ""), 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

  return NextResponse.json({ completedChunks });
}
