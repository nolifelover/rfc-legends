import type { NextConfig } from "next";

// Server-side PocketBase address; the browser reaches it through /pb/ on the app host (interfaces.md §5b).
const pocketbaseUrl = (process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // The dev server is also served at https://rfc-legends.earn.dev.rawinlab.com through the proxy.
  allowedDevOrigins: ["rfc-legends.earn.dev.rawinlab.com"],
  async rewrites() {
    return [{ source: "/pb/:path*", destination: `${pocketbaseUrl}/:path*` }];
  },
};

export default nextConfig;
