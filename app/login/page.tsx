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

  // Webmail inputs
  const [webmailEmail, setWebmailEmail] = useState('');
  const [webmailPassword, setWebmailPassword] = useState('');
  const [webmailClient, setWebmailClient] = useState('Roundcube (Modern Webmail)');
  const [webmailStatus, setWebmailStatus] = useState('');

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

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
        const destination = data.user?.role === 'ADMIN' ? '/admin/dashboard' : '/client/dashboard';
        if (typeof window !== 'undefined') {
          window.location.href = destination;
        } else {
          router.push(destination);
        }
      } else {
        setError(data.error || 'Invalid email or password.');
      }
    } catch (err: any) {
      setError(err.message || 'Login request failed. Please check your network connection.');
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

  const handleWebmailLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    setWebmailStatus('Connecting to secure webmail gateway...');
    const domain = webmailEmail.includes('@') ? webmailEmail.split('@')[1] : 'hostmattic.com';
    setTimeout(() => {
      window.open(`https://webmail.${domain}`, '_blank', 'noopener,noreferrer');
      setWebmailStatus('');
    }, 600);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    setForgotMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setForgotMessage(data.message || 'If an account exists with this email, a reset link has been dispatched to your inbox.');
      } else {
        setForgotError(data.error || 'Unable to process reset request. Please contact support.');
      }
    } catch (err: any) {
      setForgotError(err.message || 'Network connection failed. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    setForgotEmail(email.trim());
    setShowForgotModal(true);
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
                <label className="form-label" htmlFor="clientEmail">Email Address or Username</label>
                <input
                  type="text"
                  id="clientEmail"
                  className="form-input"
                  placeholder="name@yourcompany.com or admin"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" htmlFor="clientPassword" style={{ marginBottom: 0 }}>Password</label>
                  <button
                    type="button"
                    className="form-link"
                    style={{ fontSize: '0.82rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={openForgotModal}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="clientPassword"
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
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
            <form onSubmit={handleWebmailLaunch}>
              <div className="form-group">
                <label className="form-label" htmlFor="webmailEmail">Business Email Address</label>
                <input
                  type="email"
                  id="webmailEmail"
                  className="form-input"
                  placeholder="you@yourdomain.com"
                  value={webmailEmail}
                  onChange={(e) => setWebmailEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="webmailPass">Mailbox Password</label>
                <input
                  type="password"
                  id="webmailPass"
                  className="form-input"
                  placeholder="Mailbox password"
                  value={webmailPassword}
                  onChange={(e) => setWebmailPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Webmail Client</label>
                <select
                  className="form-select"
                  value={webmailClient}
                  onChange={(e) => setWebmailClient(e.target.value)}
                >
                  <option>Roundcube (Modern Webmail)</option>
                  <option>Horde Enterprise</option>
                  <option>Mobile Lite</option>
                </select>
              </div>

              {webmailStatus && (
                <p style={{ fontSize: '0.85rem', color: 'var(--brand-action-green)', marginBottom: '14px' }}>
                  ⏳ {webmailStatus}
                </p>
              )}

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
                <label className="form-label" htmlFor="cpanelHostInput">Server Hostname or Your Domain</label>
                <input
                  type="text"
                  id="cpanelHostInput"
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

        <div className="auth-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <div>
            Don&apos;t have an account yet?{' '}
            <Link href="/register" className="form-link" style={{ fontWeight: 700 }}>
              Create an Account →
            </Link>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Hostmattic Staff?{' '}
            <Link href="/admin/login" style={{ color: 'var(--brand-cyan)', fontWeight: 600 }}>
              Staff Operations Portal →
            </Link>
          </div>
        </div>
      </div>

      {/* Forgot Password Interactive Modal */}
      {showForgotModal && (
        <div
          className="modal-backdrop-responsive"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForgotModal(false);
          }}
          style={{ zIndex: 99999 }}
        >
          <div className="modal-card-responsive" style={{ maxWidth: '440px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0', color: '#0F172A' }}>
                  Reset Account Password
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  Enter your registered client email to receive a password recovery link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                }}
              >
                ✕
              </button>
            </div>

            {forgotError && (
              <div
                style={{
                  background: '#FEE2E2',
                  border: '1px solid #FCA5A5',
                  color: '#B91C1C',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                }}
              >
                ⚠️ {forgotError}
              </div>
            )}

            {forgotMessage ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✉️</div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#15803D', marginBottom: '8px' }}>
                  Reset Link Dispatched
                </h4>
                <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.5, marginBottom: '20px' }}>
                  {forgotMessage}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowForgotModal(false)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" htmlFor="forgotEmailInput">Registered Email Address</label>
                  <input
                    type="email"
                    id="forgotEmailInput"
                    className="form-input"
                    placeholder="name@yourcompany.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowForgotModal(false)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={forgotLoading}
                    style={{ flex: 1.4, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    {forgotLoading ? (
                      <>
                        <span className="spinner-inline"></span> Sending...
                      </>
                    ) : (
                      'Send Reset Link →'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
