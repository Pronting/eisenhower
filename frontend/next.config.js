/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'
const isTauri = process.env.BUILD_TARGET === 'tauri'

const nextConfig = {
  // 桌面端构建时使用静态导出，Web 端使用 standalone
  ...(isTauri && { output: 'export' }),
  // 桌面端生产构建时使用相对路径，其他模式使用默认路径
  assetPrefix: isProd && isTauri ? './' : '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
