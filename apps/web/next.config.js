/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';

const nextConfig = {
  reactStrictMode: true,
  // Static export is used when building the Tauri desktop app.
  // Set NEXT_STATIC_EXPORT=true before running `next build` for a desktop build.
  ...(isStaticExport ? { output: 'export', trailingSlash: true } : {}),
  ...(!isStaticExport ? {
    async rewrites() {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      return [{ source: '/backend/:path*', destination: `${backendUrl}/:path*` }];
    },
    async headers() {
      return [{ source: '/api/:path*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] }];
    },
  } : {}),
};

module.exports = nextConfig;
