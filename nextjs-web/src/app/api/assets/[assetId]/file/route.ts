import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { getFilePath, getConvertedPath } from "@/lib/storage";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

type Params = { params: Promise<{ assetId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId } = await params;
  const { searchParams } = new URL(req.url);
  const converted = searchParams.get("converted") === "1";

  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = converted ? getConvertedPath(asset.storageKey) : getFilePath(asset.storageKey);
  if (!existsSync(filePath)) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const buffer = await readFile(filePath);
  const mimeType = converted ? "audio/mpeg" : asset.mimeType;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${asset.fileName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
