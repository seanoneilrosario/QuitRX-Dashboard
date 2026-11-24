import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async headers() {
    return [
      {
        source: "/invoice/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
