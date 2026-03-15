import type { NextConfig } from "next";
import path from "path";

import "./src/lib/env";

const nextConfig: NextConfig = {
  // マルチ lockfile 環境でのパス解決を安定させる
  outputFileTracingRoot: path.resolve(process.cwd()),
  // 開発時のターミナル出力を抑える
  logging: {
    incomingRequests: false,
    fetches: { fullUrl: false },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "100gb" },
  },
  allowedDevOrigins: ["uooooooooooo.tail16829c.ts.net", "desktop-hn7hdbv-1.tail16829c.ts.net"],
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
