'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState('US');
  const [agreed, setAgreed] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setError('Please agree to the Terms of Service to continue.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone: phone || undefined,
          company: company || undefined,
          country,
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push('/client/dashboard');
      } else {
        setError(data.error || 'Failed to create your account.');
      }
    } catch (err: any) {
      setError(err.message || 'Registration network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrap">
      <div className="auth-card" style={{ maxWidth: '540px' }}>
        <div className="auth-card-header">
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: 'var(--brand-lime-light)',
              borderRadius: '999px',
              color: 'var(--brand-action-green)',
              fontSize: '0.78rem',
              fontWeight: 700,
              marginBottom: '10px',
            }}
          >
            <span className="pulse-dot"></span> Instant Account Activation
          </span>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '6px' }}>Create Your Hostmattic Account</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
            Get instant access to cloud web hosting, domain registration, and our customer control panel.
          </p>
        </div>

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

          <form onSubmit={handleRegister}>
            <div className="grid-col-1-to-2">
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" htmlFor="fullName">Full Name *</label>
                <input
                  type="text"
                  id="fullName"
                  className="form-input"
                  placeholder="e.g. Sarah Jenkins"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" htmlFor="emailAddress">Email Address *</label>
                <input
                  type="email"
                  id="emailAddress"
                  className="form-input"
                  placeholder="sarah@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" htmlFor="regPassword">Account Password *</label>
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="regPassword"
                  className="form-input"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
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

            <div className="grid-col-1-to-2">
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" htmlFor="phoneNumber">Phone Number</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  className="form-input"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" htmlFor="country">Country</label>
                <select
                  id="country"
                  className="form-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="US">United States (US)</option>
                  <option value="IN">India (IN)</option>
                  <option value="GB">United Kingdom (GB)</option>
                  <option value="CA">Canada (CA)</option>
                  <option value="AU">Australia (AU)</option>
                  <option value="DE">Germany (DE)</option>
                  <option value="SG">Singapore (SG)</option>
                  <option value="AE">United Arab Emirates (AE)</option>
                  <option value="OTHER">Other / Global</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" htmlFor="companyName">Company / Organization (Optional)</label>
              <input
                type="text"
                id="companyName"
                className="form-input"
                placeholder="e.g. Acme Cloud Innovations"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '22px' }}>
              <label className="form-checkbox-label" style={{ fontSize: '0.84rem' }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  style={{ accentColor: 'var(--brand-action-green)' }}
                />
                <span>
                  I agree to Hostmattic&apos;s{' '}
                  <a href="#terms" onClick={(e) => e.preventDefault()} className="form-link">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#privacy" onClick={(e) => e.preventDefault()} className="form-link">
                    Privacy Policy
                  </a>.
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '14px 24px',
                fontSize: '0.95rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <span className="spinner-inline"></span> Creating Account...
                </>
              ) : (
                'Create Hostmattic Account →'
              )}
            </button>

            <div className="auth-security-badges">
              <span>🔒 256-Bit SSL</span>
              <span>•</span>
              <span>⚡ Instant Provisioning</span>
              <span>•</span>
              <span>🛡️ White-Label Security</span>
            </div>
          </form>
        </div>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link href="/login" className="form-link" style={{ fontWeight: 700 }}>
            Sign In to Client Portal →
          </Link>
        </div>
      </div>
    </div>
  );
}
