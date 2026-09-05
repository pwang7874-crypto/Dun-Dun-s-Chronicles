import type { NextConfig } from 'next';

// Keep the existing Sites build unchanged; mainland hosting can export the
// same page and interactions without requiring a Cloudflare Worker runtime.
const nextConfig: NextConfig =
  process.env.DUNDUNJI_STATIC_EXPORT === '1'
    ? { output: 'export', images: { unoptimized: true } }
    : {};

export default nextConfig;
