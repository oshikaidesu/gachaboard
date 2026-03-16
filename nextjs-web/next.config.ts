import type { NextConfig } from "next";
import path from "path";

import "./src/lib/env";

const nextConfig: NextConfig = {
  output: "standalone",
  // マルチ lockfile 環境でのパス解決を安定させる
  outputFileTracingRoot: path.resolve(process.cwd()),
  // 開発時のターミナル出力を抑える
  logging: {
    incomingRequests: false,
    fetches: { fullUrl: false },
  },
  async headers() {
    // CSP: 信頼できるオリジンのみ。Next.js のインラインスクリプトのため script-src に unsafe-inline/unsafe-eval を含む
    // Tailscale HTTPS → /minio 経由で S3 にアクセス。localhost 時は http://localhost:PORT で直接アクセス。
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http://localhost:* http://127.0.0.1:*",
      "font-src 'self' data: https://unpkg.com",
      "connect-src 'self' blob: ws: wss: https: http://localhost:* http://127.0.0.1:*",
      "media-src 'self' blob: https: http://localhost:* http://127.0.0.1:*",
      "frame-src https://www.youtube.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  experimental: {
    // 動画・大容量ファイルのアップロード用。本番ではリバースプロキシ等で制限を検討すること。
    serverActions: { bodySizeLimit: "100gb" },
  },
  allowedDevOrigins: (() => {
    const origins: string[] = [];
    if (process.env.ALLOWED_DEV_ORIGINS) {
      origins.push(...process.env.ALLOWED_DEV_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean));
    }
    // NEXTAUTH_URL が localhost 以外ならそのオリジンも自動で許可（Tailscale 等）
    if (process.env.NEXTAUTH_URL) {
      try {
        const u = new URL(process.env.NEXTAUTH_URL);
        if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
          origins.push(u.origin);
        }
      } catch { /* invalid URL */ }
    }
    return [...new Set(origins)];
  })(),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
    ],
  },
  async rewrites() {
    // npm run dev 時は Next.js がホストで動くため localhost を使用。
    // Next.js を Docker 内で動かす場合は SYNC_SERVER_INTERNAL_URL=http://sync-server:5858 を設定
    const syncDest = process.env.SYNC_SERVER_INTERNAL_URL ?? "http://127.0.0.1:18582";
    // /minio/* は src/app/minio/[...path]/route.ts が Host ヘッダ付きでプロキシする
    return [
      { source: "/ws/:path*", destination: `${syncDest}/:path*` },
    ];
  },
};

export default nextConfig;
