/**
 * MinIO プロキシ API route
 * /minio/* へのリクエストを S3_ENDPOINT（デフォルト: localhost:18583）に転送する。
 * Host ヘッダを S3_ENDPOINT のホストに設定し、presigned URL の署名と一致させる。
 */
import { NextRequest, NextResponse } from "next/server";

// S3_ENDPOINT と同じホスト名を使う（署名の host と一致させるため）
const MINIO_ORIGIN = process.env.S3_ENDPOINT || "http://localhost:18583";

async function proxy(req: NextRequest) {
  const url = new URL(req.url);
  // /minio/my-bucket/... → /my-bucket/...
  const minioPath = url.pathname.replace(/^\/minio/, "");
  const dest = `${MINIO_ORIGIN}${minioPath}${url.search}`;

  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (key === "host") continue;
    headers.set(key, value);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    // @ts-expect-error -- Next.js supports duplex streaming
    duplex: "half",
  };

  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    init.body = req.body;
  }

  const res = await fetch(dest, init);

  const respHeaders = new Headers(res.headers);
  // CORS: ブラウザからの直接リクエストを許可
  respHeaders.set("access-control-allow-origin", "*");
  respHeaders.set("access-control-allow-methods", "GET, PUT, POST, DELETE, HEAD, OPTIONS");
  respHeaders.set("access-control-allow-headers", "*");
  respHeaders.set("access-control-expose-headers", "etag, x-amz-request-id");

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: respHeaders,
  });
}

export async function GET(req: NextRequest) { return proxy(req); }
export async function PUT(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }
export async function HEAD(req: NextRequest) { return proxy(req); }
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, PUT, POST, DELETE, HEAD, OPTIONS",
      "access-control-allow-headers": "*",
    },
  });
}
