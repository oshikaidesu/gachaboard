import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage";

type Params = { params: Promise<{ assetId: string }> };

// 論理削除 or 復元
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId } = await params;
  const { action } = await req.json() as { action: "trash" | "restore" };

  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.asset.update({
    where: { id: assetId },
    data: { deletedAt: action === "trash" ? new Date() : null },
  });

  return NextResponse.json({ ...updated, sizeBytes: updated.sizeBytes.toString() });
}

// 完全削除（ゴミ箱内のみ）
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId } = await params;
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!asset.deletedAt) {
    return NextResponse.json({ error: "Move to trash first" }, { status: 400 });
  }

  await deleteFile(asset.storageKey);
  await db.asset.delete({ where: { id: assetId } });

  return NextResponse.json({ ok: true });
}
