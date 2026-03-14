import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@domain-platform/types'],
  output: 'standalone',
}

export default config
