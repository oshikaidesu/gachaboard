import { NextRequest, NextResponse } from "next/server";
import { assertAssetReadAccess, assertAssetWriteAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { headers } from "next/headers";
import { env } from "@/lib/env";

type Params = { params: Promise<{ assetId: string }> };

// アセット単体取得（アクティブなもののみ）
export async function GET(_req: NextRequest, { params }: Params) {
  const hdrs = env.E2E_TEST_MODE ? await headers() : null;
  const isE2e = hdrs?.get("x-e2e-user-id");
  const { assetId } = await params;
  if (!isE2e) {
    const ctx = await assertAssetReadAccess(assetId);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const asset = await db.asset.findUnique({ where: { id: assetId, deletedAt: null } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...asset, sizeBytes: asset.sizeBytes.toString() });
}

// 論理削除 or 復元 or 位置情報更新
export async function PATCH(req: NextRequest, { params }: Params) {
  const { assetId } = await params;
  const ctx = await assertAssetWriteAccess(assetId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { asset } = ctx;
  const body = await req.json() as {
    action?: "trash" | "restore";
    lastKnownX?: number;
    lastKnownY?: number;
  };

  const updateData: {
    deletedAt?: Date | null;
    lastKnownX?: number;
    lastKnownY?: number;
  } = {};

  if (body.action === "trash") {
    updateData.deletedAt = new Date();
  } else if (body.action === "restore") {
    updateData.deletedAt = null;
  }

  if (typeof body.lastKnownX === "number") updateData.lastKnownX = body.lastKnownX;
  if (typeof body.lastKnownY === "number") updateData.lastKnownY = body.lastKnownY;

  const updated = await db.asset.update({
    where: { id: assetId },
    data: updateData,
  });

  return NextResponse.json({ ...updated, sizeBytes: updated.sizeBytes.toString() });
}

// 完全削除（ゴミ箱内のみ）
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { assetId } = await params;
  const ctx = await assertAssetWriteAccess(assetId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { asset } = ctx;
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!asset.deletedAt) {
    return NextResponse.json({ error: "Move to trash first" }, { status: 400 });
  }

  await deleteFile(asset.storageKey, (asset.storageBackend as "local" | "s3") ?? "local");
  await db.asset.delete({ where: { id: assetId } });

  return NextResponse.json({ ok: true });
}
