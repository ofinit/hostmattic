'use client';

import React from 'react';

export default function BillingToggle({
  cycle,
  onChange,
}: {
  cycle: 'monthly' | 'annual';
  onChange: (c: 'monthly' | 'annual') => void;
}) {
  return (
    <div className="billing-switcher-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', margin: '30px 0 40px' }}>
      <span style={{ fontWeight: cycle === 'monthly' ? 700 : 500, color: cycle === 'monthly' ? '#0F172A' : '#64748B' }}>
        Monthly Billing
      </span>
      <button
        onClick={() => onChange(cycle === 'annual' ? 'monthly' : 'annual')}
        style={{
          width: '56px',
          height: '30px',
          borderRadius: '999px',
          background: cycle === 'annual' ? 'var(--brand-action-green)' : '#CBD5E1',
          border: 'none',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.2s ease',
        }}
        aria-label="Toggle annual or monthly billing"
      >
        <span
          style={{
            position: 'absolute',
            top: '3px',
            left: cycle === 'annual' ? '28px' : '4px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'left 0.2s ease',
          }}
        />
      </button>
      <span style={{ fontWeight: cycle === 'annual' ? 700 : 500, color: cycle === 'annual' ? '#0F172A' : '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
        Annual Billing
        <span className="badge-discount" style={{ background: '#FFF9D6', color: '#A2700C', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
          SAVE 40%
        </span>
      </span>
    </div>
  );
}
