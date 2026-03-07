import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { isS3Enabled, getPresignedPutUrl } from "@/lib/s3";

/**
 * POST /api/assets/upload/s3/presign
 * 指定パート用の Presigned PUT URL を返す。再開時に未完了パート用に取得。
 */
export async function POST(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isS3Enabled()) {
    return NextResponse.json({ error: "S3 is not configured" }, { status: 503 });
  }

  const body = (await req.json()) as { uploadId: string; partNumbers: number[] };
  const { uploadId, partNumbers } = body;

  if (!uploadId || !Array.isArray(partNumbers)) {
    return NextResponse.json({ error: "uploadId and partNumbers are required" }, { status: 400 });
  }

  const row = await db.s3UploadSession.findUnique({
    where: { uploadId },
  });
  if (!row || row.uploaderId !== session.user.id) {
    return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
  }

  const presignedUrls: Record<number, string> = {};
  for (const partNumber of partNumbers) {
    if (partNumber < 1) continue;
    const url = await getPresignedPutUrl(row.s3Key, uploadId, partNumber);
    presignedUrls[partNumber] = url;
  }

  return NextResponse.json({
    uploadId,
    key: row.s3Key,
    storageKey: row.storageKey,
    presignedUrls,
  });
}
