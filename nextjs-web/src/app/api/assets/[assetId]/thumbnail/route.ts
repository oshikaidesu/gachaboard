import { NextRequest, NextResponse } from "next/server";
import { assertAssetReadAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { getPresignedGetUrl, headS3Object, s3KeyThumbnail } from "@/lib/s3";
import { assetIdSchema } from "@/lib/validators";
import { env } from "@/lib/env";
import { ensureThumbnail } from "@/lib/ffmpeg";

type Params = { params: Promise<{ assetId: string }> };

/**
 * GET /api/assets/[assetId]/thumbnail
 * 動画のサムネイル JPEG を Presigned URL へ 302 リダイレクト。
 * S3 にサムネイルがない場合はオンデマンドで生成し、同一アセットへの同時リクエストは 1 つだけ実行。
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { assetId } = await params;
    if (!assetIdSchema.safeParse(assetId).success) return new NextResponse(null, { status: 400 });
    if (!env.E2E_TEST_MODE) {
      const ctx = await assertAssetReadAccess(assetId);
      if (!ctx) return new NextResponse(null, { status: 401 });
    }
    const asset = await db.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      console.warn(`[thumbnail] asset not found: ${assetId}`);
      return new NextResponse(null, { status: 404 });
    }
    if (asset.deletedAt) {
      await db.asset.update({ where: { id: assetId }, data: { deletedAt: null } });
    }

    if (!asset.mimeType.startsWith("video/")) {
      console.warn(`[thumbnail] not a video: ${assetId} mimeType=${asset.mimeType}`);
      return new NextResponse(null, { status: 404 });
    }

    const key = s3KeyThumbnail(asset.storageKey);
    let exists = await headS3Object(key);

    if (!exists) {
      const ok = await ensureThumbnail(asset.storageKey);
      if (!ok) return new NextResponse(null, { status: 503 });
      exists = true;
    }

    const url = await getPresignedGetUrl(key, 3600, { responseContentType: "image/jpeg" });
    return NextResponse.redirect(url, 302);
  } catch (err) {
    console.error("[GET /api/assets/thumbnail]", err);
    return new NextResponse(null, { status: 500 });
  }
}
