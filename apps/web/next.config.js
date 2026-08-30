/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

module.exports = nextConfig;
