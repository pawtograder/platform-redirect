import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Nothing here is user-generated and the only assets are two bundled PNGs,
  // so the image optimizer would add cost and a failure mode for no benefit.
  images: { unoptimized: true },
  poweredByHeader: false
};

export default nextConfig;
