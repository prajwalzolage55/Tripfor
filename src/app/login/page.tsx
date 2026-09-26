'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { Plane, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = userCredential.user;

      const docRef = doc(db, 'user_profiles', user.uid);
      const defaultName = user.displayName || (email.split('@')[0] ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : 'User');
      let profileData = {
        id: user.uid,
        display_name: defaultName,
        email: user.email || email.trim().toLowerCase(),
        phone: user.phoneNumber || '',
        avatar_url: user.photoURL || null,
      };

      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          profileData = {
            id: user.uid,
            display_name: data.display_name || profileData.display_name,
            email: data.email || profileData.email,
            phone: data.phone || profileData.phone,
            avatar_url: data.avatar_url || profileData.avatar_url,
          };
        } else {
          // If the profile document doesn't exist yet, auto-create it now
          await setDoc(docRef, profileData);
        }
      } catch (firestoreErr) {
        console.warn('Could not fetch or create Firestore user profile:', firestoreErr);
      }

      // Store user in context + localStorage
      setUser(profileData);

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
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
          max-width: 440px;
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
          gap: 1.125rem;
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
        .auth-error {
          padding: 0.75rem 1rem;
          border-radius: 0.625rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.15);
          color: #ef4444;
          font-size: 0.8125rem;
          font-weight: 500;
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
          Welcome back! Sign in to manage your trips.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleLogin} className="auth-form">
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
            <label>Password</label>
            <div className="auth-input-wrap">
              <Lock size={16} className="auth-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
                style={{ paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
            Sign In
          </button>
        </form>

        <div className="auth-footer">
          Don&apos;t have an account?{' '}
          <a href="/signup">Create one</a>
        </div>
      </div>
    </div>
  );
}
