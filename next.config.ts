import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hard guarantee: the Gemini key is read only in server runtime code.
  // It is deliberately absent from `env` so it can never be inlined client-side.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
