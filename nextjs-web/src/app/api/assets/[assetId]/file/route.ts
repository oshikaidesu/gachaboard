import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { getFilePath, getConvertedPath } from "@/lib/storage";
import { existsSync, statSync } from "fs";
import { open } from "fs/promises";

type Params = { params: Promise<{ assetId: string }> };

export async function HEAD(req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return new NextResponse(null, { status: 401 });

  const { assetId } = await params;
  const { searchParams } = new URL(req.url);
  const converted = searchParams.get("converted") === "1";

  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.deletedAt) return new NextResponse(null, { status: 404 });

  const filePath = converted ? getConvertedPath(asset.storageKey) : getFilePath(asset.storageKey);
  if (!existsSync(filePath)) return new NextResponse(null, { status: 404 });

  return new NextResponse(null, { status: 200 });
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId } = await params;
  const { searchParams } = new URL(req.url);
  const converted = searchParams.get("converted") === "1";
  const forceDownload = searchParams.get("download") === "1";

  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = converted ? getConvertedPath(asset.storageKey) : getFilePath(asset.storageKey);
  if (!existsSync(filePath)) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const mimeType = converted ? "audio/mpeg" : (asset.mimeType || "application/octet-stream");
  const isInline = !forceDownload && (mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType.startsWith("audio/"));
  const disposition = isInline ? "inline" : "attachment";
  const encodedName = encodeURIComponent(asset.fileName);
  const totalSize = statSync(filePath).size;

  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    const start = match?.[1] ? parseInt(match[1], 10) : 0;
    const end = match?.[2] ? parseInt(match[2], 10) : totalSize - 1;
    const chunkSize = end - start + 1;

    const fd = await open(filePath, "r");
    const chunk = Buffer.allocUnsafe(chunkSize);
    await fd.read(chunk, 0, chunkSize, start);
    await fd.close();

    return new NextResponse(chunk, {
      status: 206,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": chunkSize.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const fd = await open(filePath, "r");
  const buffer = Buffer.allocUnsafe(totalSize);
  await fd.read(buffer, 0, totalSize, 0);
  await fd.close();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
      "Content-Length": totalSize.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
