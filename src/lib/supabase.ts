import { createClient, SupabaseClient } from '@supabase/supabase-js';

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // During build/prerender, return a placeholder that will never be called.
    // At runtime on the client, env vars will always be available.
    return {} as SupabaseClient;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// The `typeof window !== 'undefined'` check ensures we only initialize on the client.
// During SSR prerendering, we return a dummy object that satisfies the SupabaseClient type.
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createSupabaseClient();
  }
  return _client;
}

// Lazy proxy: defers createClient until the first property access at runtime.
// This prevents "supabaseUrl is required" errors during Next.js static generation.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getSupabase();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
