import { NextRequest, NextResponse } from "next/server";
import { assertAssetReadAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { getObjectStream, headS3Object, s3KeyWaveform } from "@/lib/s3";
import { assetIdSchema } from "@/lib/validators";

type Params = { params: Promise<{ assetId: string }> };

/**
 * GET /api/assets/[assetId]/waveform
 * 波形 JSON を Next.js 経由で配信。fetch が CORS で弾かれるためプロキシする（データは小さい）。
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { assetId } = await params;
  if (!assetIdSchema.safeParse(assetId).success) return NextResponse.json({ error: "Invalid assetId" }, { status: 400 });
  const ctx = await assertAssetReadAccess(assetId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const key = s3KeyWaveform(asset.storageKey);
  const exists = await headS3Object(key);
  if (!exists) return NextResponse.json({ error: "Waveform not available" }, { status: 404 });

  const res = await getObjectStream(key);
  const body = res.Body;
  if (!body) return NextResponse.json({ error: "Waveform not available" }, { status: 404 });

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const json = Buffer.concat(chunks).toString("utf-8");

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
