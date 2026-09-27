// Fix Node 22/25 experimental webstorage bug where globalThis.localStorage exists without getItem/setItem
if (typeof globalThis.localStorage !== 'undefined' && typeof globalThis.localStorage.getItem !== 'function') {
  delete globalThis.localStorage;
}
if (!process.env.NODE_OPTIONS?.includes('--no-experimental-webstorage')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --no-experimental-webstorage`.trim();
}

const isVercel = Boolean(process.env.VERCEL);
const isProd = process.env.NODE_ENV === 'production';

// On Vercel, run in standard dynamic Next.js mode so that dynamic routes like /trip/[id]/itinerary work seamlessly without 404s.
// On mobile/Capacitor builds (Appflow or local), output static export into 'out'.
const isStaticExport = !isVercel && (isProd || Boolean(process.env.CAPACITOR_BUILD));

const nextConfig = {
  output: isStaticExport ? 'export' : undefined,
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
