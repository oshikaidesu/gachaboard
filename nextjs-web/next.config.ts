import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "50gb" },
  },
  allowedDevOrigins: ["uooooooooooo.tail16829c.ts.net"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/ws/sync/:path*",
        destination: "http://localhost:5858/sync/:path*",
      },
    ];
  },
};

export default nextConfig;
