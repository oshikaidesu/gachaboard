import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "50gb" },
  },
  allowedDevOrigins: ["desktop-hn7hdbv-1.tail16829c.ts.net"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
