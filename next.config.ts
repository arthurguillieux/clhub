import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle so the Docker image doesn't need
  // the full node_modules tree — important for a NAS with limited RAM.
  output: "standalone",
  // sharp (core/storage/avatar.ts, itemPhoto.ts) dlopens its native .node
  // binding and a sibling libvips .so at runtime — standalone output's file
  // tracer can't see through that the way it can a plain import, and
  // silently drops the shared library. Marking sharp external makes Next
  // leave it as a normal `require` instead of trying to trace/bundle it,
  // which is what actually gets the full package (native binary included)
  // copied into .next/standalone.
  serverExternalPackages: ["sharp"],
  // e2e/global-setup.ts spawns its own `next dev` alongside whatever dev
  // server a developer might already have running — a separate build cache
  // avoids any contention or cross-talk between the two.
  distDir: process.env.E2E_DIST_DIR || ".next",
};

export default nextConfig;
