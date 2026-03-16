/**
 * MinIO プロキシ API route
 * /minio/* へのリクエストを S3_ENDPOINT（デフォルト: localhost:18583）に転送する。
 * Host ヘッダを S3_ENDPOINT のホストに設定し、presigned URL の署名と一致させる。
 *
 * セキュリティ: アクセス制御は presigned URL の署名に依存する。このプロキシ自体には
 * 認証はかけていない（presigned URL は署名済みのため、URL を知っている者のみが有効に操作できる）。
 * CORS はリクエストのオリジン（getBaseUrl）のみ許可し、第三者サイトからの JS アクセスを防ぐ。
 */
import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/baseUrl";

const MINIO_ORIGIN = process.env.S3_ENDPOINT || "http://localhost:18583";

/** 許可するオリジン（アプリのベース URL の origin のみ。同一オリジンのみ CORS 許可） */
async function getAllowedOrigin(): Promise<string> {
  return new URL(await getBaseUrl()).origin;
}

async function corsHeaders(req: NextRequest): Promise<HeadersInit> {
  const allowOrigin = await getAllowedOrigin();
  const requestOrigin = req.headers.get("origin");
  const acao = requestOrigin === allowOrigin ? requestOrigin : allowOrigin;
  return {
    "access-control-allow-origin": acao,
    "access-control-allow-methods": "GET, PUT, POST, DELETE, HEAD, OPTIONS",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "etag, x-amz-request-id",
  };
}

async function proxy(req: NextRequest) {
  const url = new URL(req.url);
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
  Object.entries(await corsHeaders(req)).forEach(([k, v]) => respHeaders.set(k, v));

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
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: await corsHeaders(req),
  });
}
