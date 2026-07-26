import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle so the Docker image doesn't need
  // the full node_modules tree — important for a NAS with limited RAM.
  output: "standalone",
};

export default nextConfig;
