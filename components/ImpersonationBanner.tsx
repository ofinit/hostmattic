'use client';

import React, { useEffect, useState } from 'react';

/**
 * Shown on EVERY page while an administrator is acting as a customer.
 *
 * This deliberately lives in the root layout rather than on the client
 * dashboard. Scoped to one page it vanished the moment the admin navigated to a
 * product page or opened checkout - exactly where an order gets placed on the
 * customer's account - which is the one place the warning actually matters.
 */
export default function ImpersonationBanner() {
  const [state, setState] = useState<{ by: string; name?: string; email?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.authenticated && j.user?.impersonatedBy) {
          setState({ by: j.user.impersonatedBy, name: j.user.name, email: j.user.email });
        } else {
          setState(null);
        }
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  const exit = async () => {
    try {
      const res = await fetch('/api/auth/end-impersonation', { method: 'POST' });
      const json = await res.json().catch(() => null);
      window.location.href = json?.redirectTo || '/admin/dashboard';
    } catch {
      window.location.href = '/admin/dashboard';
    }
  };

  return (
    <div
      role="status"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 900,
        background: '#7C2D12',
        color: '#FFEDD5',
        borderBottom: '2px solid #FFCD00',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        fontSize: '0.86rem',
        lineHeight: 1.45,
      }}
    >
      <strong style={{ color: '#FFCD00', whiteSpace: 'nowrap' }}>Administrator view</strong>
      <span>
        Acting as <strong>{state.name || 'this customer'}</strong>
        {state.email ? ` (${state.email})` : ''}. Signed in as {state.by}. Anything ordered here is
        placed on the customer&apos;s account.
      </span>
      <button
        onClick={exit}
        style={{
          marginLeft: 'auto',
          background: '#FFCD00',
          color: '#2B2200',
          border: 'none',
          padding: '7px 16px',
          borderRadius: '8px',
          fontWeight: 800,
          fontSize: '0.82rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Return to admin console
      </button>
    </div>
  );
}
