import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents: true, // Desactivado por conflicto con export const dynamic
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
