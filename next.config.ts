import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pdf-parse"],
  outputFileTracingIncludes: {
    "/api/internal/documents/process": ["./node_modules/@napi-rs/canvas*/**/*"]
  },
  experimental: { serverActions: { bodySizeLimit: "1mb" } }
};

export default nextConfig;
