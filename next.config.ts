import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1:4010", "localhost:4010"],
  reactStrictMode: true,
};

export default nextConfig;
