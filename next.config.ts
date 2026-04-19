import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 啟用 standalone 輸出以優化 Docker 映像大小
  output: 'standalone',
  
  // 圖片優化配置：優先使用 AVIF，其次 WebP
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1年快取，靜態資源
    // 允許從外部域名載入圖片
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.lu.ma',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.lumacdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.fbcdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'newsbuffet.aottercdn.com',
        pathname: '/media/**',
      },
      {
        // Supabase Storage: public buckets serve avatars with no-cache, so
        // route them through next/image to get AVIF/WebP + 1y immutable cache.
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // 對於外部圖片，使用 unoptimized 以減少處理時間
    unoptimized: false,
  },
  
  // 壓縮配置（Next.js 16 預設啟用）
  compress: true,

  // SEO: 移除 X-Powered-By header
  poweredByHeader: false,
  
  // 實驗性功能：啟用 React Server Components 優化
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react'],
    // 注意：PPR 已合併到 cacheComponents，但我們透過動態導入已實現程式碼分割最佳化
  },
  
  // Turbopack 配置（用於開發模式）
  // 注意：webpack 配置仍會在生產建置中使用
  turbopack: {
    root: __dirname,
  },
  
  // Webpack 優化配置（用於生產建置）
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 優化客戶端 bundle 分割
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // 將 framer-motion 單獨打包
            framerMotion: {
              name: 'framer-motion',
              test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
              priority: 40,
              reuseExistingChunk: true,
            },
            // 將其他大型庫打包
            vendor: {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 20,
              reuseExistingChunk: true,
            },
            // 共用程式碼
            common: {
              name: 'common',
              minChunks: 2,
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
  
  // 生產環境優化
  productionBrowserSourceMaps: false, // 關閉 source maps 以減少 bundle 大小
  
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
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.recaptcha.net https://connect.facebook.net https://www.instagram.com https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co https://*.stripe.com https://www.google.com https://recaptchaenterprise.googleapis.com https://www.facebook.com https://api.lu.ma https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://googleads.g.doubleclick.net",
              "frame-src 'self' https://www.google.com https://www.recaptcha.net https://js.stripe.com https://www.instagram.com https://www.youtube.com https://www.youtube-nocookie.com",
              "worker-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        // 為 JavaScript 和 CSS 設置長期快取
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 為字體設置長期快取
        source: '/_next/static/media/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
