/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: '/backend/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  async headers() {
    return [{ source: '/api/:path*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] }];
  },
};

module.exports = nextConfig;
