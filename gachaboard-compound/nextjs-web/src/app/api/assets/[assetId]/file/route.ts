import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { getFilePath, getConvertedPath, getVideoConvertedPath } from "@/lib/storage";
import { getObjectStream, headS3Object, s3KeyAssets, s3KeyConverted } from "@/lib/s3";
import { existsSync, statSync, createReadStream } from "fs";
import { env } from "@/lib/env";
import { Readable } from "stream";

type Params = { params: Promise<{ assetId: string }> };

export async function HEAD(req: NextRequest, { params }: Params) {
  let assetId = "(unknown)";
  try {
    if (!env.E2E_TEST_MODE) {
      const session = await requireLogin();
      if (!session) return new NextResponse(null, { status: 401 });
    }

    ({ assetId } = await params);
    const { searchParams } = new URL(req.url);
    const converted = searchParams.get("converted") === "1";

    const asset = await db.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.deletedAt) return new NextResponse(null, { status: 404 });

    const noStore = { "Cache-Control": "no-store" };
    const TRANSCODE_TIMEOUT_MS = 2 * 60 * 1000;
    const storageBackend = (asset as { storageBackend?: string }).storageBackend ?? "local";

    if (storageBackend === "s3") {
      const converted = searchParams.get("converted") === "1";
      let key: string;
      if (converted && !asset.mimeType?.startsWith("video/")) {
        key = s3KeyConverted(asset.storageKey, ".mp3");
      } else if (asset.mimeType?.startsWith("video/")) {
        const lightKey = s3KeyConverted(asset.storageKey, ".mp4");
        const lightExists = await headS3Object(lightKey);
        if (lightExists) key = lightKey;
        else {
          const elapsed = Date.now() - new Date(asset.createdAt).getTime();
          if (elapsed < TRANSCODE_TIMEOUT_MS) return new NextResponse(null, { status: 202, headers: noStore });
          key = s3KeyAssets(asset.storageKey);
        }
      } else {
        key = s3KeyAssets(asset.storageKey);
      }
      const exists = await headS3Object(key);
      if (!exists) return new NextResponse(null, { status: 404 });
      return new NextResponse(null, { status: 200, headers: noStore });
    }

    const filePath = getFilePath(asset.storageKey);
    if (!existsSync(filePath)) return new NextResponse(null, { status: 404 });

    // 動画の場合、軽量版変換が完了するまで 202 を返してクライアントにポーリングさせる
    // ただしアップロードから 2 分経過しても変換が完了しない場合は諦めて 200 を返す
    if (asset.mimeType?.startsWith("video/")) {
      const lightPath = getVideoConvertedPath(asset.storageKey);
      if (!existsSync(lightPath)) {
        const elapsed = Date.now() - new Date(asset.createdAt).getTime();
        if (elapsed < TRANSCODE_TIMEOUT_MS) {
          return new NextResponse(null, { status: 202, headers: noStore });
        }
        // タイムアウト: 変換失敗とみなしてオリジナルで再生させる
        console.warn("[HEAD] transcoding timeout for asset", assetId, "falling back to original");
      }
    }

    // 音声WAVの場合、MP3変換が完了するまで 202 を返してクライアントにポーリングさせる
    if (asset.mimeType === "audio/wav" && converted) {
      const mp3Path = getConvertedPath(asset.storageKey);
      if (!existsSync(mp3Path)) {
        const elapsed = Date.now() - new Date(asset.createdAt).getTime();
        if (elapsed < TRANSCODE_TIMEOUT_MS) {
          return new NextResponse(null, { status: 202, headers: noStore });
        }
        console.warn("[HEAD] wav->mp3 conversion timeout for asset", assetId, "falling back to original");
      }
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
    if (!env.E2E_TEST_MODE) {
      const session = await requireLogin();
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    ({ assetId } = await params);
    const { searchParams } = new URL(req.url);
    const converted = searchParams.get("converted") === "1";
    const forceDownload = searchParams.get("download") === "1";

    const asset = await db.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const storageBackend = (asset as { storageBackend?: string }).storageBackend ?? "local";
    const isVideo = asset.mimeType?.startsWith("video/");

    if (storageBackend === "s3") {
      const converted = searchParams.get("converted") === "1";
      const forceDownload = searchParams.get("download") === "1";
      let key: string;
      let mimeType: string;
      if (converted && !isVideo) {
        key = s3KeyConverted(asset.storageKey, ".mp3");
        mimeType = "audio/mpeg";
      } else if (isVideo) {
        const lightKey = s3KeyConverted(asset.storageKey, ".mp4");
        const lightExists = await headS3Object(lightKey);
        if (!forceDownload && lightExists) {
          key = lightKey;
          mimeType = "video/mp4";
        } else {
          key = s3KeyAssets(asset.storageKey);
          mimeType = asset.mimeType || "video/mp4";
        }
      } else {
        key = s3KeyAssets(asset.storageKey);
        mimeType = asset.mimeType || "application/octet-stream";
      }
      const exists = await headS3Object(key);
      if (!exists) return NextResponse.json({ error: "File not found" }, { status: 404 });

      const rangeHeader = req.headers.get("range") ?? undefined;
      const res = await getObjectStream(key, rangeHeader);
      const body = res.Body;
      if (!body) return NextResponse.json({ error: "File not found" }, { status: 404 });

      // Node.js 環境では AWS SDK GetObject の Body は Node.js Readable として返る
      const nodeStream = body as unknown as NodeJS.ReadableStream;
      const webStream = Readable.toWeb(nodeStream as unknown as import("stream").Readable) as ReadableStream;

      const isInline = !forceDownload && (mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType.startsWith("audio/"));
      const disposition = isInline ? "inline" : "attachment";
      const encodedName = encodeURIComponent(asset.fileName);
      const cacheControl = mimeType.startsWith("video/") ? "no-store" : "private, max-age=3600";

      const isPartial = res.ContentRange != null;
      const headers: Record<string, string> = {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": cacheControl,
      };
      if (res.ContentLength != null) headers["Content-Length"] = String(res.ContentLength);
      if (res.ContentRange) headers["Content-Range"] = res.ContentRange;

      return new NextResponse(webStream, {
        status: isPartial ? 206 : 200,
        headers,
      });
    }

    // converted=1 の場合は明示的に変換済みファイルを返す（音声用）
    // 動画の場合は converted パラメータに関わらず、軽量版が存在すれば自動的にそちらを返す
    let filePath: string;
    let mimeType: string;

    if (converted && !isVideo) {
      // 音声: 明示的に変換済み（MP3）を要求
      filePath = getConvertedPath(asset.storageKey);
      mimeType = "audio/mpeg";
    } else if (isVideo) {
      // 動画: 再生時は軽量版を優先、ダウンロード時はオリジナルを返す
      const lightPath = getVideoConvertedPath(asset.storageKey);
      if (!forceDownload && existsSync(lightPath)) {
        filePath = lightPath;
        mimeType = "video/mp4";
      } else {
        filePath = getFilePath(asset.storageKey);
        mimeType = asset.mimeType || "video/mp4";
      }
    } else {
      filePath = getFilePath(asset.storageKey);
      mimeType = asset.mimeType || "application/octet-stream";
    }

    if (!existsSync(filePath)) {
      console.error("[GET /api/assets/file] file not found on disk:", filePath, "assetId:", assetId);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const isInline = !forceDownload && (mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType.startsWith("audio/"));
    const disposition = isInline ? "inline" : "attachment";
    const encodedName = encodeURIComponent(asset.fileName);
    const totalSize = statSync(filePath).size;

    const rangeHeader = req.headers.get("range");
    const cacheControl = mimeType.startsWith("video/") ? "no-store" : "private, max-age=3600";

    if (rangeHeader) {
      // RFC 7233 準拠: bytes=START-END 形式のみ受け付ける
      const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
      if (!match) {
        // 不正な Range ヘッダーは 416 を返す
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }

      const start = parseInt(match[1], 10);
      const requestedEnd = match[2] ? parseInt(match[2], 10) : totalSize - 1;
      const end = Math.min(requestedEnd, totalSize - 1);

      // 不正な範囲チェック
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= totalSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }

      const chunkSize = end - start + 1;

      const stream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(stream) as ReadableStream;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Content-Length": chunkSize.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": cacheControl,
        },
      });
    }

    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
        "Content-Length": totalSize.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": cacheControl,
      },
    });
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
