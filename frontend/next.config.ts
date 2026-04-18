import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Enable server actions
  experimental: {},
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/:path*`,
      },
    ]
  },
  // Allow external images if needed
  images: {
    remotePatterns: [],
  },
}

export default nextConfig
