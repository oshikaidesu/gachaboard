/**
 * E2E スクリーンショット用サンプルアセットの配置
 *
 * 実行: npm run seed:e2e から呼ばれる（S3 有効時のみ）
 * video-media-samples, sample-audio-files からファイルを取得し S3 にアップロード
 */
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

const E2E_USER_ID = "__e2e_user__";
const E2E_WORKSPACE_ID = "__e2e_workspace__";
const E2E_BOARD_ID = "e2e-screenshot";

/** 1x1 透過 PNG（67 bytes） */
const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** 最小限の PDF（%PDF-1.0 ヘッダーのみ） */
const MINIMAL_PDF = Buffer.from("%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF", "utf8");

function getVideoPath(): string {
  return path.join(process.cwd(), "node_modules", "video-media-samples", "big-buck-bunny-480p-30sec.mp4");
}

function getAudioPath(): string {
  return path.join(process.cwd(), "node_modules", "sample-audio-files", "media", "Justice_Genesis_first_third_sec_tight.wav");
}

export type SeedAsset = {
  id: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: bigint;
  shapeType: "video-player" | "audio-player" | "image" | "file-icon";
  shapeProps: Record<string, unknown>;
  /** image 用の tldraw asset（shape が参照する assetId） */
  tldrawAsset?: { id: string; w: number; h: number };
};

export async function seedE2EAssets(db: {
  asset: { create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }> };
  board: { update: (args: { where: { id: string }; data: { snapshotData: unknown } }) => Promise<unknown> };
}): Promise<SeedAsset[]> {
  const { putObject, s3KeyAssets, isS3Enabled } = await import("../src/lib/storage/s3");
  if (!isS3Enabled()) {
    console.log("S3 未設定のためアセットのシードをスキップします");
    return [];
  }

  const assets: SeedAsset[] = [];
  const records: unknown[] = [];
  let x = 80;
  let y = 80;
  const GAP = 40;

  // 1. 動画
  const videoPath = getVideoPath();
  if (fs.existsSync(videoPath)) {
    const storageKey = `${randomUUID()}.mp4`;
    const buf = fs.readFileSync(videoPath);
    await putObject(s3KeyAssets(storageKey), buf, "video/mp4");
    const asset = await db.asset.create({
      data: {
        workspaceId: E2E_WORKSPACE_ID,
        boardId: E2E_BOARD_ID,
        uploaderId: E2E_USER_ID,
        kind: "video",
        mimeType: "video/mp4",
        fileName: "sample-video.mp4",
        sizeBytes: BigInt(buf.length),
        storageKey,
      },
    });
    assets.push({
      id: asset.id,
      storageKey,
      fileName: "sample-video.mp4",
      mimeType: "video/mp4",
      kind: "video",
      sizeBytes: BigInt(buf.length),
      shapeType: "video-player",
      shapeProps: { assetId: asset.id, fileName: "sample-video.mp4", mimeType: "video/mp4", w: 480, h: 474 },
    });
    records.push(
      shapeRecord("shape", `shape:${randomUUID()}`, "video-player", x, y, assets[assets.length - 1].shapeProps)
    );
    x += 520;
  }

  // 2. 音声
  const audioPath = getAudioPath();
  if (fs.existsSync(audioPath)) {
    const storageKey = `${randomUUID()}.wav`;
    const buf = fs.readFileSync(audioPath);
    await putObject(s3KeyAssets(storageKey), buf, "audio/wav");
    const asset = await db.asset.create({
      data: {
        workspaceId: E2E_WORKSPACE_ID,
        boardId: E2E_BOARD_ID,
        uploaderId: E2E_USER_ID,
        kind: "audio",
        mimeType: "audio/wav",
        fileName: "sample-audio.wav",
        sizeBytes: BigInt(buf.length),
        storageKey,
      },
    });
    assets.push({
      id: asset.id,
      storageKey,
      fileName: "sample-audio.wav",
      mimeType: "audio/wav",
      kind: "audio",
      sizeBytes: BigInt(buf.length),
      shapeType: "audio-player",
      shapeProps: { assetId: asset.id, fileName: "sample-audio.wav", mimeType: "audio/wav", w: 560, h: 250 },
    });
    records.push(
      shapeRecord("shape", `shape:${randomUUID()}`, "audio-player", x, y, assets[assets.length - 1].shapeProps)
    );
    x += 600;
  }

  // 3. 画像
  const imgStorageKey = `${randomUUID()}.png`;
  await putObject(s3KeyAssets(imgStorageKey), MINIMAL_PNG, "image/png");
  const imgAsset = await db.asset.create({
    data: {
      workspaceId: E2E_WORKSPACE_ID,
      boardId: E2E_BOARD_ID,
      uploaderId: E2E_USER_ID,
      kind: "image",
      mimeType: "image/png",
      fileName: "sample-image.png",
      sizeBytes: BigInt(MINIMAL_PNG.length),
      storageKey: imgStorageKey,
    },
  });
  const tldrawAssetId = `asset:${randomUUID()}`;
  const imgW = 320;
  const imgH = 240;
  records.push(
    assetRecord(tldrawAssetId, "image", {
      src: `/api/assets/${imgAsset.id}/file`,
      w: imgW,
      h: imgH,
      name: "sample-image.png",
      isAnimated: false,
      mimeType: "image/png",
    })
  );
  records.push(
    shapeRecord("shape", `shape:${randomUUID()}`, "image", x, y, { assetId: tldrawAssetId, w: imgW, h: imgH })
  );
  x += 340;
  y = 80;

  // 4. テキストファイル（text-file シェイプ）
  const txtContent = "# サンプルテキスト\n\nこれはスクリーンショット用の\nテキストファイルです。\n\n- リスト1\n- リスト2";
  const txtStorageKey = `${randomUUID()}.txt`;
  await putObject(s3KeyAssets(txtStorageKey), Buffer.from(txtContent, "utf8"), "text/plain");
  const txtAsset = await db.asset.create({
    data: {
      workspaceId: E2E_WORKSPACE_ID,
      boardId: E2E_BOARD_ID,
      uploaderId: E2E_USER_ID,
      kind: "file",
      mimeType: "text/plain",
      fileName: "readme.txt",
      sizeBytes: BigInt(Buffer.byteLength(txtContent, "utf8")),
      storageKey: txtStorageKey,
    },
  });
  records.push(
    shapeRecord("shape", `shape:${randomUUID()}`, "text-file", x, y, {
      assetId: txtAsset.id,
      fileName: "readme.txt",
      mimeType: "text/plain",
      content: txtContent,
      w: 320,
      h: 200,
    })
  );
  x += 340;

  // 5. ファイルアイコン（PDF, XLS, JS など）
  const fileIcons: { fileName: string; mimeType: string; kind: string; content: Buffer }[] = [
    { fileName: "document.pdf", mimeType: "application/pdf", kind: "file", content: MINIMAL_PDF },
    { fileName: "data.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "file", content: Buffer.from("PK", "utf8") },
    { fileName: "script.js", mimeType: "application/javascript", kind: "file", content: Buffer.from("// sample", "utf8") },
  ];

  for (const fi of fileIcons) {
    const storageKey = `${randomUUID()}${path.extname(fi.fileName)}`;
    await putObject(s3KeyAssets(storageKey), fi.content, fi.mimeType);
    const asset = await db.asset.create({
      data: {
        workspaceId: E2E_WORKSPACE_ID,
        boardId: E2E_BOARD_ID,
        uploaderId: E2E_USER_ID,
        kind: fi.kind,
        mimeType: fi.mimeType,
        fileName: fi.fileName,
        sizeBytes: BigInt(fi.content.length),
        storageKey,
      },
    });
    records.push(
      shapeRecord("shape", `shape:${randomUUID()}`, "file-icon", x, y, {
        assetId: asset.id,
        fileName: fi.fileName,
        mimeType: fi.mimeType,
        kind: fi.kind,
        w: 96,
        h: 96,
      })
    );
    x += 110;
    if (x > 600) {
      x = 80;
      y += 140;
    }
  }

  // page レコード（必須）
  records.unshift({
    id: "page:page",
    typeName: "page",
    name: "Page 1",
    index: "a0",
  });

  await db.board.update({
    where: { id: E2E_BOARD_ID },
    data: {
      snapshotData: {
        records,
        reactions: {},
        comments: {},
        reactionEmojiPreset: null,
        savedAt: new Date().toISOString(),
      },
    },
  });

  return assets;
}

let shapeIndex = 0;
function shapeRecord(
  typeName: string,
  id: string,
  type: string,
  x: number,
  y: number,
  props: Record<string, unknown>
): unknown {
  shapeIndex += 1;
  return {
    id,
    typeName,
    type,
    x,
    y,
    rotation: 0,
    index: `a${shapeIndex.toString(36)}`,
    parentId: "page:page",
    props,
    meta: { createdBy: "E2E Screenshot User", sizeBytes: 0, createdAt: Date.now() },
  };
}

function assetRecord(id: string, type: string, props: Record<string, unknown>): unknown {
  return {
    id,
    typeName: "asset",
    type,
    props,
    meta: {},
  };
}
