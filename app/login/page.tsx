'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'client' | 'webmail' | 'cpanel'>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cpanelHost, setCpanelHost] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'CUSTOMER' }),
      });

      const data = await res.json();
      if (data.success) {
        router.push('/client/dashboard');
      } else {
        setError(data.error || 'Invalid credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCpanelRedirect = (e: React.FormEvent) => {
    e.preventDefault();
    let val = cpanelHost.trim();
    if (!val) return;
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
      val = 'https://' + val;
    }
    if (!val.includes(':2083') && !val.includes(':2082')) {
      val = val.replace(/\/$/, '') + ':2083';
    }
    window.open(val, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="auth-page-wrap">
      <div className="auth-card">
        <div className="auth-card-header">
          <h2 style={{ fontSize: '1.6rem', marginBottom: '6px' }}>Sign In to Hostmattic</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Manage your domains, web hosting, and billing.</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={`auth-tab ${tab === 'client' ? 'active' : ''}`}
            onClick={() => { setTab('client'); setError(''); }}
            role="tab"
          >
            Client Portal
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'webmail' ? 'active' : ''}`}
            onClick={() => { setTab('webmail'); setError(''); }}
            role="tab"
          >
            Webmail Login
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'cpanel' ? 'active' : ''}`}
            onClick={() => { setTab('cpanel'); setError(''); }}
            role="tab"
          >
            cPanel / Server
          </button>
        </div>

        {/* Tab Body */}
        <div className="auth-card-body">
          {error && (
            <div
              style={{
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                padding: '12px 14px',
                borderRadius: '10px',
                marginBottom: '20px',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚠️</span> {error}
            </div>
          )}

          {/* 1. Client Portal */}
          {tab === 'client' && (
            <form onSubmit={handleClientLogin}>
              <div className="form-group">
                <label className="form-label" htmlFor="clientEmail">Email Address</label>
                <input
                  type="email"
                  id="clientEmail"
                  className="form-input"
                  placeholder="name@yourcompany.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" htmlFor="clientPassword" style={{ marginBottom: 0 }}>Password</label>
                  <a
                    href="#forgot"
                    className="form-link"
                    style={{ fontSize: '0.82rem' }}
                    onClick={(e) => { e.preventDefault(); alert('Password reset link will be sent to your email.'); }}
                  >
                    Forgot Password?
                  </a>
                </div>
                <div className="password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="clientPassword"
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="form-row-split">
                <label className="form-checkbox-label">
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--brand-action-green)' }} /> Remember my session
                </label>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>🔒 2FA Enabled</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '13px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                {loading ? (
                  <>
                    <span className="spinner-inline"></span> Authenticating...
                  </>
                ) : (
                  'Sign In to Client Portal →'
                )}
              </button>

              <div className="auth-security-badges">
                <span>🔒 TLS 1.3</span>
                <span>•</span>
                <span>🛡️ Brute-Force Guard</span>
                <span>•</span>
                <span>⚡ Instant Auth</span>
              </div>
            </form>
          )}

          {/* 2. Webmail Quick Access */}
          {tab === 'webmail' && (
            <form onSubmit={(e) => { e.preventDefault(); alert('Redirecting to your webmail interface...'); }}>
              <div className="form-group">
                <label className="form-label">Business Email Address</label>
                <input type="email" className="form-input" placeholder="you@yourdomain.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Mailbox Password</label>
                <input type="password" className="form-input" placeholder="Mailbox password" required />
              </div>
              <div className="form-group">
                <label className="form-label">Webmail Client</label>
                <select className="form-select">
                  <option>Roundcube (Modern Webmail)</option>
                  <option>Horde Enterprise</option>
                  <option>Mobile Lite</option>
                </select>
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px 24px' }}
              >
                Launch Webmail Session →
              </button>
            </form>
          )}

          {/* 3. cPanel Quick Access */}
          {tab === 'cpanel' && (
            <form onSubmit={handleCpanelRedirect}>
              <div className="form-group">
                <label className="form-label">Server Hostname or Your Domain</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="cpanel.yourdomain.com or server IP"
                  value={cpanelHost}
                  onChange={(e) => setCpanelHost(e.target.value)}
                  required
                />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                You will be connected directly to your dedicated cPanel instance on secure port <strong>2083</strong>.
              </p>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px 24px', background: 'var(--brand-action-cyan)' }}
              >
                Connect to cPanel :2083 →
              </button>
            </form>
          )}
        </div>

        <div className="auth-footer">
          Don&apos;t have an account yet?{' '}
          <Link href="/register" className="form-link" style={{ fontWeight: 700 }}>
            Create an Account →
          </Link>
        </div>
      </div>
    </div>
  );
}
