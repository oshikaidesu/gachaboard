import { NextRequest, NextResponse } from "next/server";
import { assertAssetReadAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { getThumbnailPath } from "@/lib/storage";
import { getObjectStream, headS3Object, s3KeyThumbnail } from "@/lib/s3";
import { existsSync, createReadStream } from "fs";
import { env } from "@/lib/env";
import { Readable } from "stream";

type Params = { params: Promise<{ assetId: string }> };

/**
 * GET /api/assets/[assetId]/thumbnail
 * 動画のサムネイル JPEG を返す。存在しない場合は 404。
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { assetId } = await params;
    if (!env.E2E_TEST_MODE) {
      const ctx = await assertAssetReadAccess(assetId);
      if (!ctx) return new NextResponse(null, { status: 401 });
    }
    const asset = await db.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.deletedAt) return new NextResponse(null, { status: 404 });

    const storageBackend = (asset as { storageBackend?: string }).storageBackend ?? "local";
    if (storageBackend === "s3") {
      const key = s3KeyThumbnail(asset.storageKey);
      const exists = await headS3Object(key);
      if (!exists) return new NextResponse(null, { status: 404 });
      const res = await getObjectStream(key);
      const body = res.Body;
      if (!body) return new NextResponse(null, { status: 404 });
      const webStream = Readable.toWeb(body as Readable) as globalThis.ReadableStream;
      return new NextResponse(webStream, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const thumbPath = getThumbnailPath(asset.storageKey);
    if (!existsSync(thumbPath)) return new NextResponse(null, { status: 404 });

    const stream = createReadStream(thumbPath);
    const webStream = Readable.toWeb(stream) as globalThis.ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[GET /api/assets/thumbnail]", err);
    return new NextResponse(null, { status: 500 });
  }
}
