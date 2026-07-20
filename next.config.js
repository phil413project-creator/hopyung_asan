/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // 기존 원페이지 홈(public/index.html)을 그대로 루트("/")에서 서빙
      { source: '/', destination: '/index.html' }
    ];
  }
};

module.exports = nextConfig;
