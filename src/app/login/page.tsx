'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plane, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup' | 'otp'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a confirmation link!');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/dashboard');
      }
    }
    setLoading(false);
  };

  const handleOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Magic link sent! Check your email.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .login-page::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at 30% 40%, rgba(92, 124, 250, 0.08) 0%, transparent 50%),
                      radial-gradient(circle at 70% 60%, rgba(245, 159, 0, 0.05) 0%, transparent 50%);
          animation: rotate 30s linear infinite;
          z-index: 0;
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
        }
        .login-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
          justify-content: center;
        }
        .login-logo h1 {
          font-size: 1.5rem;
          font-weight: 800;
        }
        .login-logo .icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(66, 99, 235, 0.3);
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .form-group label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .input-icon-wrap {
          position: relative;
        }
        .input-icon-wrap .icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }
        .input-icon-wrap input {
          padding-left: 2.5rem;
        }
        .error-msg {
          padding: 0.75rem;
          border-radius: var(--radius-input);
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          font-size: 0.8125rem;
        }
        .success-msg {
          padding: 0.75rem;
          border-radius: var(--radius-input);
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: #4ade80;
          font-size: 0.8125rem;
        }
        .mode-toggle {
          text-align: center;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          margin-top: 0.5rem;
        }
        .mode-toggle button {
          background: none;
          border: none;
          color: var(--color-brand-400);
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          font-size: inherit;
        }
        .mode-toggle button:hover {
          text-decoration: underline;
        }
        .divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          color: var(--color-text-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--color-glass-border);
        }
      `}</style>

      <div className="login-card glass-card animate-in" style={{ padding: '2.5rem' }}>
        <div className="login-logo">
          <div className="icon-wrap">
            <Plane size={22} color="white" />
          </div>
          <h1 className="gradient-text">GroupTrip Ledger</h1>
        </div>

        {error && <div className="error-msg">{error}</div>}
        {message && <div className="success-msg">{message}</div>}

        {mode !== 'otp' ? (
          <form onSubmit={handleEmailPassword} className="login-form">
            <div className="form-group">
              <label>Email</label>
              <div className="input-icon-wrap">
                <Mail size={16} className="icon" />
                <input
                  type="email"
                  className="input-field"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-icon-wrap">
                <Lock size={16} className="icon" />
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <div className="mode-toggle">
              {mode === 'login' ? (
                <>Don&apos;t have an account?{' '}<button type="button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Sign up</button></>
              ) : (
                <>Already have an account?{' '}<button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Sign in</button></>
              )}
            </div>

            <div className="divider"><span>or</span></div>

            <button type="button" className="btn-secondary" onClick={() => { setMode('otp'); setError(''); setMessage(''); }} style={{ width: '100%' }}>
              <Mail size={16} />
              Sign in with Magic Link
            </button>
          </form>
        ) : (
          <form onSubmit={handleOTP} className="login-form">
            <div className="form-group">
              <label>Email</label>
              <div className="input-icon-wrap">
                <Mail size={16} className="icon" />
                <input
                  type="email"
                  className="input-field"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? <Loader2 size={16} className="spin" /> : <Mail size={16} />}
              Send Magic Link
            </button>

            <div className="mode-toggle">
              <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }}>← Back to password login</button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
}
