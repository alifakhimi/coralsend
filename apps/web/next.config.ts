import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Support subdirectory deployment via environment variable
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // Ensure assetPrefix matches basePath
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
};

export default nextConfig;
