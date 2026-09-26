'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plane, Mail, Lock, User, Phone, ArrowRight, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!displayName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    // Validate phone: must be 10 digits (Indian mobile)
    const cleanPhone = phone.replace(/[\s\-+]/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number (this will be your UPI ID).');
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName.trim(),
          phone: cleanPhone,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Save profile to user_profiles table
    if (data?.user) {
      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        display_name: displayName.trim(),
        phone: cleanPhone,
        email: email.trim(),
      });
    }

    setSuccess('Account created! Check your email for a confirmation link, then sign in.');
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
          background: var(--color-surface-0);
        }
        .auth-page::before {
          content: '';
          position: absolute;
          top: -40%;
          left: -30%;
          width: 160%;
          height: 160%;
          background: radial-gradient(circle at 25% 35%, rgba(92, 124, 250, 0.07) 0%, transparent 55%),
                      radial-gradient(circle at 75% 65%, rgba(245, 159, 0, 0.04) 0%, transparent 55%);
          animation: authBgRotate 40s linear infinite;
          z-index: 0;
        }
        @keyframes authBgRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
          padding: 2.5rem;
        }
        .auth-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          justify-content: center;
        }
        .auth-logo .icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(66, 99, 235, 0.3);
        }
        .auth-logo h1 {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .auth-subtitle {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 0.9rem;
          margin-bottom: 2rem;
          line-height: 1.5;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .auth-form-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .auth-form-group label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .auth-form-group .helper-text {
          font-size: 0.725rem;
          color: var(--color-text-muted);
          margin-top: 0.125rem;
        }
        .auth-input-wrap {
          position: relative;
        }
        .auth-input-wrap .auth-icon {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }
        .auth-input-wrap input {
          width: 100%;
          padding: 0.75rem 0.875rem 0.75rem 2.75rem;
          border: 1.5px solid var(--color-surface-200);
          border-radius: 0.75rem;
          font-size: 0.9rem;
          background: var(--color-surface-0);
          color: var(--color-text-primary);
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
          font-family: var(--font-sans);
        }
        .auth-input-wrap input:focus {
          border-color: var(--color-brand-500);
          box-shadow: 0 0 0 3px rgba(92, 124, 250, 0.1);
        }
        .auth-input-wrap input::placeholder {
          color: var(--color-surface-400);
        }
        .password-toggle {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
        }
        .password-toggle:hover {
          color: var(--color-text-secondary);
        }
        .auth-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        @media (max-width: 480px) {
          .auth-row { grid-template-columns: 1fr; }
        }
        .auth-error {
          padding: 0.75rem 1rem;
          border-radius: 0.625rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.15);
          color: #ef4444;
          font-size: 0.8125rem;
          font-weight: 500;
        }
        .auth-success {
          padding: 0.75rem 1rem;
          border-radius: 0.625rem;
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.15);
          color: #22c55e;
          font-size: 0.8125rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .auth-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, var(--color-brand-600), var(--color-brand-700));
          border: none;
          border-radius: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 12px rgba(66, 99, 235, 0.3);
          width: 100%;
          margin-top: 0.25rem;
          font-family: var(--font-sans);
        }
        .auth-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(66, 99, 235, 0.4);
        }
        .auth-btn-primary:active { transform: translateY(0); }
        .auth-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .auth-divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          color: var(--color-text-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0.125rem 0;
        }
        .auth-divider::before, .auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--color-surface-200);
        }
        .google-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-primary);
          background: var(--color-surface-0);
          border: 1.5px solid var(--color-surface-200);
          border-radius: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
          font-family: var(--font-sans);
        }
        .google-btn:hover {
          background: var(--color-surface-50);
          border-color: var(--color-surface-300);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .google-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .google-btn svg { flex-shrink: 0; }
        .auth-footer {
          text-align: center;
          font-size: 0.85rem;
          color: var(--color-text-muted);
          margin-top: 1.5rem;
        }
        .auth-footer a {
          color: var(--color-brand-600);
          font-weight: 600;
          text-decoration: none;
          transition: color 0.15s;
        }
        .auth-footer a:hover {
          color: var(--color-brand-700);
          text-decoration: underline;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="auth-card glass-card animate-in">
        <div className="auth-logo">
          <div className="icon-wrap">
            <Plane size={24} color="white" />
          </div>
          <h1 className="gradient-text">GroupTrip Ledger</h1>
        </div>

        <p className="auth-subtitle">
          Create your account and start planning trips with friends.
        </p>

        {error && <div className="auth-error">{error}</div>}
        {success && (
          <div className="auth-success">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        {!success ? (
          <form onSubmit={handleSignup} className="auth-form">
            <div className="auth-form-group">
              <label>Full Name</label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-icon" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="auth-form-group">
              <label>Email Address</label>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-icon" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-form-group">
              <label>Mobile Number (UPI)</label>
              <div className="auth-input-wrap">
                <Phone size={16} className="auth-icon" />
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                  pattern="[0-9+\-\s]{10,15}"
                />
              </div>
              <span className="helper-text">
                This number will be used as your UPI ID for trip payments
              </span>
            </div>

            <div className="auth-row">
              <div className="auth-form-group">
                <label>Password</label>
                <div className="auth-input-wrap">
                  <Lock size={16} className="auth-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="auth-form-group">
                <label>Confirm Password</label>
                <div className="auth-input-wrap">
                  <Lock size={16} className="auth-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="auth-btn-primary" disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
              Create Account
            </button>

            <div className="auth-divider"><span>or sign up with</span></div>

            <button type="button" className="google-btn" onClick={handleGoogleSignup} disabled={googleLoading}>
              {googleLoading ? (
                <Loader2 size={18} className="spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              )}
              Continue with Google
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <a href="/login" className="auth-btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
              <ArrowRight size={16} />
              Go to Sign In
            </a>
          </div>
        )}

        <div className="auth-footer">
          Already have an account?{' '}
          <a href="/login">Sign in</a>
        </div>
      </div>
    </div>
  );
}
