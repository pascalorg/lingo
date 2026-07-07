import path from 'node:path'
import type { NextConfig } from 'next'

const repoRoot = path.resolve(process.cwd(), '../..')
const lingoDist = '../../packages/lingo/dist'

const nextConfig: NextConfig = {
  // Dev and prod-verification servers run from this dir simultaneously;
  // NEXT_DIST_DIR keeps `next dev` (.next-dev) from clobbering the
  // `next build` output (.next) that `next start` serves.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      '@pascal-app/lingo': path.join(lingoDist, 'index.js'),
      '@pascal-app/lingo/ai': path.join(lingoDist, 'ai/index.js'),
      '@pascal-app/lingo/core': path.join(lingoDist, 'core/index.js'),
      '@pascal-app/lingo/date': path.join(lingoDist, 'date/index.js'),
      '@pascal-app/lingo/dom': path.join(lingoDist, 'dom/index.js'),
      '@pascal-app/lingo/react': path.join(lingoDist, 'react/index.js'),
    },
  },
  experimental: {
    turbopackPluginRuntimeStrategy: 'workerThreads',
  },
  async redirects() {
    return [
      {
        source: '/escalation',
        destination: '/docs#strictness',
        permanent: false,
      },
      {
        source: '/forms',
        destination: '/docs#forms',
        permanent: false,
      },
      {
        source: '/coverage',
        destination: '/docs#coverage',
        permanent: false,
      },
      {
        source: '/integrations',
        destination: '/docs#integrations',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
