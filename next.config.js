/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Optimización de imágenes
  images: {
    domains: [
      'vercel.app',
      'githubusercontent.com',
      'anthropic.com'
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Configuración experimental
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
  
  // Variables de entorno públicas
  env: {
    NEXT_PUBLIC_APP_NAME: 'RpgAInfinity',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
  
  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      },
    ]
  },
  
  // Redirects
  async redirects() {
    return [
      {
        source: '/game',
        destination: '/games',
        permanent: true,
      },
    ]
  },
  
  // Rewrites para API
  async rewrites() {
    return [
      {
        source: '/api/ai/:path*',
        destination: '/api/ai/:path*',
      },
    ]
  },
}

// Análisis de bundle opcional
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = process.env.ANALYZE === 'true' 
  ? withBundleAnalyzer(nextConfig) 
  : nextConfig