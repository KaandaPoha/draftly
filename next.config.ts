import type { NextConfig } from "next";

/** Bundled SQLite snapshot used for the read-only /tmp demo on Vercel. */
const SQLITE_DEMO_DB = "prisma/dev.db";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The image-generation server action accepts images up to 5 MB
  // (MAX_IMAGE_BYTES in src/lib/image-input.ts). Next's server-action body
  // parser defaults to 1 MB, which would silently reject anything between
  // 1–5 MB before our own validation runs — so raise the limit to cover the
  // largest legal upload plus form fields. 6 MB matches the API route's cap.
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  // Include the bundled SQLite database in the serverless trace so the demo
  // deploy can copy it into /tmp (src/lib/prisma.ts).
  outputFileTracingIncludes: {
    "/**": [SQLITE_DEMO_DB],
  },
  // The app is exercised over http://127.0.0.1:3000 (plain IPv4), not
  // localhost, so allow that origin for dev-only resources (HMR, fonts).
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
