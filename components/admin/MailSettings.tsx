'use client';

import React, { useEffect, useState } from 'react';

/**
 * SMTP / transactional mail configuration.
 *
 * Deliberately shows two things apart: what is SAVED, and what the
 * application is actually USING. They differ more often than you would
 * expect - an environment fallback, or a password that cannot be decrypted
 * because the encryption key changed, both leave a correct-looking form
 * beside a mail system that is not sending.
 */

interface Settings {
  provider: 'NONE' | 'SMTP' | 'RESEND';
  host: string;
  port: number;
  secure: boolean;
  username: string;
  hasPassword: boolean;
  passwordLast4: string;
  allowInvalidCert: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
  lastTestTo: string | null;
  lastSendOkAt: string | null;
  lastSendErrorAt: string | null;
  lastSendError: string | null;
  lastSendErrorTo: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface Effective {
  provider: string;
  source: string;
  from: string;
  problem: string | null;
}

/** Resend's own answer on whether it will send from the configured address. */
interface ResendDomain {
  checked: boolean;
  verified?: boolean;
  domain?: string;
  status?: string;
  detail?: string;
}

const PRESETS: { label: string; host: string; port: number; secure: boolean }[] = [
  { label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587, secure: false },
  { label: 'Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false },
  { label: 'Zoho Mail (India)', host: 'smtp.zoho.in', port: 587, secure: false },
  { label: 'Amazon SES (Mumbai)', host: 'email-smtp.ap-south-1.amazonaws.com', port: 587, secure: false },
  { label: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, secure: false },
];

const label: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#334155',
  marginBottom: '6px',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #CBD5E1',
  borderRadius: '9px',
  fontSize: '0.9rem',
  color: '#0F172A',
  background: '#FFFFFF',
  minWidth: 0,
};

const panel: React.CSSProperties = {
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: '14px',
  padding: '20px',
  marginBottom: '18px',
};

function Note({ tone, children }: { tone: 'error' | 'ok' | 'warn' | 'info'; children: React.ReactNode }) {
  const p = {
    error: { bg: '#FEF2F2', border: '#FCA5A5', fg: '#991B1B' },
    ok: { bg: '#EBF7D4', border: '#C4E58C', fg: '#4F7C12' },
    warn: { bg: '#FFFBEB', border: '#FCD34D', fg: '#92400E' },
    info: { bg: '#F1F5F9', border: '#CBD5E1', fg: '#334155' },
  }[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      style={{
        background: p.bg,
        border: `1px solid ${p.border}`,
        color: p.fg,
        padding: '12px 14px',
        borderRadius: '10px',
        fontSize: '0.84rem',
        lineHeight: 1.6,
        marginBottom: '16px',
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </div>
  );
}

export default function MailSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [settings, setSettings] = useState<Settings | null>(null);
  const [effective, setEffective] = useState<Effective | null>(null);
  const [resendDomain, setResendDomain] = useState<ResendDomain | null>(null);
  const [encryptionAvailable, setEncryptionAvailable] = useState(true);
  const [resendEnvKeyPresent, setResendEnvKeyPresent] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  // Separate from `settings`: an empty box means "keep the stored password",
  // not "clear it".
  const [password, setPassword] = useState('');

  const load = async () => {
    try {
      const res = await fetch('/api/admin/settings/mail');
      const json = await res.json();
      if (json.success) {
        setSettings(json.settings);
        setEffective(json.effective);
        setResendDomain(json.resendDomain ?? null);
        setEncryptionAvailable(Boolean(json.encryptionAvailable));
        setResendEnvKeyPresent(Boolean(json.resendEnvKeyPresent));
        setTestRecipient(json.testRecipient || '');
        setError('');
      } else {
        setError(json.error || 'Could not load mail settings.');
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patch = (changes: Partial<Settings>) =>
    setSettings((s) => (s ? { ...s, ...changes } : s));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/settings/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, password: password || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage(json.message || 'Saved.');
        setPassword('');
        await load();
      } else {
        setError(json.error || 'Could not save.');
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/settings/mail', { method: 'PUT' });
      const json = await res.json();
      if (json.success) {
        setMessage(json.message || 'Test message sent.');
      } else {
        setError(
          (json.stage === 'connect' ? 'Could not connect: ' : 'Could not send: ') +
            (json.error || 'unknown error')
        );
      }
      await load();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div style={{ padding: '24px', color: '#64748B' }}>Loading mail settings…</div>;
  if (!settings) return <Note tone="error">{error || 'Mail settings unavailable.'}</Note>;

  const isSmtp = settings.provider === 'SMTP';

  return (
    <div style={{ maxWidth: '760px' }}>
      <h2 style={{ fontSize: '1.3rem', color: '#0F172A', margin: '0 0 6px', fontWeight: 800 }}>
        Transactional email
      </h2>
      <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '0 0 20px', lineHeight: 1.6 }}>
        Password resets, order receipts, renewal reminders and ticket replies all go out through
        this. If it is not working, none of them reach anyone.
      </p>

      {error && <Note tone="error">{error}</Note>}
      {message && <Note tone="ok">{message}</Note>}

      {/* What is actually in use, which is not always what is saved below. */}
      {effective && (
        <Note tone={effective.provider === 'NONE' ? 'error' : 'info'}>
          <strong>Currently sending via: {effective.provider}</strong>
          {effective.source === 'environment' && ' (credentials from the environment, not from here)'}
          {effective.from ? ` — from ${effective.from}` : ''}
          {effective.problem && (
            <div style={{ marginTop: '6px' }}>
              <strong>Problem:</strong> {effective.problem}
            </div>
          )}
          {effective.provider === 'NONE' && !effective.problem && (
            <div style={{ marginTop: '6px' }}>
              No provider is configured, so nothing is being sent at all.
            </div>
          )}
        </Note>
      )}

      {/* Resend's own answer on the sending domain. Worth its own banner: an
          unverified domain still delivers to the account owner, so every
          in-app check short of this one reports healthy while customers get
          nothing. */}
      {resendDomain && resendDomain.checked && !resendDomain.verified && (
        <Note tone="error">
          <strong>
            Resend will not send from {resendDomain.domain}
            {resendDomain.status ? ` (status: ${resendDomain.status})` : ''}.
          </strong>
          {resendDomain.detail && <div style={{ marginTop: '6px' }}>{resendDomain.detail}</div>}
          <div style={{ marginTop: '6px' }}>
            Mail to your own address may still arrive, which is why a test send can pass while
            password resets and receipts to customers are refused.
          </div>
        </Note>
      )}

      {resendDomain && !resendDomain.checked && resendDomain.detail && (
        <Note tone="info">
          <strong>Sending domain not checked.</strong>
          <div style={{ marginTop: '6px' }}>{resendDomain.detail}</div>
        </Note>
      )}

      {resendDomain && resendDomain.verified && (
        <Note tone="ok">
          <strong>{resendDomain.domain} is verified with Resend.</strong> It will accept mail sent
          from this address to any recipient.
        </Note>
      )}

      {!encryptionAvailable && (
        <Note tone="warn">
          <strong>SETTINGS_ENCRYPTION_KEY is not set on this deployment.</strong> The SMTP password
          cannot be stored safely until it is. Generate one with <code>openssl rand -hex 32</code>{' '}
          and add it to the environment.
        </Note>
      )}

      <form onSubmit={handleSave}>
        <div style={panel}>
          <label style={label} htmlFor="mail-provider">
            Provider
          </label>
          <select
            id="mail-provider"
            value={settings.provider}
            onChange={(e) => patch({ provider: e.target.value as Settings['provider'] })}
            style={{ ...input, maxWidth: '320px' }}
          >
            <option value="NONE">Off — send nothing</option>
            <option value="SMTP">SMTP (your own mail server)</option>
            <option value="RESEND">Resend API</option>
          </select>

          {settings.provider === 'RESEND' && !resendEnvKeyPresent && (
            <div style={{ marginTop: '12px' }}>
              <Note tone="warn">
                RESEND_API_KEY is not set in this environment, so Resend cannot send. Set it in the
                deployment, or choose SMTP.
              </Note>
            </div>
          )}

          {settings.provider === 'NONE' && (
            <p style={{ color: '#92400E', fontSize: '0.84rem', margin: '12px 0 0', lineHeight: 1.6 }}>
              With this off, password resets will not work. Customers who are locked out will stay
              locked out.
            </p>
          )}
        </div>

        {isSmtp && (
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '1rem', color: '#0F172A', margin: 0 }}>SMTP server</h3>
              <select
                aria-label="Common provider presets"
                value=""
                onChange={(e) => {
                  const preset = PRESETS.find((p) => p.label === e.target.value);
                  if (preset) patch({ host: preset.host, port: preset.port, secure: preset.secure });
                }}
                style={{ ...input, width: 'auto', maxWidth: '260px', fontSize: '0.82rem', padding: '7px 10px' }}
              >
                <option value="">Fill from a common provider…</option>
                {PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
              <div>
                <label style={label} htmlFor="mail-host">
                  Host
                </label>
                <input
                  id="mail-host"
                  value={settings.host}
                  onChange={(e) => patch({ host: e.target.value })}
                  placeholder="smtp.example.com"
                  style={input}
                />
              </div>

              <div>
                <label style={label} htmlFor="mail-port">
                  Port
                </label>
                <input
                  id="mail-port"
                  type="number"
                  value={settings.port}
                  onChange={(e) => patch({ port: Number(e.target.value) })}
                  style={input}
                />
                <p style={{ color: '#94A3B8', fontSize: '0.74rem', margin: '6px 0 0', lineHeight: 1.5 }}>
                  587 with TLS off (STARTTLS), or 465 with TLS on.
                </p>
              </div>

              <div>
                <label style={label} htmlFor="mail-username">
                  Username
                </label>
                <input
                  id="mail-username"
                  value={settings.username}
                  onChange={(e) => patch({ username: e.target.value })}
                  autoComplete="off"
                  style={input}
                />
              </div>

              <div>
                <label style={label} htmlFor="mail-password">
                  Password
                </label>
                <input
                  id="mail-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={
                    settings.hasPassword
                      ? `Stored — ends ${settings.passwordLast4 || '••••'}. Leave blank to keep.`
                      : 'Required'
                  }
                  style={input}
                />
                <p style={{ color: '#94A3B8', fontSize: '0.74rem', margin: '6px 0 0', lineHeight: 1.5 }}>
                  Encrypted before storage and never shown again. For Gmail and Microsoft 365 this
                  must be an app password, not the account password.
                </p>
              </div>
            </div>

            <label
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#334155', marginTop: '16px' }}
            >
              <input
                type="checkbox"
                checked={settings.secure}
                onChange={(e) => patch({ secure: e.target.checked })}
              />
              Use TLS directly (port 465). Leave off for 587.
            </label>

            <label
              style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.86rem', color: '#334155', marginTop: '10px' }}
            >
              <input
                type="checkbox"
                checked={settings.allowInvalidCert}
                onChange={(e) => patch({ allowInvalidCert: e.target.checked })}
                style={{ marginTop: '3px' }}
              />
              <span>
                Accept an invalid TLS certificate.
                <span style={{ color: '#92400E' }}>
                  {' '}
                  This stops us checking that the certificate belongs to the server we are talking
                  to. Only for a server you control.
                </span>
              </span>
            </label>
          </div>
        )}

        {settings.provider !== 'NONE' && (
          <div style={panel}>
            <h3 style={{ fontSize: '1rem', color: '#0F172A', margin: '0 0 14px' }}>Sender</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
              <div>
                <label style={label} htmlFor="mail-from-name">
                  From name
                </label>
                <input
                  id="mail-from-name"
                  value={settings.fromName}
                  onChange={(e) => patch({ fromName: e.target.value })}
                  placeholder="Hostmattic"
                  style={input}
                />
              </div>
              <div>
                <label style={label} htmlFor="mail-from-email">
                  From address
                </label>
                <input
                  id="mail-from-email"
                  type="email"
                  value={settings.fromEmail}
                  onChange={(e) => patch({ fromEmail: e.target.value })}
                  placeholder="no-reply@hostmattic.com"
                  style={input}
                />
              </div>
              <div>
                <label style={label} htmlFor="mail-reply-to">
                  Reply-To <span style={{ fontWeight: 500, color: '#94A3B8' }}>(optional)</span>
                </label>
                <input
                  id="mail-reply-to"
                  type="email"
                  value={settings.replyTo}
                  onChange={(e) => patch({ replyTo: e.target.value })}
                  placeholder="support@hostmattic.com"
                  style={input}
                />
                <p style={{ color: '#94A3B8', fontSize: '0.74rem', margin: '6px 0 0', lineHeight: 1.5 }}>
                  Where replies go. Worth setting — people do reply to receipts.
                </p>
              </div>
            </div>

            <p style={{ color: '#64748B', fontSize: '0.8rem', margin: '14px 0 0', lineHeight: 1.6 }}>
              The sending domain needs SPF and DKIM records pointing at this server, or most of what
              you send will land in spam regardless of whether it leaves here successfully.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '11px 22px',
              background: saving ? '#94A3B8' : '#4F7C12',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={testing || settings.provider === 'NONE'}
            style={{
              padding: '11px 22px',
              background: '#FFFFFF',
              color: settings.provider === 'NONE' ? '#94A3B8' : '#0F172A',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: testing || settings.provider === 'NONE' ? 'default' : 'pointer',
            }}
          >
            {testing ? 'Sending…' : 'Send test email'}
          </button>

          {testRecipient && (
            <span style={{ color: '#64748B', fontSize: '0.8rem' }}>
              Test goes to {testRecipient} — your own address, always.
            </span>
          )}
        </div>
      </form>

      {/* What real outbound mail did. The test below cannot tell you this:
          it always goes to your own address, which on an unverified Resend
          account is the one address that still works. */}
      {(settings.lastSendErrorAt || settings.lastSendOkAt) && (
        <div style={{ ...panel, marginTop: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', color: '#0F172A', margin: '0 0 10px' }}>
            Real outbound mail
          </h3>
          <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.7 }}>
            {settings.lastSendErrorAt ? (
              <>
                <div>
                  <strong style={{ color: '#991B1B' }}>✕ Last failure</strong> —{' '}
                  {new Date(settings.lastSendErrorAt).toLocaleString()}
                  {settings.lastSendErrorTo ? ` sending to ${settings.lastSendErrorTo}` : ''}
                </div>
                {settings.lastSendError && (
                  <div style={{ color: '#991B1B', marginTop: '6px', overflowWrap: 'anywhere' }}>
                    {settings.lastSendError}
                  </div>
                )}
                <div style={{ color: '#64748B', marginTop: '6px' }}>
                  Password reset replies the same way whether or not it sent — it has to, or the
                  reply would reveal which addresses have accounts — so a failure there is silent
                  to the customer and to you. This is where it shows up.
                </div>
              </>
            ) : (
              <div>
                <strong style={{ color: '#4F7C12' }}>✓ No recent failures</strong>
                {settings.lastSendOkAt
                  ? ` — last successful send ${new Date(settings.lastSendOkAt).toLocaleString()}`
                  : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {settings.lastTestAt && (
        <div style={{ ...panel, marginTop: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', color: '#0F172A', margin: '0 0 10px' }}>Last test</h3>
          <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.7 }}>
            <div>
              <strong style={{ color: settings.lastTestOk ? '#4F7C12' : '#991B1B' }}>
                {settings.lastTestOk ? '✓ Delivered to the server' : '✕ Failed'}
              </strong>{' '}
              — {new Date(settings.lastTestAt).toLocaleString()}
              {settings.lastTestTo ? ` to ${settings.lastTestTo}` : ''}
            </div>
            {settings.lastTestError && (
              <div style={{ color: '#991B1B', marginTop: '6px', overflowWrap: 'anywhere' }}>
                {settings.lastTestError}
              </div>
            )}
            {settings.lastTestOk && (
              <div style={{ color: '#64748B', marginTop: '6px' }}>
                The server accepted it. That is not proof it reached the inbox — check the mailbox,
                and the spam folder. It is also not proof that mail reaches <em>customers</em>:
                this test always goes to your own address, and on an unverified sending domain
                that is the only address that works.
              </div>
            )}
          </div>
        </div>
      )}

      {settings.updatedAt && (
        <p style={{ color: '#94A3B8', fontSize: '0.78rem', marginTop: '14px' }}>
          Last changed {new Date(settings.updatedAt).toLocaleString()}
          {settings.updatedBy ? ` by ${settings.updatedBy}` : ''}.
        </p>
      )}
    </div>
  );
}
