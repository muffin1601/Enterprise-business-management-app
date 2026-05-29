import type { NextConfig } from 'next'

/**
 * Base Next.js 15 configuration.
 *
 *  - `sassOptions.includePaths: ['styles']` lets `.module.scss` files and
 *    `app/globals.scss` resolve shared partials with `@use 'mixins' as *`
 *    / `@use 'index' as t` instead of long relative paths
 *    (FRONTEND_DESIGN_SYSTEM.md §3). No Tailwind/PostCSS pipeline.
 *  - Later: `images.remotePatterns` for the Supabase Storage host (logos),
 *    and `withSentryConfig(...)` once observability is wired.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Surface type/lint errors in CI rather than silently passing builds.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  sassOptions: {
    includePaths: ['styles'],
  },
  experimental: {
    // Type-safe Link hrefs and router params across the App Router.
    typedRoutes: true,
  },
}

export default nextConfig
