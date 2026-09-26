'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase client-side auth detects the hash/code from the URL automatically
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Auth callback error:', error);
        router.replace('/login');
        return;
      }

      if (session?.user) {
        // Ensure a user_profiles row exists for Google-auth users
        const user = session.user;
        const displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.display_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Traveler';

        const phone =
          user.user_metadata?.phone ||
          user.phone ||
          '';

        await supabase.from('user_profiles').upsert({
          id: user.id,
          display_name: displayName,
          phone: phone,
          email: user.email || '',
          avatar_url: user.user_metadata?.avatar_url || null,
        });

        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1rem',
      background: 'var(--color-surface-0)',
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-sans)',
    }}>
      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-brand-600)' }} />
      <p style={{ fontSize: '0.9rem' }}>Signing you in…</p>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
