import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Routes read data/*.json (unit locations, caches) at runtime; make sure serverless bundles ship them.
  outputFileTracingIncludes: {
    "/*": ["./data/**/*"],
  },
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
