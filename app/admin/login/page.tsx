'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showMasterPass, setShowMasterPass] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password, totp, role: 'ADMIN' }),
      });

      const data = await res.json();
      if (data.success) {
        router.push('/admin/dashboard');
      } else {
        setError(data.error || 'Authentication rejected by security policy.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with security gateway.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 180px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: 'var(--slate-950)' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'var(--slate-900)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', overflow: 'hidden' }}>
        <div style={{ padding: '36px 32px 24px', textAlign: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
          <picture>
            <source srcSet="/assets/img/hostmattic-logo-white.webp" type="image/webp" />
            <img
              src="/assets/img/hostmattic-logo-white.png"
              alt="Hostmattic"
              width="180"
              height="35"
              fetchPriority="high"
              style={{ height: '35px', width: 'auto', margin: '0 auto 16px', display: 'block' }}
            />
          </picture>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'rgba(255, 205, 0, 0.15)', border: '1px solid rgba(255, 205, 0, 0.35)', borderRadius: '999px', color: 'var(--brand-gold)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
            <span className="pulse-dot" style={{ background: 'var(--brand-gold)', boxShadow: '0 0 8px var(--brand-gold)' }}></span> Admin Console
          </span>
          <h2 style={{ fontSize: '1.45rem', color: '#FFFFFF', marginBottom: '6px' }}>Staff Operations Portal</h2>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Hostmattic Infrastructure &amp; Reseller Controls</p>
        </div>

        <div style={{ padding: '32px' }}>
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#FCA5A5', padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '24px', lineHeight: 1.5 }}>
            🛡️ <strong>Restricted Area:</strong> Authorized personnel only. All login attempts, sessions, and IP signatures are logged to the security audit trail.
          </div>

          <form onSubmit={handleAdminLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#CBD5E1', fontSize: '0.88rem', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Staff Username / ID</label>
              <input
                type="text"
                className="form-input"
                style={{ background: 'rgba(0,0,0,0.35)', color: '#FFF', borderColor: 'rgba(255,255,255,0.15)' }}
                placeholder="admin@hostmattic.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#CBD5E1', fontSize: '0.88rem', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Master Password</label>
              <div className="password-wrap">
                <input
                  type={showMasterPass ? 'text' : 'password'}
                  className="form-input"
                  style={{ background: 'rgba(0,0,0,0.35)', color: '#FFF', borderColor: 'rgba(255,255,255,0.15)' }}
                  placeholder="••••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowMasterPass(!showMasterPass)}
                  style={{ color: '#94A3B8' }}
                  title={showMasterPass ? 'Hide password' : 'Show password'}
                >
                  {showMasterPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ color: '#CBD5E1', fontSize: '0.88rem', fontWeight: 600, margin: 0 }}>2FA Authenticator Code</label>
                <span style={{ fontSize: '0.75rem', color: 'var(--brand-gold)' }}>TOTP</span>
              </div>
              <input
                type="text"
                className="form-input mono"
                style={{ background: 'rgba(0,0,0,0.35)', color: '#FFF', borderColor: 'rgba(255,255,255,0.15)', letterSpacing: '0.2em', fontSize: '1.1rem', textAlign: 'center' }}
                placeholder="000 000"
                maxLength={7}
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '13px 24px', background: 'var(--brand-action-green)', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {loading ? (
                <>
                  <span className="spinner-inline"></span> Verifying 2FA Keys...
                </>
              ) : (
                'Authenticate & Launch Console →'
              )}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.82rem', color: '#64748B' }}>
            Hardware Token • IP Geofencing • Hardware Key FIDO2
          </div>
        </div>

        <div style={{ padding: '14px 32px', background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: '0.82rem' }}>
          Looking for client area? <Link href="/login" style={{ color: 'var(--brand-cyan)', fontWeight: 600 }}>Switch to Client Login →</Link>
        </div>
      </div>
    </div>
  );
}
