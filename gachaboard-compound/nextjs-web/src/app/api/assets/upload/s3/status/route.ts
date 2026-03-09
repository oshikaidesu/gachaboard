import { NextRequest, NextResponse } from "next/server";
import { requireLogin, getS3UploadSessionForUser } from "@/lib/authz";
import { isS3Enabled, listParts } from "@/lib/s3";

/**
 * GET /api/assets/upload/s3/status?uploadId=xxx
 * アップロード済みパート一覧を返す。再開時に使用。
 */
export async function GET(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isS3Enabled()) {
    return NextResponse.json({ error: "S3 is not configured" }, { status: 503 });
  }

  const uploadId = req.nextUrl.searchParams.get("uploadId");
  if (!uploadId) {
    return NextResponse.json({ error: "uploadId is required" }, { status: 400 });
  }

  const row = await getS3UploadSessionForUser(uploadId, session.user.id);
  if (!row) return NextResponse.json({ error: "Upload session not found" }, { status: 404 });

  const parts = await listParts(row.s3Key, uploadId);

  return NextResponse.json({
    uploadId,
    key: row.s3Key,
    storageKey: row.storageKey,
    fileName: row.fileName,
    mimeType: row.mimeType,
    totalSize: row.totalSize.toString(),
    boardId: row.boardId,
    totalParts: Math.ceil(Number(row.totalSize) / (100 * 1024 * 1024)),
    completedParts: parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })),
    completedPartNumbers: parts.map((p) => p.PartNumber),
  });
}
