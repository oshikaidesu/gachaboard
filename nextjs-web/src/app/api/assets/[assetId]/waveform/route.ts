import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { getWaveformPath } from "@/lib/storage";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

type Params = { params: Promise<{ assetId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId } = await params;
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const waveformPath = getWaveformPath(asset.storageKey);

  if (!existsSync(waveformPath)) {
    // 既存ファイル用のオンデマンド生成
    try {
      const { generateWaveform } = await import("@/app/api/assets/route");
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
