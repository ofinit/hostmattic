'use client';

import React, { useEffect, useState } from 'react';

/**
 * Payment gateway configuration.
 *
 * Keys live in the database, sealed with AES-256-GCM, and are editable here so
 * a compromised key can be rotated and a gateway taken out of service without
 * a redeploy. The secret is never sent back by the API - only whether one is
 * installed and its last four characters - so this screen can confirm which
 * key is in place without ever displaying it.
 */

interface Gateway {
  id: 'RAZORPAY' | 'INSTAMOJO';
  label: string;
  publicLabel: string;
  secretLabel: string;
  currencies: string[];
  enabled: boolean;
  sandbox: boolean;
  publicKey: string;
  hasSecret: boolean;
  secretLast4: string;
  selectedCurrencies: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  effectiveSource: 'database' | 'environment' | 'none';
  effectivelyLive: boolean;
}

const panel: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.8)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '14px',
  padding: '20px',
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  color: '#94A3B8',
  marginBottom: '6px',
  fontWeight: 600,
};

const input: React.CSSProperties = {
  width: '100%',
  background: 'rgba(2, 6, 23, 0.9)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  padding: '9px 12px',
  color: '#F8FAFC',
  fontSize: '0.85rem',
  fontFamily: 'var(--font-mono)',
};

export default function PaymentGatewaySettings() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [encryptionAvailable, setEncryptionAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/payments');
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (json?.success) {
        setGateways(json.gateways);
        setEncryptionAvailable(json.encryptionAvailable);
      } else {
        setMessage({ kind: 'error', text: json?.error || 'Could not load payment settings.' });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Could not load payment settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = (id: string, patch: Partial<Gateway>) => {
    setGateways((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const save = async (g: Gateway, confirmNoGateway = false) => {
    setSaving(g.id);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: g.id,
          enabled: g.enabled,
          sandbox: g.sandbox,
          publicKey: g.publicKey,
          secret: secrets[g.id] || undefined,
          currencies: g.selectedCurrencies,
          confirmNoGateway,
        }),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (json?.code === 'LAST_GATEWAY') {
        if (window.confirm(`${json.error}\n\nDisable it anyway?`)) {
          await save(g, true);
          return;
        }
        setMessage({ kind: 'error', text: 'Left enabled.' });
        return;
      }

      if (!json?.success) {
        setMessage({ kind: 'error', text: json?.error || 'Could not save.' });
        return;
      }

      setSecrets((s) => ({ ...s, [g.id]: '' }));
      setMessage({ kind: 'ok', text: json.message });
      await load();
    } catch {
      setMessage({ kind: 'error', text: 'Could not save payment settings.' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div style={{ color: '#94A3B8', padding: '24px' }}>Loading payment settings…</div>;
  }

  return (
    <div style={{ maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ fontSize: '1.25rem', color: '#FFFFFF', marginBottom: '8px' }}>Payment Gateways</h3>
        <p style={{ color: '#94A3B8', fontSize: '0.85rem', lineHeight: 1.6 }}>
          Keys are encrypted before they are stored and are never shown again after saving.
          Turning a gateway off stops new payments through it immediately; payments already in
          progress still complete.
        </p>
      </div>

      {!encryptionAvailable && (
        <div
          role="alert"
          style={{ ...panel, background: 'rgba(127, 29, 29, 0.35)', border: '1px solid #DC2626', color: '#FECACA', fontSize: '0.85rem', lineHeight: 1.6 }}
        >
          <strong style={{ display: 'block', marginBottom: '6px' }}>Secrets cannot be stored</strong>
          <code>SETTINGS_ENCRYPTION_KEY</code> is not set on this deployment, so a gateway secret
          cannot be encrypted. Generate one with <code>openssl rand -hex 32</code>, add it to the
          environment and redeploy before entering keys here.
        </div>
      )}

      {message && (
        <div
          role="status"
          style={{
            ...panel,
            padding: '12px 16px',
            background: message.kind === 'ok' ? 'rgba(22, 101, 52, 0.3)' : 'rgba(127, 29, 29, 0.3)',
            border: `1px solid ${message.kind === 'ok' ? '#16A34A' : '#DC2626'}`,
            color: message.kind === 'ok' ? '#BBF7D0' : '#FECACA',
            fontSize: '0.85rem',
          }}
        >
          {message.text}
        </div>
      )}

      {gateways.map((g) => (
        <div key={g.id} style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div>
              <div style={{ fontSize: '1.05rem', color: '#FFFFFF', fontWeight: 700 }}>{g.label}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                Settles {g.currencies.join(', ')}
                {g.updatedBy ? ` · last changed by ${g.updatedBy}` : ''}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={g.enabled}
                onChange={(e) => update(g.id, { enabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: g.enabled ? '#9BCB44' : '#94A3B8' }}>
                {g.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          {g.effectiveSource === 'environment' && (
            <div style={{ fontSize: '0.78rem', color: '#FDE68A', background: 'rgba(120, 53, 15, 0.35)', border: '1px solid #B45309', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', lineHeight: 1.5 }}>
              Currently running on environment variables. Enter the keys here, confirm a payment
              works, then remove them from the environment.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '14px' }}>
            <div>
              <label style={label}>{g.publicLabel}</label>
              <input
                style={input}
                value={g.publicKey}
                placeholder={g.id === 'RAZORPAY' ? 'rzp_live_…' : 'API key'}
                onChange={(e) => update(g.id, { publicKey: e.target.value })}
              />
            </div>

            <div>
              <label style={label}>
                {g.secretLabel}
                {g.hasSecret && (
                  <span style={{ color: '#9BCB44', fontWeight: 700 }}>
                    {' '}· installed{g.secretLast4 ? ` (ends ${g.secretLast4})` : ''}
                  </span>
                )}
              </label>
              <input
                style={input}
                type="password"
                autoComplete="new-password"
                value={secrets[g.id] || ''}
                placeholder={g.hasSecret ? 'Leave blank to keep the current key' : 'Enter the secret'}
                onChange={(e) => setSecrets((s) => ({ ...s, [g.id]: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', margin: '16px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.82rem', color: '#CBD5E1' }}>
              <input
                type="checkbox"
                checked={g.sandbox}
                onChange={(e) => update(g.id, { sandbox: e.target.checked })}
              />
              Test / sandbox mode
            </label>

            {g.currencies.map((c) => (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.82rem', color: '#CBD5E1' }}>
                <input
                  type="checkbox"
                  checked={g.selectedCurrencies.includes(c)}
                  onChange={(e) =>
                    update(g.id, {
                      selectedCurrencies: e.target.checked
                        ? [...g.selectedCurrencies, c]
                        : g.selectedCurrencies.filter((x) => x !== c),
                    })
                  }
                />
                Accept {c}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={() => save(g)}
              disabled={saving === g.id || (!encryptionAvailable && Boolean(secrets[g.id]))}
              style={{
                background: '#FFCD00',
                color: '#2B2200',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 20px',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: saving === g.id ? 'wait' : 'pointer',
                opacity: saving === g.id ? 0.6 : 1,
              }}
            >
              {saving === g.id ? 'Saving…' : `Save ${g.label}`}
            </button>

            <span style={{ fontSize: '0.78rem', color: g.effectivelyLive ? '#9BCB44' : '#94A3B8' }}>
              {g.effectivelyLive
                ? `Live — checkout is using this gateway (${g.sandbox ? 'test' : 'production'} mode)`
                : 'Not accepting payments'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
