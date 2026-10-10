import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: root,
  turbopack: { root },
  serverExternalPackages: ['@actual-app/api', 'better-sqlite3'],
};
export default nextConfig;
