import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_INTERNAL_URL || "http://localhost:4100"}/api/:path*` }];
  },
};

export default nextConfig;
