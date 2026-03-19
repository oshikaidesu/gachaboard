import { NextRequest, NextResponse } from "next/server";
import { assertAssetReadAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { getPresignedGetUrl, headS3Object, s3KeyAssets, s3KeyConverted } from "@/lib/s3";
import { assetIdSchema } from "@/lib/validators";
import { env } from "@/lib/env";

type Params = { params: Promise<{ assetId: string }> };

async function resolveKey(
  assetId: string,
  converted: boolean,
  forceDownload: boolean
): Promise<{ key: string; mimeType: string } | null> {
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.deletedAt) return null;

  const isVideo = asset.mimeType?.startsWith("video/");

  if (converted && !isVideo) {
    return { key: s3KeyConverted(asset.storageKey, ".mp3"), mimeType: "audio/mpeg" };
  }
  if (isVideo) {
    const lightKey = s3KeyConverted(asset.storageKey, ".mp4");
    const lightExists = await headS3Object(lightKey);
    if (!forceDownload && lightExists) {
      return { key: lightKey, mimeType: "video/mp4" };
    }
    return { key: s3KeyAssets(asset.storageKey), mimeType: asset.mimeType || "video/mp4" };
  }
  return { key: s3KeyAssets(asset.storageKey), mimeType: asset.mimeType || "application/octet-stream" };
}

export async function HEAD(req: NextRequest, { params }: Params) {
  let assetId = "(unknown)";
  try {
    ({ assetId } = await params);
    if (!assetIdSchema.safeParse(assetId).success) return new NextResponse(null, { status: 400 });
    if (!env.E2E_TEST_MODE) {
      const ctx = await assertAssetReadAccess(assetId);
      if (!ctx) return new NextResponse(null, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const converted = searchParams.get("converted") === "1";

    const asset = await db.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.deletedAt) return new NextResponse(null, { status: 404 });

    const noStore = { "Cache-Control": "no-store" };
    if (asset.mimeType?.startsWith("video/") && !converted) {
      const lightKey = s3KeyConverted(asset.storageKey, ".mp4");
      const lightExists = await headS3Object(lightKey);
      if (!lightExists) {
        const TRANSCODE_TIMEOUT_MS = 2 * 60 * 1000;
        const elapsed = Date.now() - new Date(asset.createdAt).getTime();
        if (elapsed < TRANSCODE_TIMEOUT_MS) return new NextResponse(null, { status: 202, headers: noStore });
      }
    }

    const resolved = await resolveKey(assetId, converted, false);
    if (!resolved) return new NextResponse(null, { status: 404 });

    const exists = await headS3Object(resolved.key);
    if (!exists) {
      // 音声の変換済み .mp3 がまだ無い場合、作成直後は 202（変換中）を返す（動画と同様）
      const isWavConverted =
        converted &&
        (asset.mimeType === "audio/wav" || (asset.fileName && asset.fileName.endsWith(".wav")));
      if (isWavConverted) {
        const TRANSCODE_TIMEOUT_MS = 2 * 60 * 1000;
        const elapsed = Date.now() - new Date(asset.createdAt).getTime();
        if (elapsed < TRANSCODE_TIMEOUT_MS) {
          return new NextResponse(null, { status: 202, headers: noStore });
        }
      }
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(null, { status: 200, headers: noStore });
  } catch (err) {
    console.error("[HEAD /api/assets/file] assetId:", assetId, err);
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  let assetId = "(unknown)";
  try {
    ({ assetId } = await params);
    if (!assetIdSchema.safeParse(assetId).success) return NextResponse.json({ error: "Invalid assetId" }, { status: 400 });
    if (!env.E2E_TEST_MODE) {
      const ctx = await assertAssetReadAccess(assetId);
      if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const converted = searchParams.get("converted") === "1";
    const forceDownload = searchParams.get("download") === "1";

    const resolved = await resolveKey(assetId, converted, forceDownload);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const asset = await db.asset.findUnique({ where: { id: assetId } });
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const exists = await headS3Object(resolved.key);
    if (!exists) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const isInline = !forceDownload && (resolved.mimeType.startsWith("image/") || resolved.mimeType.startsWith("video/") || resolved.mimeType.startsWith("audio/"));
    const disposition = isInline ? "inline" : "attachment";
    const encodedName = encodeURIComponent(asset.fileName);
    const responseContentDisposition = `${disposition}; filename*=UTF-8''${encodedName}`;

    const url = await getPresignedGetUrl(resolved.key, 3600, {
      responseContentDisposition,
      responseContentType: resolved.mimeType,
    });

    return NextResponse.redirect(url, 302);
  } catch (err) {
    console.error("[GET /api/assets/file] assetId:", assetId, err);
    return NextResponse.json(
      {
        error: "Internal server error",
        ...(env.NODE_ENV !== "production" && { details: err instanceof Error ? err.message : String(err) }),
      },
      { status: 500 }
    );
  }
}
