'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Where a reset link lands.
 *
 * The link used to point at /login?resetToken=..., which nothing read - the
 * page ignored the parameter entirely, so every reset email ever sent led
 * nowhere. This page checks the token BEFORE asking for a password, so an
 * expired link is reported before someone types one in and submits it.
 */

const card: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '16px',
  padding: '32px',
  maxWidth: '440px',
  width: '100%',
  boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  border: '1px solid #CBD5E1',
  borderRadius: '10px',
  fontSize: '0.95rem',
  color: '#0F172A',
  background: '#FFFFFF',
};

function Banner({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: React.ReactNode }) {
  const palette = {
    error: { bg: '#FEF2F2', border: '#FCA5A5', fg: '#991B1B' },
    ok: { bg: '#EBF7D4', border: '#C4E58C', fg: '#4F7C12' },
    info: { bg: '#F1F5F9', border: '#CBD5E1', fg: '#334155' },
  }[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        padding: '12px 14px',
        borderRadius: '10px',
        fontSize: '0.86rem',
        lineHeight: 1.55,
        marginBottom: '18px',
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </div>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';

  const [checking, setChecking] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [account, setAccount] = useState<{ email: string; name: string; scope: string } | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ loginPath: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setChecking(false);
      setTokenError('This page needs a reset link. Request one from the sign-in page.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setAccount({ email: json.email, name: json.name, scope: json.scope });
        } else {
          setTokenError(json.error || 'This reset link is not valid.');
        }
      } catch {
        if (!cancelled) setTokenError('Could not check this reset link. Please try again.');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (json.success) {
        setDone({ loginPath: json.loginPath || '/login' });
      } else {
        setError(json.error || 'Could not reset the password.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 16px',
        background: '#F8FAFC',
      }}
    >
      <div style={card}>
        <h1 style={{ fontSize: '1.4rem', color: '#0F172A', margin: '0 0 6px', fontWeight: 800 }}>
          Choose a new password
        </h1>

        {checking && <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Checking your link…</p>}

        {!checking && tokenError && (
          <>
            <Banner tone="error">{tokenError}</Banner>
            <Link
              href="/login"
              style={{ color: '#4F7C12', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}
            >
              Back to sign in
            </Link>
          </>
        )}

        {!checking && done && (
          <>
            <Banner tone="ok">
              Your password has been changed. Sign in with it now.
            </Banner>
            <button
              onClick={() => router.push(done.loginPath)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#4F7C12',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              Go to sign in
            </button>
          </>
        )}

        {!checking && account && !done && (
          <form onSubmit={handleSubmit}>
            <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '0 0 18px', lineHeight: 1.6 }}>
              For <strong style={{ color: '#334155' }}>{account.email}</strong>. This link can only be
              used once.
            </p>

            {error && <Banner tone="error">{error}</Banner>}

            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="new-password"
                style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}
              >
                New password
              </label>
              <input
                id="new-password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                style={input}
              />
              <p style={{ color: '#94A3B8', fontSize: '0.76rem', margin: '6px 0 0' }}>
                At least 8 characters.
              </p>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="confirm-password"
                style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                style={input}
              />
            </div>

            <label
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#475569', marginBottom: '20px' }}
            >
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show passwords
            </label>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px',
                background: submitting ? '#94A3B8' : '#4F7C12',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: submitting ? 'default' : 'pointer',
              }}
            >
              {submitting ? 'Changing…' : 'Change password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary, or the whole route opts out of
  // static rendering with a build-time warning.
  return (
    <Suspense fallback={<main style={{ minHeight: '70vh' }} />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
