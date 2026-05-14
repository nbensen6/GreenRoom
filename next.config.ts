import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles the server + dependencies for Docker deploys.
  // Drops image size from ~1GB to ~150MB.
  output: "standalone",
};

export default nextConfig;
