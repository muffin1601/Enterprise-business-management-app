import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  sassOptions: {
    includePaths: ['styles'],
  },
  typedRoutes: true,
  compress: true,
  images: {
    minimumCacheTTL: 3600,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  experimental: {
    // Tree-shake lucide-react and supabase — only bundle icons/methods actually used
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },
}

export default nextConfig
