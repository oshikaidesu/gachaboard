import { NextRequest, NextResponse } from "next/server";
import { assertAssetReadAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { getWaveformPath } from "@/lib/storage";
import { getObjectStream, headS3Object, s3KeyWaveform } from "@/lib/s3";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

type Params = { params: Promise<{ assetId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { assetId } = await params;
  const ctx = await assertAssetReadAccess(assetId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storageBackend = (asset as { storageBackend?: string }).storageBackend ?? "local";
  if (storageBackend === "s3") {
    const key = s3KeyWaveform(asset.storageKey);
    const exists = await headS3Object(key);
    if (!exists) return NextResponse.json({ error: "Waveform not available" }, { status: 404 });
    const res = await getObjectStream(key);
    const body = res.Body;
    if (!body) return NextResponse.json({ error: "Waveform not available" }, { status: 404 });
    const nodeStream = body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of nodeStream) chunks.push(Buffer.from(chunk));
    const json = Buffer.concat(chunks).toString("utf-8");
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const waveformPath = getWaveformPath(asset.storageKey);

  if (!existsSync(waveformPath)) {
    // 既存ファイル用のオンデマンド生成
    try {
      const { generateWaveform } = await import("@/lib/waveform");
      await generateWaveform(asset.storageKey);
    } catch {
      return NextResponse.json({ error: "Waveform generation failed" }, { status: 500 });
    }
  }

  if (!existsSync(waveformPath)) {
    return NextResponse.json({ error: "Waveform not available" }, { status: 404 });
  }

  const json = await readFile(waveformPath, "utf-8");
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
