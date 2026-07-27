import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle so the Docker image doesn't need
  // the full node_modules tree — important for a NAS with limited RAM.
  output: "standalone",
  // e2e/global-setup.ts spawns its own `next dev` alongside whatever dev
  // server a developer might already have running — a separate build cache
  // avoids any contention or cross-talk between the two.
  distDir: process.env.E2E_DIST_DIR || ".next",
};

export default nextConfig;
