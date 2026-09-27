// Fix Node 22/25 experimental webstorage bug where globalThis.localStorage exists without getItem/setItem
if (typeof globalThis.localStorage !== 'undefined' && typeof globalThis.localStorage.getItem !== 'function') {
  delete globalThis.localStorage;
}
if (!process.env.NODE_OPTIONS?.includes('--no-experimental-webstorage')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --no-experimental-webstorage`.trim();
}

const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  // Only apply static export during production build, enabling full dynamic routing during 'npm run dev'
  output: isProd ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return isProd ? [] : [
      {
        source: '/dashboard',
        destination: '/hub',
      },
    ];
  },
};

export default nextConfig;
