import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 啟用 standalone 輸出以優化 Docker 映像大小
  output: 'standalone',
  
  // 圖片優化配置：優先使用 AVIF，其次 WebP
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // 允許從外部域名載入圖片（如果未來需要）
    remotePatterns: [],
  },
  
  // 壓縮配置（Next.js 16 預設啟用）
  compress: true,
  
  // 實驗性功能：啟用 React Server Components 優化
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },
  
  async headers() {
    return [
      {
        // 為圖片資源設置快取
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 為視頻資源設置快取
        source: '/videos/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 為 2025 目錄下的圖片設置快取
        source: '/2025/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 為靜態資源啟用 HTTP/3 和現代協定
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
