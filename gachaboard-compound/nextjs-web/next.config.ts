import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // マルチ lockfile 環境でのパス解決を安定させる
  outputFileTracingRoot: path.resolve(process.cwd()),
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
    return [
      // y-websocket: /ws/roomId → sync-server:5858/roomId
      {
        source: "/ws/:path*",
        destination: "http://sync-server:5858/:path*",
      },
    ];
  },
};

export default nextConfig;
