// Fix Node 22/25 experimental webstorage bug where globalThis.localStorage exists without getItem/setItem
if (typeof globalThis.localStorage !== 'undefined' && typeof globalThis.localStorage.getItem !== 'function') {
  delete globalThis.localStorage;
}
if (!process.env.NODE_OPTIONS?.includes('--no-experimental-webstorage')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --no-experimental-webstorage`.trim();
}

const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
